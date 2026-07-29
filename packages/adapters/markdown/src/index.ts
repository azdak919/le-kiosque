/**
 * LE KIOSQUE — adaptateur Markdown / Git (référence).
 *
 * Cas particulier : le miroir EST le backend. `sync` se réduit donc à lire,
 * valider et normaliser. Aucun appel réseau, `health()` échoue seulement si le
 * dossier `content/` est absent.
 *
 * Le format sur disque est exactement celui que Sveltia CMS écrira au jalon 2 —
 * mêmes dossiers, mêmes clés de front-matter. `content/` est conçu comme la
 * SORTIE d'un CMS, jamais comme un format à taper à la main. C'est ce qui fera
 * qu'ajouter l'interface graphique ne demandera aucune migration.
 *
 * Disposition attendue :
 *   content/publication.yml
 *   content/taxonomies.yml          { categories: [...], tags: [...] }
 *   content/sections/<slug>.yml
 *   content/auteurs/<slug>.md
 *   content/articles/<AAAA>/<MM>/<slug>.md
 */

import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

import {
  slugify,
  type Article,
  type Author,
  type Category,
  type EditorialStatus,
  type MediaAsset,
  type Publication,
  type Section,
  type SourceAttribution,
  type Tag,
  type Taxonomies,
} from '../../../core/src/model.ts';
import type {
  ContentSource,
  ContentSourceCapabilities,
  HealthReport,
  SourceContext,
  SyncCursor,
} from '../../../core/src/source.ts';

export interface MarkdownConfig {
  /** Racine du dépôt du journal (contient `content/` et `media/`). */
  root: string;
  /** Défaut : '<root>/content' */
  contentDir?: string;
  /** Défaut : '<root>/media' */
  mediaDir?: string;
}

const BACKEND = 'markdown';

// ---------------------------------------------------------------------------
// Identifiants déterministes
// ---------------------------------------------------------------------------

/**
 * UUID dérivé du chemin, à la manière d'un UUIDv5. Deux lectures successives
 * produisent forcément le même identifiant — sans quoi chaque `sync` créerait
 * des doublons et l'historique deviendrait illisible.
 *
 * ⚠ Ce n'est qu'une valeur INITIALE, et elle dépend du chemin : tant qu'elle
 * n'est pas inscrite dans le fichier, déplacer l'article change son identité.
 * C'est `freezeId()` (voir frontmatter.ts), appelé par `sync`, qui l'inscrit à
 * demeure et rend l'identité indépendante du chemin. Un fichier créé par
 * Sveltia CMS n'a pas d'`id` : il en reçoit un au premier `sync`.
 */
