/**
 * Contrat d'édition local ou distant.
 *
 * Il ne remplace pas ContentSource : ContentSource alimente le miroir lors de
 * `sync`; EditorialBackend sert une interface de rédaction. Le build statique
 * ne reçoit toujours qu'un ContentBundle déjà chargé.
 */

import type {
  Article,
  Author,
  Category,
  ContentBundle,
  ID,
  MediaAsset,
  Publication,
  Section,
  Tag,
} from './model.ts';

export type EditorialMode = 'demo-local' | 'git-sveltia' | 'external';
export type EditorialAudience = 'public' | 'editorial';
export type EditorialEntityKind =
  | 'article'
  | 'author'
  | 'section'
  | 'category'
  | 'tag'
  | 'media';

export interface EditorialBackendCapabilities {
  writable: boolean;
  preview: boolean;
  media: boolean;
  persistent: 'browser' | 'git' | 'remote' | 'none';
  authentication: boolean;
  collaboration: boolean;
  remoteBackup: boolean;
  remotePublishing: boolean;
}

export interface EditorialBackendContext {
  basePath: string;
  publicationSlug: string;
  seedUrl?: string;
  assetsBase?: string;
  databaseName?: string;
  bootstrap?: Record<string, unknown>;
}

export interface EditorialSnapshotOptions {
  audience: EditorialAudience;
  includeDemo?: boolean;
}

export interface EditorialExportOptions {
  filter?: 'all' | 'without-demo' | 'user-content';
}

export type EditorialEntity = Article | Author | Section | Category | Tag | MediaAsset;
export type EditorialChangeListener = (event: { kind: string; id?: ID }) => void;

export interface EditorialBackend {
  readonly id: string;
  readonly capabilities: EditorialBackendCapabilities;

  init(context: EditorialBackendContext): Promise<void>;
  getSnapshot(options: EditorialSnapshotOptions): Promise<ContentBundle>;
  save(kind: EditorialEntityKind, entity: EditorialEntity): Promise<EditorialEntity>;
  remove(kind: EditorialEntityKind, id: ID): Promise<void>;
  savePublication(publication: Publication): Promise<Publication>;
  setDemoVisibility(visible: boolean): Promise<void>;
  removeDemo(): Promise<void>;
  resetDemo(options?: { full?: boolean }): Promise<void>;
  createBackup(options?: EditorialExportOptions): Promise<Record<string, unknown>>;
  restoreBackup(backup: Record<string, unknown>): Promise<void>;
  subscribe(listener: EditorialChangeListener): () => void;
  close(): Promise<void>;
}
