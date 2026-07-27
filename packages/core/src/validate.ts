/**
 * LE KIOSQUE — validation du modèle commun.
 *
 * Tout ce qui entre dans le miroir passe ici. Un adaptateur peut produire
 * n'importe quoi ; le miroir, lui, ne contient que du contenu valide — c'est ce
 * qui permet de reconstruire le site dans dix ans sans surprise.
 *
 * Deux niveaux :
 *   - `error`   bloque l'écriture dans le miroir
 *   - `warning` laisse passer mais se voit dans le journal de `sync`
 */

import {
  EDITORIAL_STATUSES,
  type Article,
  type Author,
  type MediaAsset,
  type Publication,
  type Taxonomies,
} from './model.ts';

export interface Issue {
  level: 'error' | 'warning';
  /** Chemin dans l'objet. Ex. : 'articles[3].lead.alt' */
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: Issue[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function err(issues: Issue[], path: string, message: string): void {
  issues.push({ level: 'error', path, message });
}

function warn(issues: Issue[], path: string, message: string): void {
  issues.push({ level: 'warning', path, message });
}

function checkAttribution(issues: Issue[], path: string, value: unknown): void {
  const src = value as { backend?: unknown; backendId?: unknown; fetchedAt?: unknown };
  if (!src || typeof src !== 'object') {
    err(issues, path, 'source manquante — on doit toujours savoir d’où vient une donnée');
    return;
  }
  if (typeof src.backend !== 'string' || !src.backend) {
    err(issues, `${path}.backend`, 'backend requis');
  }
  if (typeof src.backendId !== 'string' || !src.backendId) {
    err(issues, `${path}.backendId`, 'backendId requis — sans lui, pas de sync incrémental');
  }
  if (typeof src.fetchedAt !== 'string' || !ISO_RE.test(src.fetchedAt)) {
    err(issues, `${path}.fetchedAt`, 'fetchedAt doit être une date RFC 3339');
  }
}

export function validateMedia(asset: MediaAsset, path: string): Issue[] {
  const issues: Issue[] = [];
  if (!asset.id) err(issues, `${path}.id`, 'id requis');
  if (!asset.src) err(issues, `${path}.src`, 'src requis');
  else if (!asset.src.startsWith('/') && !/^https?:\/\//.test(asset.src)) {
    err(issues, `${path}.src`, 'src doit être un chemin absolu du site ou une URL http(s)');
  }
  if (asset.kind === 'image' && !asset.alt?.trim()) {
    // Accessibilité : une image sans alternative textuelle est un défaut de
    // publication, pas un détail esthétique.
    err(issues, `${path}.alt`, 'texte alternatif requis pour une image');
  }
  if (asset.kind === 'image' && !asset.credit?.trim()) {
    warn(issues, `${path}.credit`, 'crédit photo absent');
  }
  checkAttribution(issues, `${path}.source`, asset.source);
  return issues;
}

export function validateArticle(article: Article, path = 'article'): Issue[] {
  const issues: Issue[] = [];

  if (!article.id) {
    err(issues, `${path}.id`, 'id requis');
  } else if (!UUID_RE.test(article.id)) {
    // Non bloquant : un adaptateur tiers peut légitimement utiliser un autre
    // schéma d'identifiant stable. Mais l'UUID est ce qui garantit qu'une
    // migration entre deux CMS ne crée pas de doublon.
    warn(issues, `${path}.id`, `« ${article.id} » n’est pas un UUID — l’unicité entre backends n’est plus garantie`);
  }

  if (!article.slug) err(issues, `${path}.slug`, 'slug requis');
  else if (!SLUG_RE.test(article.slug)) {
    err(issues, `${path}.slug`, `« ${article.slug} » n’est pas un slug valide (minuscules, chiffres, tirets)`);
  }

  if (!article.title?.trim()) err(issues, `${path}.title`, 'titre requis');
  if (!article.publication) err(issues, `${path}.publication`, 'publication requise');

  // Enum strict, jamais du texte libre : un statut mal orthographié
  // (« publie », « Published ») ne doit pas silencieusement rendre un article
  // invisible, ni pire, en publier un qui ne devait pas l'être.
  if (!EDITORIAL_STATUSES.includes(article.status)) {
    err(
      issues,
      `${path}.status`,
      `statut inconnu : « ${article.status} ». Valeurs acceptées : ${EDITORIAL_STATUSES.join(', ')}`,
    );
  }

  if (!article.body || typeof article.body.raw !== 'string') {
    err(issues, `${path}.body.raw`, 'corps requis');
  } else if (!article.body.raw.trim() && article.status === 'published') {
    err(issues, `${path}.body.raw`, 'un article publié ne peut pas être vide');
  }

  // Exigences de publication.
  //
  // On n'entrave jamais l'ÉCRITURE : un brouillon peut être aussi incomplet
  // qu'on veut, c'est le propre d'un brouillon. On entrave la PUBLICATION —
  // le moment où le texte devient public et citable. Ces manquements-là sont
  // bloquants, pas des avertissements qu'on finit par ne plus lire.
  if (article.status === 'published' || article.status === 'archived') {
    if (!article.publishedAt) {
      err(issues, `${path}.publishedAt`, 'date de publication requise pour publier');
    } else if (!ISO_RE.test(article.publishedAt)) {
      err(issues, `${path}.publishedAt`, 'publishedAt doit être une date RFC 3339');
    }
    if (!article.authors?.length) {
      err(issues, `${path}.authors`, 'un article publié doit être signé — ajouter au moins un auteur ou une autrice');
    }
    if (!article.section) {
      err(issues, `${path}.section`, 'un article publié doit appartenir à une section');
    }
    if (!article.excerpt?.trim()) {
      warn(issues, `${path}.excerpt`, 'extrait absent — le fil et le flux RSS seront pauvres');
    }
  }

  if (!article.updatedAt || !ISO_RE.test(article.updatedAt)) {
    err(issues, `${path}.updatedAt`, 'updatedAt doit être une date RFC 3339');
  }

  if (!article.canonicalUrl) {
    err(issues, `${path}.canonicalUrl`, 'URL canonique requise');
  } else if (!/^https?:\/\//.test(article.canonicalUrl)) {
    err(issues, `${path}.canonicalUrl`, 'l’URL canonique doit être absolue');
  }

  for (const [i, url] of (article.previousUrls ?? []).entries()) {
    if (!/^https?:\/\//.test(url)) {
      err(issues, `${path}.previousUrls[${i}]`, 'les anciennes URL doivent être absolues');
    }
    if (url === article.canonicalUrl) {
      err(issues, `${path}.previousUrls[${i}]`, 'une ancienne URL ne peut pas être l’URL canonique — cela créerait une redirection en boucle');
    }
  }

  if (article.lead) issues.push(...validateMedia(article.lead, `${path}.lead`));
  for (const [i, m] of (article.media ?? []).entries()) {
    issues.push(...validateMedia(m, `${path}.media[${i}]`));
  }

  checkAttribution(issues, `${path}.source`, article.source);
  return issues;
}

export function validateAuthor(author: Author, path = 'author'): Issue[] {
  const issues: Issue[] = [];
  if (!author.id) err(issues, `${path}.id`, 'id requis');
  if (!author.slug || !SLUG_RE.test(author.slug)) {
    err(issues, `${path}.slug`, `slug invalide : « ${author.slug} »`);
  }
  if (!author.name?.trim()) err(issues, `${path}.name`, 'nom requis');
  checkAttribution(issues, `${path}.source`, author.source);
  return issues;
}

export function validatePublication(pub: Publication, path = 'publication'): Issue[] {
  const issues: Issue[] = [];
  if (!pub.slug || !SLUG_RE.test(pub.slug)) err(issues, `${path}.slug`, 'slug invalide');
  if (!pub.name?.trim()) err(issues, `${path}.name`, 'nom requis');
  if (!pub.institution?.trim()) err(issues, `${path}.institution`, 'établissement requis');

  if (!pub.siteUrl || !/^https?:\/\//.test(pub.siteUrl)) {
    err(issues, `${path}.siteUrl`, 'siteUrl doit être une URL absolue');
  }
  if (!pub.theme?.accent) err(issues, `${path}.theme.accent`, 'couleur d’accent requise');

  // Gouvernance : ces avertissements sont la raison d'être du projet. Ils ne
  // bloquent pas la publication — on n'empêche personne de démarrer vite — mais
  // ils restent visibles à chaque sync jusqu'à ce que ce soit réglé.
  const g = pub.governance;
  if (!g) {
    err(issues, `${path}.governance`, 'section gouvernance requise');
    return issues;
  }
  if (!g.owner?.trim()) {
    err(issues, `${path}.governance.owner`, 'propriétaire du dépôt requis');
  }
  if (!g.contact?.trim()) {
    err(issues, `${path}.governance.contact`, 'courriel de contact requis');
  }
  if (!g.stewardEntity?.trim()) {
    warn(issues, `${path}.governance.stewardEntity`,
      'aucune entité permanente (asso étudiante, coop, OBNL) — le journal dépend de personnes qui vont graduer');
  }
  if ((g.recoveryContacts?.length ?? 0) < 2) {
    warn(issues, `${path}.governance.recoveryContacts`,
      'moins de deux personnes peuvent récupérer les accès — un seul départ suffirait à perdre le journal');
  }
  if (!g.domainExpiresAt) {
    warn(issues, `${path}.governance.domainExpiresAt`,
      'échéance du domaine inconnue — c’est la cause de mort n°1 d’un journal étudiant');
  }
  return issues;
}

/** Vérifie que chaque référence croisée pointe vers quelque chose qui existe. */
export function validateBundle(bundle: {
  publication: Publication;
  articles: Article[];
  authors: Author[];
  taxonomies: Taxonomies;
}): ValidationResult {
  const issues: Issue[] = [];

  issues.push(...validatePublication(bundle.publication));
  for (const [i, a] of bundle.authors.entries()) {
    issues.push(...validateAuthor(a, `authors[${i}]`));
  }
  for (const [i, a] of bundle.articles.entries()) {
    issues.push(...validateArticle(a, `articles[${i}]`));
  }

  const authorSlugs = new Set(bundle.authors.map((a) => a.slug));
  const sectionSlugs = new Set(bundle.taxonomies.sections.map((s) => s.slug));
  const categorySlugs = new Set(bundle.taxonomies.categories.map((c) => c.slug));
  const tagSlugs = new Set(bundle.taxonomies.tags.map((t) => t.slug));

  const seenIds = new Map<string, string>();
  const seenSlugs = new Map<string, string>();

  for (const [i, article] of bundle.articles.entries()) {
    const at = `articles[${i}]`;

    const idOwner = seenIds.get(article.id);
    if (idOwner) err(issues, `${at}.id`, `id dupliqué, déjà utilisé par « ${idOwner} »`);
    else seenIds.set(article.id, article.slug);

    const slugOwner = seenSlugs.get(article.slug);
    if (slugOwner) err(issues, `${at}.slug`, `slug dupliqué (id ${slugOwner}) — les deux articles se disputeraient la même URL`);
    else seenSlugs.set(article.slug, article.id);

    for (const s of article.authors ?? []) {
      if (!authorSlugs.has(s)) err(issues, `${at}.authors`, `auteur·rice inconnu·e : « ${s} »`);
    }
    if (article.section && !sectionSlugs.has(article.section)) {
      err(issues, `${at}.section`, `section inconnue : « ${article.section} »`);
    }
    for (const c of article.categories ?? []) {
      if (!categorySlugs.has(c)) warn(issues, `${at}.categories`, `catégorie non déclarée : « ${c} »`);
    }
    for (const t of article.tags ?? []) {
      if (!tagSlugs.has(t)) warn(issues, `${at}.tags`, `mot-clé non déclaré : « ${t} »`);
    }
  }

  return { ok: !issues.some((i) => i.level === 'error'), issues };
}

export function formatIssues(issues: Issue[]): string {
  if (!issues.length) return '  aucun problème';
  return issues
    .map((i) => `  ${i.level === 'error' ? '✖' : '⚠'} ${i.path} — ${i.message}`)
    .join('\n');
}
