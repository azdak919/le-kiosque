/** Lecture facultative d'une banque locale, sans réseau ni dépendance CMS. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { SharedMediaAsset } from '../../core/src/model.ts';
import { formatIssues, validateSharedMedia } from '../../core/src/validate.ts';

export const SHARED_MEDIA_MANIFEST = 'media/demo-library/manifest.json';

export interface SharedMediaManifest {
  format: 'kiosque-shared-media';
  version: 1;
  notice: string;
  media: SharedMediaAsset[];
}

export async function readSharedMediaManifest(root: string): Promise<SharedMediaManifest | undefined> {
  const file = path.join(root, SHARED_MEDIA_MANIFEST);
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  const manifest = JSON.parse(raw) as SharedMediaManifest;
  if (manifest.format !== 'kiosque-shared-media' || manifest.version !== 1 || !Array.isArray(manifest.media)) {
    throw new Error(`${SHARED_MEDIA_MANIFEST} n'est pas un manifeste KIOSQUE version 1 valide`);
  }
  if (!manifest.notice?.trim()) throw new Error(`${SHARED_MEDIA_MANIFEST} doit expliquer le contexte de la démonstration`);
  const issues = manifest.media.flatMap((asset, index) => validateSharedMedia(asset, `media[${index}]`));
  if (issues.some((issue) => issue.level === 'error')) {
    throw new Error(`banque de médias invalide :\n${formatIssues(issues)}`);
  }
  return manifest;
}
