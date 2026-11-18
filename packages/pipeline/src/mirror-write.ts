/**
 * LE KIOSQUE — écrire le miroir depuis un backend distant (socle, WordPress…).
 *
 * `build` ne lit que `content/` et `media/`, avec l'adaptateur Markdown. Pour
 * un backend distant, `sync` doit donc écrire ces fichiers, dans la
 * disposition que l'adaptateur Markdown relit à l'identique :
 *
 *   content/publication.yml
 *   content/taxonomies.yml
 *   content/sections/<slug>.yml
 *   content/auteurs/<slug>.md
 *   content/articles/<AAAA>/<MM>/<slug>.md
 *
 * Chaque fichier écrit porte `miroir: <backend>`. Une synchronisation
 * complète retire seulement les fichiers marqués de ce backend qui n'existent
 * plus là-bas ; un fichier écrit à la main n'est jamais retiré. Git garde
 * l'historique : un retrait se relit et se défait.
 */

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stringify } from 'yaml';

import type { Article, Author, ContentBundle, MediaAsset, Section } from '../../core/src/model.ts';

const MARK = 'miroir';

type Plain = Record<string, unknown>;

/** Retire les clés vides et la provenance (elle se recalcule à la lecture). */
function clean(value: unknown): unknown {
  if (Array.isArray(value)) {
    const items = value.map(clean).filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }
  if (value && typeof value === 'object') {
    const out: Plain = {};
    for (const [key, item] of Object.entries(value as Plain)) {
      if (key === 'source') continue;
      const next = clean(item);
      if (next !== undefined) out[key] = next;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (value === null || value === '') return undefined;
  return value;
}

function media(asset: MediaAsset | undefined): unknown {
  return asset ? clean(asset) : undefined;
}

function yamlText(data: Plain): string {
  return stringify(data, { lineWidth: 0 });
}

function frontMatter(data: Plain, body: string): string {
  return `---\n${yamlText(data)}---\n\n${body.trim()}\n`;
}

function safeSlug(slug: string): string {
  const value = slug.replace(/[^a-z0-9-]/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
  if (!value) throw new Error(`slug inutilisable comme nom de fichier : « ${slug} »`);
  return value;
}

export function articleFile(article: Article): string {
  const when = article.publishedAt ?? article.updatedAt;
  const date = /^\d{4}-\d{2}/.test(when ?? '') ? when! : new Date().toISOString();
  return path.join('articles', date.slice(0, 4), date.slice(5, 7), `${safeSlug(article.slug)}.md`);
}

function articleText(article: Article, backend: string): string {
  const { body, isDemo, publication: _publication, lead, media: assets, ...rest } = article;
  const data = clean({
    ...rest,
    bodyFormat: body.format === 'html' ? 'html' : undefined,
    demo: isDemo ? true : undefined,
    lead: media(lead),
    media: (assets ?? []).map(media),
  }) as Plain;
  return frontMatter({ ...data, [MARK]: backend }, body.raw ?? '');
}

function authorText(author: Author, backend: string): string {
  const { bio, avatar, ...rest } = author;
  const data = clean({ ...rest, avatar: media(avatar) }) as Plain;
  return frontMatter({ ...data, [MARK]: backend }, bio ?? '');
}

function sectionText(section: Section, backend: string): string {
  return yamlText({ ...(clean(section) as Plain), [MARK]: backend });
}

async function walk(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

/** Le fichier a-t-il été écrit par ce backend ? Lecture du marqueur seulement. */
async function markedBy(file: string, backend: string): Promise<boolean> {
  try {
    const text = await readFile(file, 'utf8');
    return new RegExp(`^${MARK}: ["']?${backend.replace(/[^a-z0-9-]/gi, '')}["']?\\s*$`, 'm').test(text);
  } catch {
    return false;
  }
}

export interface MirrorWriteResult {
  written: number;
  removed: string[];
}

/**
 * Écrit le paquet dans `content/`. `full` : la synchronisation a tout vu, les
 * fichiers marqués de ce backend qui n'y sont plus sont retirés.
 */
export async function writeRemoteMirror(
  root: string,
  bundle: ContentBundle,
  backend: string,
  full: boolean,
): Promise<MirrorWriteResult> {
  const content = path.join(root, 'content');
  const files = new Map<string, string>();
  files.set('publication.yml', yamlText({ ...(clean(bundle.publication) as Plain), [MARK]: backend }));
  files.set('taxonomies.yml', yamlText({
    categories: bundle.taxonomies.categories.map((item) => clean({ slug: item.slug, name: item.name, parent: item.parent, color: item.color })),
    tags: bundle.taxonomies.tags.map((item) => clean({ slug: item.slug, name: item.name })),
    [MARK]: backend,
  }));
  for (const section of bundle.taxonomies.sections) files.set(path.join('sections', `${safeSlug(section.slug)}.yml`), sectionText(section, backend));
  for (const author of bundle.authors) files.set(path.join('auteurs', `${safeSlug(author.slug)}.md`), authorText(author, backend));
  for (const article of bundle.articles) files.set(articleFile(article), articleText(article, backend));

  for (const [rel, text] of files) {
    const full = path.join(content, rel);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, text, 'utf8');
  }

  const removed: string[] = [];
  if (full) {
    for (const dir of ['articles', 'auteurs', 'sections']) {
      for (const file of await walk(path.join(content, dir))) {
        const rel = path.relative(content, file);
        if (files.has(rel) || !(await markedBy(file, backend))) continue;
        await rm(file);
        removed.push(rel);
      }
    }
  }
  return { written: files.size, removed };
}
