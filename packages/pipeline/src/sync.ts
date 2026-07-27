/**
 * LE KIOSQUE — `sync` : la seule étape qui parle au backend éditorial.
 *
 * Elle rapatrie, normalise, valide, puis écrit dans le miroir. Si le backend est
 * indisponible, elle échoue BRUYAMMENT et ne touche à rien : le miroir précédent
 * reste intact et `build` continue de produire le site avec.
 *
 * Ne jamais faire échouer `build` parce que `sync` a échoué. Ce sont deux
 * commandes distinctes précisément pour ça.
 */

import path from 'node:path';

import { createSourceContext, safeHealth, type ContentSource } from '../../core/src/source.ts';
import { freezeId } from '../../adapters/markdown/src/frontmatter.ts';
import { formatIssues, validateBundle } from '../../core/src/validate.ts';
import type { Article, ContentBundle } from '../../core/src/model.ts';
import { writeChecksums, writeIndex, writeMedia } from './mirror.ts';
import type { KiosqueConfig } from './config.ts';

export interface SyncOptions {
  config: KiosqueConfig;
  source: ContentSource<never>;
  /** Ne rapatrier que ce qui a changé depuis cette date. */
  since?: string;
  /** Ne pas écrire — sert à vérifier qu'un backend répond correctement. */
  dryRun?: boolean;
  logger?: { info(m: string): void; warn(m: string): void; error(m: string): void };
}

export interface SyncResult {
  bundle: ContentBundle;
  mediaMirrored: number;
  warnings: number;
  /** Nombre d'articles dont l'`id` vient d'être inscrit à demeure. */
  idsFrozen: number;
}

/**
 * Inscrit dans chaque fichier d'article l'`id` qui n'y figure pas encore.
 *
 * Ne concerne que les articles issus du miroir Markdown — pour un backend
 * distant, l'`id` se fige au moment où `sync` écrit le fichier miroir.
 * (Cette écriture-là reste à implémenter : elle arrivera avec le premier
 * adaptateur distant, au jalon 5.)
 */
async function freezeArticleIds(
  root: string,
  articles: Article[],
  log: { warn(m: string): void },
): Promise<number> {
  let frozen = 0;
  for (const article of articles) {
    if (article.source.backend !== 'markdown') continue;
    const file = path.join(root, 'content', article.source.backendId);
    try {
      if (await freezeId(file, article.id)) frozen++;
    } catch (err) {
      // Un fichier en lecture seule ne doit pas faire échouer la
      // synchronisation : l'identifiant dérivé reste valable tant que le
      // fichier ne bouge pas.
      log.warn(`identifiant non figé (${article.source.backendId}) : ${err instanceof Error ? err.message : err}`);
    }
  }
  return frozen;
}

export class BackendUnavailableError extends Error {
  reason: string;

  constructor(reason: string) {
    super(
      `Backend indisponible : ${reason}\n` +
        `  Le miroir n'a PAS été modifié. Le site publié reste intact et\n` +
        `  \`kiosque build\` continue de fonctionner avec le contenu existant.`,
    );
    this.name = 'BackendUnavailableError';
    this.reason = reason;
  }
}

export async function sync(options: SyncOptions): Promise<SyncResult> {
  const { config, source } = options;
  const log = options.logger ?? createSourceContext().logger;
  const ctx = createSourceContext({ logger: log });

  await source.init(config.source.options as never, ctx);

  const health = await safeHealth(source);
  if (!health.ok) throw new BackendUnavailableError(health.reason ?? 'raison inconnue');
  log.info(`backend « ${source.id} » joignable${health.latencyMs ? ` (${health.latencyMs} ms)` : ''}`);

  const publication = await source.fetchPublication();
  const authors = await source.fetchAuthors();
  const taxonomies = await source.fetchTaxonomies();

  const articles: Article[] = [];
  for await (const article of source.fetchArticles(options.since ? { since: options.since } : undefined)) {
    articles.push(article);
  }

  const bundle: ContentBundle = {
    publication,
    articles,
    authors,
    taxonomies,
    syncedAt: new Date().toISOString(),
  };

  const validation = validateBundle(bundle);
  const warnings = validation.issues.filter((i) => i.level === 'warning');

  // Une ligne par problème : le préfixe du journal reste aligné, et un message
  // copié dans un rapport de bogue garde son sens.
  if (!validation.ok) {
    log.error('contenu invalide — le miroir n’a PAS été modifié :');
    for (const issue of validation.issues.filter((i) => i.level === 'error')) {
      log.error(`${issue.path} — ${issue.message}`);
    }
    throw new Error('validation du contenu échouée');
  }
  for (const issue of warnings) {
    log.warn(`${issue.path} — ${issue.message}`);
  }

  if (options.dryRun) {
    log.info('essai à blanc — rien n’a été écrit');
    return { bundle, mediaMirrored: 0, warnings: warnings.length, idsFrozen: 0 };
  }

  // Geler les identifiants AVANT tout le reste : c'est ce qui rend l'identité
  // d'un article indépendante de son chemin, et donc d'un déplacement de
  // fichier ou d'un changement de CMS. Sveltia crée des fichiers sans `id` —
  // sans ce passage, chaque renommage créerait un doublon.
  const idsFrozen = await freezeArticleIds(config.root, bundle.articles, log);
  if (idsFrozen) log.info(`${idsFrozen} identifiant(s) figé(s) dans le front-matter`);

  // Miroir des médias. Chaque fichier est enregistré avec son empreinte : c'est
  // ce qui permettra plus tard de détecter une archive silencieusement corrompue.
  const checksums: Record<string, string> = {};
  let mediaMirrored = 0;

  const assets = [
    ...articles.flatMap((a) => [a.lead, ...(a.media ?? [])]),
    ...authors.map((a) => a.avatar),
    publication.logo,
  ].filter((a): a is NonNullable<typeof a> => Boolean(a));

  for (const asset of assets) {
    if (checksums[asset.src]) continue;
    try {
      const bytes = await source.resolveMedia(asset);
      checksums[asset.src] = await writeMedia(config.root, asset.src, bytes);
      mediaMirrored++;
    } catch (err) {
      // Un média manquant n'annule pas la synchronisation : le texte compte plus
      // que l'illustration, et un article sans photo vaut mieux qu'un site figé.
      log.warn(`média non rapatrié (${asset.src}) : ${err instanceof Error ? err.message : err}`);
    }
  }

  await writeChecksums(config.root, checksums);
  await writeIndex(config.root, bundle);

  log.info(`${articles.length} articles, ${authors.length} signatures, ${mediaMirrored} médias`);
  return { bundle, mediaMirrored, warnings: warnings.length, idsFrozen };
}