export function derivedId(namespace: string, key: string): string {
  const h = createHash('sha256').update(`${namespace}\0${key}`).digest();
  const b = Buffer.from(h.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; // version 5
  b[8] = (b[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ---------------------------------------------------------------------------
// Front-matter
// ---------------------------------------------------------------------------

export interface FrontMatter {
  data: Record<string, unknown>;
  body: string;
}

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseFrontMatter(raw: string): FrontMatter {
  // Le BOM d'un fichier écrit sous Windows empêcherait la détection du `---`.
  const text = raw.replace(/^\ufeff/, '');
  const match = FM_RE.exec(text);
  if (!match) return { data: {}, body: text.trim() };
  const parsed = parseYaml(match[1]) as unknown;
  const data = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  return { data, body: text.slice(match[0].length).trim() };
}

// ---------------------------------------------------------------------------
// Lecture de champs, tolérante mais explicite
// ---------------------------------------------------------------------------

function str(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return undefined;
}

function list(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(str).filter((x): x is string => Boolean(x));
  const one = str(v);
  return one ? [one] : [];
}

function finiteNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/**
 * Les dates YAML sans fuseau (`2026-09-12 14:30:00`) sont interprétées comme
 * locales par `yaml`, ce qui décalerait la date de publication selon la machine
 * qui construit le site. On normalise systématiquement en UTC RFC 3339.
 */
function isoDate(v: unknown): string | undefined {
  if (v instanceof Date) return v.toISOString();
  const s = str(v);
  if (!s) return undefined;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function mediaFrom(
  v: unknown,
  attribution: SourceAttribution,
  fallbackKey: string,
): MediaAsset | undefined {
  if (!v) return undefined;
  const raw = typeof v === 'string' ? { src: v } : (v as Record<string, unknown>);
  const src = str(raw.src);
  if (!src) return undefined;
  const kind = (str(raw.kind) as MediaAsset['kind']) ?? 'image';
  const focal = (raw.focalPoint ?? {}) as Record<string, unknown>;
  return {
    id: str(raw.id) ?? derivedId('media', `${fallbackKey}:${src}`),
    kind,
    src,
    remoteSrc: str(raw.remoteSrc),
    alt: str(raw.alt) ?? '',
    caption: str(raw.caption),
    credit: str(raw.credit),
    creditUrl: str(raw.creditUrl),
    license: str(raw.license),
    licenseUrl: str(raw.licenseUrl),
    sourceUrl: str(raw.sourceUrl),
    width: finiteNumber(raw.width),
    height: finiteNumber(raw.height),
    focalPoint: finiteNumber(focal.x) !== undefined && finiteNumber(focal.y) !== undefined
      ? { x: finiteNumber(focal.x)!, y: finiteNumber(focal.y)! }
      : undefined,
    institution: str(raw.institution),
    campus: str(raw.campus),
    keywords: list(raw.keywords),
    usages: list(raw.usages) as NonNullable<MediaAsset['usages']>,
    mime: str(raw.mime),
    checksum: str(raw.checksum),
    source: attribution,
  };
}

/** Extrait un chapeau lisible depuis le corps quand `excerpt` est absent. */
export function deriveExcerpt(body: string, max = 220): string {
  const plain = body
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (lastStop > max * 0.5) return cut.slice(0, lastStop + 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

async function walk(dir: string, ext: string[]): Promise<string[]> {
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(full, ext)));
    else if (ext.includes(path.extname(e.name).toLowerCase())) out.push(full);
  }
  return out.sort();
}

// ---------------------------------------------------------------------------
// L'adaptateur
// ---------------------------------------------------------------------------

export class MarkdownSource implements ContentSource<MarkdownConfig> {
  readonly id = BACKEND;

  readonly capabilities: ContentSourceCapabilities = {
    incremental: true,
    webhooks: false,
    // Le miroir est le backend : écrire dedans, c'est écrire dans le dépôt,
    // ce qui relève de `sync`, pas de l'adaptateur.
    writeBack: false,
    media: 'binary',
    taxonomies: ['section', 'category', 'tag'],
    editorialWorkflow: true,
  };

  #config!: MarkdownConfig;
  #ctx!: SourceContext;
  #contentDir = '';
  #mediaDir = '';
  #publication?: Publication;

  async init(config: MarkdownConfig, ctx: SourceContext): Promise<void> {
    this.#config = config;
    this.#ctx = ctx;
    this.#contentDir = config.contentDir ?? path.join(config.root, 'content');
    this.#mediaDir = config.mediaDir ?? path.join(config.root, 'media');
  }

  async health(): Promise<HealthReport> {
    const checkedAt = new Date().toISOString();
    try {
      const s = await stat(this.#contentDir);
      if (!s.isDirectory()) {
        return { ok: false, checkedAt, reason: `${this.#contentDir} n’est pas un dossier` };
      }
      await stat(path.join(this.#contentDir, 'publication.yml'));
      return { ok: true, checkedAt };
    } catch {
      return { ok: false, checkedAt, reason: 'not-configured' };
    }
  }

  #attribution(key: string, revision?: string): SourceAttribution {
    return {
      backend: BACKEND,
      backendId: key,
      fetchedAt: new Date().toISOString(),
      revision,
    };
  }

  async fetchPublication(): Promise<Publication> {
    if (this.#publication) return this.#publication;
    const file = path.join(this.#contentDir, 'publication.yml');
    const raw = parseYaml(await readFile(file, 'utf8')) as Record<string, unknown>;

    const slug = str(raw.slug) ?? slugify(str(raw.name) ?? 'journal');
    const governance = (raw.governance ?? {}) as Record<string, unknown>;
    const theme = (raw.theme ?? {}) as Record<string, unknown>;
    const masthead = (raw.masthead ?? {}) as Record<string, unknown>;
    const backgrounds = (masthead.backgrounds ?? {}) as Record<string, unknown>;
    const weather = (masthead.weather ?? {}) as Record<string, unknown>;
    const tools = (masthead.tools ?? {}) as Record<string, unknown>;
    const attribution = this.#attribution('publication.yml');

    this.#publication = {
      id: str(raw.id) ?? derivedId('publication', slug),
      slug,
      name: str(raw.name) ?? 'Journal',
      tagline: str(raw.tagline),
      institution: str(raw.institution) ?? '',
      institutionType: (str(raw.institutionType) as Publication['institutionType']) ?? 'autre',
      region: str(raw.region),
      lang: str(raw.lang) ?? 'fr-CA',
      langs: list(raw.langs),
      siteUrl: (str(raw.siteUrl) ?? '').replace(/\/+$/, ''),
      timeZone: str(raw.timeZone) ?? 'America/Toronto',
      logo: mediaFrom(raw.logo, attribution, 'publication'),
      theme: {
        accent: str(theme.accent) ?? '#6c2163',
        accentDark: str(theme.accentDark),
        typography: (() => {
          const value = str(theme.typography);
          return value === 'editorial-classic' || value === 'institutional'
            ? value
            : 'modern-accessible';
        })(),
      },
      masthead: raw.masthead
        ? {
            backgrounds: {
              enabled: backgrounds.enabled === undefined ? true : Boolean(backgrounds.enabled),
              images: ((backgrounds.images as unknown[]) ?? [])
                .map((image, index) => mediaFrom(image, attribution, `masthead:${index}`))
                .filter((image): image is MediaAsset => Boolean(image)),
            },
            weather: {
              enabled: weather.enabled === undefined ? false : Boolean(weather.enabled),
              localities: list(weather.localities).slice(0, 4),
            },
            tools: {
              pomodoro: tools.pomodoro === undefined ? true : Boolean(tools.pomodoro),
              solitaire: tools.solitaire === undefined ? true : Boolean(tools.solitaire),
            },
            overlayStrength: finiteNumber(masthead.overlayStrength),
            textAlignment: (() => {
              const value = str(masthead.textAlignment);
              return value === 'center' || value === 'right' ? value : 'left';
            })(),
          }
        : undefined,
      radio: raw.radio
        ? (() => {
            const radio = raw.radio as Record<string, unknown>;
            const theme = str(radio.theme);
            const position = str(radio.position);
            return {
              enabled: radio.enabled === undefined ? true : Boolean(radio.enabled),
              // `stationId` reste accepté pour les miroirs créés avant le jalon 3.
              station: str(radio.station) ?? str(radio.stationId),
              theme: theme === 'light' || theme === 'dark' ? theme : 'auto',
              position: position === 'bottom' ? 'bottom' : 'top',
            } as NonNullable<Publication['radio']>;
          })()
        : undefined,
      founded: str(raw.founded),
      governance: {
        owner: str(governance.owner) ?? '',
        stewardEntity: str(governance.stewardEntity),
        contact: str(governance.contact) ?? '',
        repo: str(governance.repo) ?? '',
        domainRegistrar: str(governance.domainRegistrar),
        domainExpiresAt: isoDate(governance.domainExpiresAt),
        recoveryContacts: list(governance.recoveryContacts),
      },
      license: str(raw.license),
    };
    return this.#publication;
  }

  async fetchAuthors(): Promise<Author[]> {
    const dir = path.join(this.#contentDir, 'auteurs');
    const files = await walk(dir, ['.md', '.yml', '.yaml']);
    const authors: Author[] = [];

    for (const file of files) {
      const rel = path.relative(this.#contentDir, file);
      const isYaml = /\.ya?ml$/.test(file);
      const text = await readFile(file, 'utf8');
      const { data, body } = isYaml
        ? { data: (parseYaml(text) ?? {}) as Record<string, unknown>, body: '' }
        : parseFrontMatter(text);

      const slug = str(data.slug) ?? slugify(path.basename(file, path.extname(file)));
      const attribution = this.#attribution(rel);

      authors.push({
        id: str(data.id) ?? derivedId('author', slug),
        slug,
        name: str(data.name) ?? slug,
        role: str(data.role),
        editorialRole: (() => {
          const value = str(data.editorialRole);
          return value === 'reviseur' || value === 'editeur' ? value : value === 'auteur' ? value : undefined;
        })(),
        bio: str(data.bio) ?? (body || undefined),
        avatar: mediaFrom(data.avatar, attribution, `author:${slug}`),
        email: str(data.email),
        social: (data.social as Record<string, string> | undefined) ?? undefined,
        cohort: str(data.cohort),
        active: data.active === undefined ? true : Boolean(data.active),
        source: attribution,
      });
    }
    return authors;
  }

  async fetchTaxonomies(): Promise<Taxonomies> {
    const sections: Section[] = [];
    for (const file of await walk(path.join(this.#contentDir, 'sections'), ['.yml', '.yaml'])) {
      const raw = (parseYaml(await readFile(file, 'utf8')) ?? {}) as Record<string, unknown>;
      const slug = str(raw.slug) ?? slugify(path.basename(file, path.extname(file)));
      sections.push({
        id: str(raw.id) ?? derivedId('section', slug),
        slug,
        name: str(raw.name) ?? slug,
        description: str(raw.description),
        order: typeof raw.order === 'number' ? raw.order : undefined,
        parent: str(raw.parent),
        color: str(raw.color),
      });
    }
    sections.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name, 'fr'));

    const categories: Category[] = [];
    const tags: Tag[] = [];
    try {
      const raw = (parseYaml(
        await readFile(path.join(this.#contentDir, 'taxonomies.yml'), 'utf8'),
      ) ?? {}) as Record<string, unknown>;

      for (const entry of (raw.categories as unknown[]) ?? []) {
        const o = typeof entry === 'string' ? { name: entry } : (entry as Record<string, unknown>);
        const slug = str(o.slug) ?? slugify(str(o.name) ?? '');
        if (slug) {
          categories.push({
            id: derivedId('category', slug),
            slug,
            name: str(o.name) ?? slug,
            parent: str(o.parent),
            color: str(o.color),
          });
        }
      }
      for (const entry of (raw.tags as unknown[]) ?? []) {
        const o = typeof entry === 'string' ? { name: entry } : (entry as Record<string, unknown>);
        const slug = str(o.slug) ?? slugify(str(o.name) ?? '');
        if (slug) tags.push({ id: derivedId('tag', slug), slug, name: str(o.name) ?? slug });
      }
    } catch {
      // taxonomies.yml est facultatif : un journal qui démarre n'a ni catégorie
      // ni mot-clé, et ce n'est pas une erreur.
    }

    return { sections, categories, tags };
  }

  async *fetchArticles(cursor?: SyncCursor): AsyncIterable<Article> {
    const pub = await this.fetchPublication();
    const base = pub.siteUrl.replace(/\/+$/, '');
    const files = await walk(path.join(this.#contentDir, 'articles'), ['.md', '.markdown']);
    const since = cursor?.since ? Date.parse(cursor.since) : undefined;

    for (const file of files) {
      const rel = path.relative(this.#contentDir, file);
      const text = await readFile(file, 'utf8');
      const { data, body } = parseFrontMatter(text);

      const slug = str(data.slug) ?? slugify(path.basename(file, path.extname(file)));
      const stats = await stat(file);
      const updatedAt = isoDate(data.updatedAt) ?? stats.mtime.toISOString();

      if (since !== undefined && Date.parse(updatedAt) < since) continue;

      const attribution = this.#attribution(rel, String(stats.mtimeMs));
      const status = (str(data.status) as EditorialStatus) ?? 'draft';
      const media = ((data.media as unknown[]) ?? [])
        .map((m, i) => mediaFrom(m, attribution, `${slug}:${i}`))
        .filter((m): m is MediaAsset => Boolean(m));

      yield {
        id: str(data.id) ?? derivedId('article', `${pub.slug}/${slug}`),
        slug,
        publication: pub.slug,
        title: str(data.title) ?? slug,
        subtitle: str(data.subtitle),
        dek: str(data.dek),
        excerpt: str(data.excerpt) ?? deriveExcerpt(body),
        body: {
          format: str(data.bodyFormat) === 'html' ? 'html' : 'markdown',
          raw: body,
          wordCount: body.split(/\s+/).filter(Boolean).length,
        },
        lead: mediaFrom(data.lead, attribution, `${slug}:lead`),
        media,
        authors: list(data.authors),
        section: str(data.section),
        categories: list(data.categories),
        tags: list(data.tags),
        lang: str(data.lang) ?? pub.lang,
        translations: (data.translations as Record<string, string> | undefined) ?? undefined,
        status,
        isDemo: data.demo === undefined ? false : Boolean(data.demo),
        publishedAt: isoDate(data.publishedAt),
        updatedAt,
        canonicalUrl: str(data.canonicalUrl) ?? `${base}/articles/${slug}/`,
        previousUrls: list(data.previousUrls),
        source: attribution,
      };
    }
  }

  async resolveMedia(asset: MediaAsset): Promise<Uint8Array> {
    if (/^https?:\/\//.test(asset.src)) {
      const res = await this.#ctx.fetch(asset.src);
      if (!res.ok) throw new Error(`média distant injoignable : ${asset.src} (${res.status})`);
      return new Uint8Array(await res.arrayBuffer());
    }
    // Un chemin de média est toujours relatif à `media/`. On refuse toute
    // remontée hors de ce dossier : un `../../` dans un fichier de contenu ne
    // doit pas pouvoir lire n'importe quel fichier de la machine de build.
    const relative = asset.src.replace(/^\/?(media\/)?/, '');
    const full = path.resolve(this.#mediaDir, relative);
    if (full !== this.#mediaDir && !full.startsWith(this.#mediaDir + path.sep)) {
      throw new Error(`chemin de média hors du dossier media/ : ${asset.src}`);
    }
    return new Uint8Array(await readFile(full));
  }
}

export function createMarkdownSource(): MarkdownSource {
  return new MarkdownSource();
}
