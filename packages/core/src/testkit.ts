/**
 * LE KIOSQUE — suite de conformité partagée des adaptateurs.
 *
 * Un adaptateur qui passe cette suite est utilisable. C'est le seul critère.
 * Les mêmes assertions valent pour Markdown, WordPress, Ghost, Superdesk, Drupal :
 * on ne teste jamais le CMS, on teste le modèle normalisé qu'il produit.
 *
 * Tout s'exécute hors ligne — `fetch` est injecté via `SourceContext`.
 *
 *   import { runConformanceSuite } from '@kiosque/core/testkit';
 *   await runConformanceSuite(() => new MonAdaptateur(), config);
 */

import { validateArticle, validateAuthor, validatePublication, formatIssues } from './validate.ts';
import { createSourceContext, safeHealth, type ContentSource, type SourceContext } from './source.ts';
import type { Article } from './model.ts';

export interface ConformanceOptions {
  /** Contexte personnalisé — surtout pour injecter un `fetch` bouchonné. */
  ctx?: Partial<SourceContext>;
  /** L'adaptateur doit-il exposer au moins un article ? Défaut : oui. */
  expectArticles?: boolean;
}

export interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface ConformanceReport {
  adapter: string;
  ok: boolean;
  checks: CheckResult[];
}

async function check(
  checks: CheckResult[],
  name: string,
  fn: () => Promise<string | void> | string | void,
): Promise<void> {
  try {
    const detail = await fn();
    checks.push({ name, ok: true, detail: detail || undefined });
  } catch (err) {
    checks.push({ name, ok: false, detail: err instanceof Error ? err.message : String(err) });
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function runConformanceSuite<C>(
  factory: () => ContentSource<C>,
  config: C,
  options: ConformanceOptions = {},
): Promise<ConformanceReport> {
  const checks: CheckResult[] = [];
  const ctx = createSourceContext(options.ctx);
  const source = factory();
  const adapter = source.id;

  await check(checks, 'id et capacités déclarés', () => {
    assert(typeof source.id === 'string' && source.id.length > 0, 'id manquant');
    const c = source.capabilities;
    assert(c && typeof c === 'object', 'capabilities manquantes');
    assert(typeof c.incremental === 'boolean', 'capabilities.incremental doit être booléen');
    assert(c.media === 'urls' || c.media === 'binary', 'capabilities.media invalide');
    assert(Array.isArray(c.taxonomies), 'capabilities.taxonomies doit être un tableau');
    assert(
      !c.writeBack || typeof source.pushStatus === 'function',
      'writeBack déclaré mais pushStatus absent',
    );
  });

  await check(checks, 'init() accepte la configuration', async () => {
    await source.init(config, ctx);
  });

  await check(checks, 'health() ne lève jamais', async () => {
    const report = await safeHealth(source);
    assert(typeof report.ok === 'boolean', 'health().ok doit être booléen');
    assert(typeof report.checkedAt === 'string', 'health().checkedAt requis');
    return report.ok ? 'backend joignable' : `backend indisponible : ${report.reason ?? 'sans raison'}`;
  });

  let articles: Article[] = [];

  await check(checks, 'fetchPublication() produit une publication valide', async () => {
    const pub = await source.fetchPublication();
    const issues = validatePublication(pub);
    const errors = issues.filter((i) => i.level === 'error');
    assert(errors.length === 0, `publication invalide :\n${formatIssues(errors)}`);
    return pub.name;
  });

  await check(checks, 'fetchAuthors() produit des auteur·rices valides', async () => {
    const authors = await source.fetchAuthors();
    assert(Array.isArray(authors), 'fetchAuthors doit retourner un tableau');
    for (const [i, a] of authors.entries()) {
      const errors = validateAuthor(a, `authors[${i}]`).filter((x) => x.level === 'error');
      assert(errors.length === 0, `auteur·rice invalide :\n${formatIssues(errors)}`);
    }
    return `${authors.length} auteur·rice(s)`;
  });

  await check(checks, 'fetchTaxonomies() retourne les trois collections', async () => {
    const tax = await source.fetchTaxonomies();
    assert(Array.isArray(tax.sections), 'sections manquantes');
    assert(Array.isArray(tax.categories), 'categories manquantes');
    assert(Array.isArray(tax.tags), 'tags manquants');
    return `${tax.sections.length} sections, ${tax.categories.length} catégories, ${tax.tags.length} mots-clés`;
  });

  await check(checks, 'fetchArticles() est itérable de façon asynchrone', async () => {
    articles = [];
    for await (const a of source.fetchArticles()) articles.push(a);
    if (options.expectArticles !== false) {
      assert(articles.length > 0, 'aucun article — la source de test devrait en contenir au moins un');
    }
    return `${articles.length} article(s)`;
  });

  await check(checks, 'chaque article respecte le modèle commun', () => {
    for (const [i, a] of articles.entries()) {
      const errors = validateArticle(a, `articles[${i}]`).filter((x) => x.level === 'error');
      assert(errors.length === 0, `article « ${a.slug} » invalide :\n${formatIssues(errors)}`);
    }
  });

  await check(checks, 'identifiants et slugs uniques', () => {
    const ids = new Set<string>();
    const slugs = new Set<string>();
    for (const a of articles) {
      assert(!ids.has(a.id), `id dupliqué : ${a.id}`);
      assert(!slugs.has(a.slug), `slug dupliqué : ${a.slug}`);
      ids.add(a.id);
      slugs.add(a.slug);
    }
  });

  await check(checks, 'attribution de source cohérente', () => {
    for (const a of articles) {
      assert(
        a.source.backend === adapter,
        `article « ${a.slug} » attribué à « ${a.source.backend} » au lieu de « ${adapter} »`,
      );
    }
  });

  // Le point crucial pour la reprise : deux lectures successives, sans écriture
  // entre les deux, doivent produire exactement les mêmes identifiants. Un
  // adaptateur qui régénère ses id à chaque passage ferait exploser l'historique
  // et créerait des doublons à chaque sync.
  await check(checks, 'les identifiants sont stables entre deux lectures', async () => {
    const second = factory();
    await second.init(config, ctx);
    const again: string[] = [];
    for await (const a of second.fetchArticles()) again.push(a.id);
    const before = articles.map((a) => a.id).sort().join(',');
    const after = [...again].sort().join(',');
    assert(before === after, 'les id changent d’une lecture à l’autre — chaque sync créerait des doublons');
  });

  await check(checks, 'resolveMedia() rapatrie des octets', async () => {
    const withMedia = articles.find((a) => a.lead || a.media?.length);
    if (!withMedia) return 'aucun média dans le jeu d’essai — non vérifié';
    const asset = withMedia.lead ?? withMedia.media[0];
    const bytes = await source.resolveMedia(asset);
    assert(bytes instanceof Uint8Array, 'resolveMedia doit retourner un Uint8Array');
    assert(bytes.byteLength > 0, 'média vide');
    return `${asset.src} — ${bytes.byteLength} octets`;
  });

  // Le sync incrémental n'est un gain que s'il ne perd rien. Une date future ne
  // doit jamais renvoyer plus que l'ensemble complet.
  await check(checks, 'le curseur incrémental ne perd rien', async () => {
    if (!source.capabilities.incremental) return 'non incrémental — non applicable';
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const recent: Article[] = [];
    for await (const a of source.fetchArticles({ since: future })) recent.push(a);
    assert(
      recent.length <= articles.length,
      `le curseur « since » a retourné plus d’articles (${recent.length}) que la lecture complète (${articles.length})`,
    );
    return `${recent.length} article(s) depuis une date future`;
  });

  return { adapter, ok: checks.every((c) => c.ok), checks };
}

export function formatConformanceReport(report: ConformanceReport): string {
  const lines = [`Conformité de l’adaptateur « ${report.adapter} »`, ''];
  for (const c of report.checks) {
    lines.push(`  ${c.ok ? '✓' : '✖'} ${c.name}${c.detail ? `\n      ${c.detail.replace(/\n/g, '\n      ')}` : ''}`);
  }
  lines.push('', report.ok ? '  → conforme' : '  → NON CONFORME');
  return lines.join('\n');
}
