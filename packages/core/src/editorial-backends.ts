import type {
  EditorialBackend,
  EditorialBackendCapabilities,
  EditorialBackendContext,
  EditorialChangeListener,
  EditorialEntity,
  EditorialEntityKind,
  EditorialExportOptions,
  EditorialSnapshotOptions,
} from './editorial.ts';
import type { ContentBundle, ID, Publication } from './model.ts';

export class UnsupportedEditorialOperationError extends Error {
  constructor(backend: string, operation: string) {
    super(`Le backend « ${backend} » ne permet pas l’opération « ${operation} » dans ce mode.`);
    this.name = 'UnsupportedEditorialOperationError';
  }
}

/**
 * Vue éditoriale du miroir Git. L'écriture reste confiée à Sveltia : cette
 * classe n'écrit volontairement jamais dans le dépôt depuis un navigateur.
 */
export class GitMarkdownBackend implements EditorialBackend {
  readonly id = 'git-markdown';
  readonly capabilities: EditorialBackendCapabilities = {
    writable: false,
    preview: false,
    media: true,
    persistent: 'git',
    authentication: true,
    collaboration: true,
    remoteBackup: true,
    remotePublishing: true,
  };

  #bundle?: ContentBundle;

  constructor(bundle?: ContentBundle) {
    this.#bundle = bundle;
  }

  async init(context: EditorialBackendContext): Promise<void> {
    const candidate = context.bootstrap?.bundle;
    if (candidate) this.#bundle = candidate as ContentBundle;
    if (!this.#bundle) {
      throw new Error('GitMarkdownBackend requiert un ContentBundle déjà chargé depuis le miroir.');
    }
  }

  async getSnapshot(options: EditorialSnapshotOptions): Promise<ContentBundle> {
    if (!this.#bundle) throw new Error('GitMarkdownBackend n’est pas initialisé.');
    const snapshot = structuredClone(this.#bundle);
    if (options.audience === 'public') snapshot.articles = snapshot.articles.filter((article) => article.status === 'published');
    if (options.includeDemo === false) {
      snapshot.articles = snapshot.articles.filter((article) => !article.isDemo);
      const signatures = new Set(snapshot.articles.flatMap((article) => article.authors));
      snapshot.authors = snapshot.authors.filter((author) => !author.isDemo || signatures.has(author.slug));
    }
    return snapshot;
  }

  async save(_kind: EditorialEntityKind, _entity: EditorialEntity): Promise<EditorialEntity> {
    throw new UnsupportedEditorialOperationError(this.id, 'save');
  }

  async remove(_kind: EditorialEntityKind, _id: ID): Promise<void> {
    throw new UnsupportedEditorialOperationError(this.id, 'remove');
  }

  async savePublication(_publication: Publication): Promise<Publication> {
    throw new UnsupportedEditorialOperationError(this.id, 'savePublication');
  }

  async setDemoVisibility(_visible: boolean): Promise<void> {
    throw new UnsupportedEditorialOperationError(this.id, 'setDemoVisibility');
  }

  async removeDemo(): Promise<void> {
    throw new UnsupportedEditorialOperationError(this.id, 'removeDemo');
  }

  async resetDemo(): Promise<void> {
    throw new UnsupportedEditorialOperationError(this.id, 'resetDemo');
  }

  async createBackup(_options?: EditorialExportOptions): Promise<Record<string, unknown>> {
    if (!this.#bundle) throw new Error('GitMarkdownBackend n’est pas initialisé.');
    return { format: 'kiosque-editorial-backup', version: 1, bundle: structuredClone(this.#bundle) };
  }

  async restoreBackup(_backup: Record<string, unknown>): Promise<void> {
    throw new UnsupportedEditorialOperationError(this.id, 'restoreBackup');
  }

  subscribe(_listener: EditorialChangeListener): () => void {
    return () => {};
  }

  async close(): Promise<void> {}
}

/** Point d'extension seulement : aucune connexion distante n'est réalisée. */
export class PocketBaseBackend implements EditorialBackend {
  readonly id = 'pocketbase';
  readonly capabilities: EditorialBackendCapabilities = {
    writable: false,
    preview: false,
    media: false,
    persistent: 'none',
    authentication: false,
    collaboration: false,
    remoteBackup: false,
    remotePublishing: false,
  };

  #unavailable(): never {
    throw new Error('PocketBase est une option future : aucun backend distant n’est configuré aujourd’hui.');
  }

  async init(_context: EditorialBackendContext): Promise<void> { this.#unavailable(); }
  async getSnapshot(_options: EditorialSnapshotOptions): Promise<ContentBundle> { return this.#unavailable(); }
  async save(_kind: EditorialEntityKind, _entity: EditorialEntity): Promise<EditorialEntity> { return this.#unavailable(); }
  async remove(_kind: EditorialEntityKind, _id: ID): Promise<void> { this.#unavailable(); }
  async savePublication(_publication: Publication): Promise<Publication> { return this.#unavailable(); }
  async setDemoVisibility(_visible: boolean): Promise<void> { this.#unavailable(); }
  async removeDemo(): Promise<void> { this.#unavailable(); }
  async resetDemo(): Promise<void> { this.#unavailable(); }
  async createBackup(_options?: EditorialExportOptions): Promise<Record<string, unknown>> { return this.#unavailable(); }
  async restoreBackup(_backup: Record<string, unknown>): Promise<void> { this.#unavailable(); }
  subscribe(_listener: EditorialChangeListener): () => void { return () => {}; }
  async close(): Promise<void> {}
}
