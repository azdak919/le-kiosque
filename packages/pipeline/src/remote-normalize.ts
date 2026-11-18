/**
 * LE KIOSQUE — remise en forme de ce qu'envoie un backend distant (le socle).
 *
 * Une fiche de journal remplie à moitié dans l'admin ne doit pas bloquer la
 * publication : ce qui manque est repris de `content/publication.yml` (écrit
 * par le configurateur), et chaque article reçoit une adresse canonique et le
 * nom court du journal actuel. Aucun article n'a à être réenregistré.
 */

import type { Article, ContentBundle, MediaAsset, Publication } from '../../core/src/model.ts';

type Plain = Record<string, unknown>;

const PLACEHOLDER_SLUGS = new Set(['', 'mon-journal']);

function blank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
}

/** Complète la fiche venue du backend avec la fiche locale, sans écraser ce qui est rempli. */
export function fillPublication(remote: Publication, local: Plain | undefined): Publication {
  if (!local) return remote;
  const out = { ...remote } as unknown as Plain;
  for (const key of ['name', 'siteUrl', 'timeZone', 'institution', 'institutionType', 'lang', 'tagline', 'region']) {
    if (blank(out[key]) && !blank(local[key])) out[key] = local[key];
  }
  if (PLACEHOLDER_SLUGS.has(String(out.slug ?? '')) && !blank(local.slug)) out.slug = local.slug;
  if (typeof out.noindex !== 'boolean' && typeof local.noindex === 'boolean') out.noindex = local.noindex;
  const governance = { ...((local.governance as Plain | undefined) ?? {}) };
  for (const [key, value] of Object.entries((out.governance as Plain | undefined) ?? {})) {
    if (!blank(value)) governance[key] = value;
  }
  if (Object.keys(governance).length) out.governance = governance;
  return out as unknown as Publication;
}

/** Adresse canonique absolue et nom court du journal actuel pour chaque article. */
export function fixArticles(articles: Article[], publication: Publication): Article[] {
  const base = String(publication.siteUrl ?? '').replace(/\/$/, '');
  return articles.map((article) => {
    const fixed = { ...article } as Article & { publication?: string };
    if (base && (!fixed.canonicalUrl || !/^https?:\/\//.test(fixed.canonicalUrl))) {
      fixed.canonicalUrl = `${base}/articles/${fixed.slug}/`;
    }
    if ('publication' in fixed || publication.slug) fixed.publication = publication.slug;
    return fixed;
  });
}

const DATA_URL = /^data:(image\/(png|jpeg|gif|webp|svg\+xml|avif));base64,([A-Za-z0-9+/=\s]+)$/i;
const EXT: Record<string, string> = { png: 'png', jpeg: 'jpg', gif: 'gif', webp: 'webp', 'svg+xml': 'svg', avif: 'avif' };

/**
 * Un logo importé dans l'admin arrive comme `data:` : on le pose en fichier
 * (`/media/logo.png`) pour que le site, le flux et l'archive le gardent.
 */
export function inlineLogo(logo: MediaAsset | undefined): { logo?: MediaAsset; file?: { src: string; bytes: Uint8Array } } {
  if (!logo) return {};
  const match = DATA_URL.exec(logo.src ?? '');
  if (!match) return { logo };
  const src = `/media/logo.${EXT[match[2].toLowerCase()] ?? 'png'}`;
  const bytes = new Uint8Array(Buffer.from(match[3].replace(/\s/g, ''), 'base64'));
  return { logo: { ...logo, src, mime: match[1].toLowerCase() } as MediaAsset, file: { src, bytes } };
}

/** Photos citées dans le texte d'un article (`<img src="/media/…">`, `![](/media/…)`). */
export function bodyMedia(body: string | undefined): string[] {
  if (!body) return [];
  const found = new Set<string>();
  for (const m of body.matchAll(/(?:src="|\]\()(\/media\/[^"')\s]+)/g)) found.add(m[1]);
  return [...found];
}

export function normalizeRemote(bundle: ContentBundle, local: Plain | undefined): {
  bundle: ContentBundle;
  logoFile?: { src: string; bytes: Uint8Array };
} {
  const filled = fillPublication(bundle.publication, local);
  const { logo, file } = inlineLogo(filled.logo);
  const publication = { ...filled, logo } as Publication;
  if (!logo) delete (publication as Partial<Publication>).logo;
  return { bundle: { ...bundle, publication, articles: fixArticles(bundle.articles, publication) }, logoFile: file };
}
