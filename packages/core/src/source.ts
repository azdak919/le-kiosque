/**
 * LE KIOSQUE — contrat des sources de contenu.
 *
 * Ajouter un backend éditorial (WordPress, Ghost, Superdesk, Drupal…) = écrire
 * une classe qui implémente `ContentSource`. Rien d'autre dans le projet ne
 * bouge : ni le thème, ni le pipeline, ni le miroir, ni le site publié.
 *
 * RÈGLE ABSOLUE : ce module est la SEULE frontière réseau du projet.
 * `build` n'importe jamais un adaptateur. C'est cette frontière — et elle seule —
 * qui garantit qu'un CMS mort casse l'écriture sans jamais casser la lecture.
 */

import type {
  Article,
  Author,
  EditorialStatus,
  ID,
  ISODate,
  MediaAsset,
  Publication,
  Taxonomies,
} from './model.ts';

export interface ContentSourceCapabilities {
  /** Sait répondre à un curseur `since` — évite de tout retélécharger. */
  incremental: boolean;
  webhooks: boolean;
  /** Peut renvoyer un changement de statut vers le backend. */
  writeBack: boolean;
  /** 'urls' : l'adaptateur donne des URL à rapatrier. 'binary' : il sert les octets. */
  media: 'urls' | 'binary';
  taxonomies: Array<'section' | 'category' | 'tag'>;
  /** Supporte draft → in-review → published. */
  editorialWorkflow: boolean;
}

/**
 * Verdict de santé du backend. C'est ce qui déclenche le repli statique.
 * `health()` ne lève JAMAIS d'exception : un backend en panne est un cas normal,
 * pas une erreur de programme.
 */
export interface HealthReport {
  ok: boolean;
  checkedAt: ISODate;
  /** 'auth-expired' | 'unreachable' | 'quota' | 'not-configured' | … */
  reason?: string;
  latencyMs?: number;
}

export interface SyncCursor {
  /** Ne rapatrier que ce qui a changé depuis cette date. */
  since?: ISODate;
  token?: string;
}

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface SourceContext {
  logger: Logger;
  /** Les secrets ne transitent jamais par le dépôt ni par la configuration. */
  secrets(key: string): string | undefined;
  /** Injecté → chaque adaptateur est testable hors ligne, sans réseau. */
  fetch: typeof globalThis.fetch;
}

export interface ContentSource<Config = unknown> {
  /** 'markdown' | 'wordpress' | 'ghost' | … */
  readonly id: string;
  readonly capabilities: ContentSourceCapabilities;

  init(config: Config, ctx: SourceContext): Promise<void>;

  /** Ne lève jamais. Retourne `{ ok: false, reason }` en cas de panne. */
  health(): Promise<HealthReport>;

  fetchPublication(): Promise<Publication>;
  fetchAuthors(cursor?: SyncCursor): Promise<Author[]>;
  fetchTaxonomies(): Promise<Taxonomies>;

  /** Flux : un journal de dix ans ne doit pas tenir en mémoire d'un coup. */
  fetchArticles(cursor?: SyncCursor): AsyncIterable<Article>;

  /** Rapatrie le binaire pour le miroir local. */
  resolveMedia(asset: MediaAsset): Promise<Uint8Array>;

  /** Optionnel — seulement si `capabilities.writeBack`. */
  pushStatus?(articleId: ID, status: EditorialStatus): Promise<void>;
}

/** Fabrique enregistrée dans le registre des adaptateurs. */
export type ContentSourceFactory<Config = unknown> = () => ContentSource<Config>;

// ---------------------------------------------------------------------------
// Contexte par défaut — utilisable tel quel par le pipeline et par les tests.
// ---------------------------------------------------------------------------

export function createConsoleLogger(prefix = 'kiosque'): Logger {
  return {
    info: (m) => console.log(`[${prefix}] ${m}`),
    warn: (m) => console.warn(`[${prefix}] ⚠ ${m}`),
    error: (m) => console.error(`[${prefix}] ✖ ${m}`),
  };
}

export function createSourceContext(overrides: Partial<SourceContext> = {}): SourceContext {
  return {
    logger: overrides.logger ?? createConsoleLogger(),
    secrets: overrides.secrets ?? ((key) => process.env[key]),
    fetch: overrides.fetch ?? globalThis.fetch,
  };
}

/**
 * Enveloppe `health()` pour tenir la promesse « ne lève jamais » même si un
 * adaptateur mal écrit oublie de le faire. Le pipeline appelle toujours ceci
 * plutôt que `source.health()` directement.
 */
export async function safeHealth(source: Pick<ContentSource, 'health'>): Promise<HealthReport> {
  const started = Date.now();
  try {
    const report = await source.health();
    return { latencyMs: Date.now() - started, ...report };
  } catch (err) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      reason: err instanceof Error ? err.message : String(err),
      latencyMs: Date.now() - started,
    };
  }
}
