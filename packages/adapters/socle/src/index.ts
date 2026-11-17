/**
 * Adaptateur HTTP vers un socle que le journal héberge lui-même.
 *
 * Le code du serveur n'est pas dans ce dépôt. `build` n'importe pas ce fichier :
 * seul `sync`, via le registre, le charge, et seulement si la config le demande.
 * Le gabarit reste sur Markdown. Tant que le module éditorial du socle est éteint,
 * `health()` le dit et n'écrit rien.
 */

import type { Article, Author, MediaAsset, Publication, Taxonomies } from '../../../core/src/model.ts';
import type {
  ContentSource,
  ContentSourceCapabilities,
  HealthReport,
  SourceContext,
} from '../../../core/src/source.ts';

export interface SocleConfig {
  /** Origine du socle, sans barre finale. Pas un secret. */
  baseUrl?: string;
}

interface Snapshot {
  publication: Publication;
  articles: Article[];
  authors: Author[];
  taxonomies: Taxonomies;
}

const CAPABILITIES: ContentSourceCapabilities = {
  incremental: false,
  webhooks: false,
  writeBack: false,
  media: 'binary',
  taxonomies: ['section', 'category', 'tag'],
  editorialWorkflow: true,
};

export class SocleSource implements ContentSource<SocleConfig> {
  readonly id = 'socle';
  readonly capabilities = CAPABILITIES;
  private baseUrl = '';
  private fetchImpl: typeof fetch = globalThis.fetch;

  async init(config: SocleConfig, ctx: SourceContext): Promise<void> {
    this.baseUrl = String(config.baseUrl ?? '').replace(/\/$/, '');
    this.fetchImpl = ctx.fetch;
  }

  async health(): Promise<HealthReport> {
    const checkedAt = new Date().toISOString();
    if (!this.baseUrl) return { ok: false, checkedAt, reason: 'not-configured' };
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/v1/health`);
      if (!response.ok) return { ok: false, checkedAt, reason: 'unreachable' };
      const body = await response.json() as { modules?: { editorial?: boolean } };
      if (!body.modules?.editorial) return { ok: false, checkedAt, reason: 'module éteint' };
      return { ok: true, checkedAt };
    } catch {
      return { ok: false, checkedAt, reason: 'unreachable' };
    }
  }

  private async snapshot(): Promise<Snapshot> {
    if (!this.baseUrl) throw new Error('Le socle n’est pas branché. Indiquez baseUrl, ou restez sur l’adaptateur markdown.');
    const response = await this.fetchImpl(`${this.baseUrl}/v1/editorial/snapshot`);
    if (!response.ok) throw new Error('Le socle n’a pas renvoyé le journal. Vérifiez que le module éditorial est allumé.');
    return await response.json() as Snapshot;
  }

  async fetchPublication(): Promise<Publication> {
    return (await this.snapshot()).publication;
  }

  async fetchAuthors(): Promise<Author[]> {
    return (await this.snapshot()).authors ?? [];
  }

  async fetchTaxonomies(): Promise<Taxonomies> {
    return (await this.snapshot()).taxonomies;
  }

  async *fetchArticles(): AsyncIterable<Article> {
    for (const article of (await this.snapshot()).articles ?? []) yield article;
  }

  async resolveMedia(asset: MediaAsset): Promise<Uint8Array> {
    const remote = asset.remoteSrc && /^https?:\/\//.test(asset.remoteSrc) ? asset.remoteSrc : '';
    const local = asset.src.startsWith('/') ? `${this.baseUrl}${asset.src}` : '';
    const url = remote || local;
    if (!url) throw new Error('Ce média n’a pas d’adresse à rapatrier.');
    const response = await this.fetchImpl(url);
    if (!response.ok) throw new Error('Le média n’a pas pu être lu.');
    return new Uint8Array(await response.arrayBuffer());
  }
}
