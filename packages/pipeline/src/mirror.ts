/**
 * LE KIOSQUE — le miroir portable.
 *
 * `content/` + `media/` dans Git SONT l'archive. Ce module est le seul à savoir
 * les lire et les écrire.
 *
 * Le point capital : `readMirror()` n'importe aucun adaptateur et ne fait aucun
 * appel réseau. `build` ne dépend donc que du disque. Un CMS peut disparaître de
 * la surface de la Terre, le site se reconstruit quand même.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

import type { ContentBundle } from '../../core/src/model.ts';

export const MIRROR_INDEX = '.index.json';

export interface MirrorStats {
  articles: number;
  authors: number;
  media: number;
  syncedAt?: string;
}

/** Chemin de l'index dérivé du miroir. */
export function indexPath(root: string): string {
  return path.join(root, 'content', MIRROR_INDEX);
}

/**
 * Écrit l'index dérivé. Ce fichier est un CACHE, jamais une source de vérité :
 * il est entièrement reconstructible depuis les fichiers Markdown. On le versionne
 * quand même — il permet à `build` de connaître l'état attendu sans relire tout
 * le contenu, et c'est lui qui alimente l'invariant anti-site-vide.
 */
export async function writeIndex(root: string, bundle: ContentBundle): Promise<void> {
  const payload = {
    _comment:
      'Index dérivé, régénéré par `kiosque sync`. Reconstructible à 100 % depuis content/. ' +
      'Ne pas éditer à la main.',
    syncedAt: bundle.syncedAt,
    publication: bundle.publication.slug,
    counts: {
      articles: bundle.articles.length,
      authors: bundle.authors.length,
      sections: bundle.taxonomies.sections.length,
    },
    articles: bundle.articles
      .map((a) => ({
        id: a.id,
        slug: a.slug,
        status: a.status,
        demo: a.isDemo || undefined,
        publishedAt: a.publishedAt,
        updatedAt: a.updatedAt,
        canonicalUrl: a.canonicalUrl,
        previousUrls: a.previousUrls?.length ? a.previousUrls : undefined,
      }))
      .sort((x, y) => x.slug.localeCompare(y.slug)),
  };
  await mkdir(path.dirname(indexPath(root)), { recursive: true });
  await writeFile(indexPath(root), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

export interface MirrorIndex {
  syncedAt?: string;
  counts?: { articles?: number; authors?: number; sections?: number };
  articles?: Array<{ id: string; slug: string; status: string; demo?: boolean }>;
}

export async function readIndex(root: string): Promise<MirrorIndex | undefined> {
  try {
    return JSON.parse(await readFile(indexPath(root), 'utf8')) as MirrorIndex;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Médias
// ---------------------------------------------------------------------------

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Enregistre un média dans le miroir et retourne son empreinte. */
export async function writeMedia(root: string, src: string, bytes: Uint8Array): Promise<string> {
  const relative = src.replace(/^\/?(media\/)?/, '');
  const full = path.resolve(root, 'media', relative);
  const mediaRoot = path.resolve(root, 'media');
  if (full !== mediaRoot && !full.startsWith(mediaRoot + path.sep)) {
    throw new Error(`chemin de média hors du dossier media/ : ${src}`);
  }
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
  return sha256(bytes);
}

/** Liste tous les médias du miroir avec leur empreinte — base de `doctor`. */
export async function inventoryMedia(root: string): Promise<Map<string, string>> {
  const mediaRoot = path.resolve(root, 'media');
  const out = new Map<string, string>();

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (!e.name.startsWith('.')) {
        const rel = `/media/${path.relative(mediaRoot, full).split(path.sep).join('/')}`;
        out.set(rel, sha256(new Uint8Array(await readFile(full))));
      }
    }
  }

  await walk(mediaRoot);
  return out;
}

/** Empreintes enregistrées lors du dernier sync. */
export async function readChecksums(root: string): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(path.join(root, 'media', '.checksums.json'), 'utf8'));
  } catch {
    return {};
  }
}

export async function writeChecksums(root: string, sums: Record<string, string>): Promise<void> {
  const file = path.join(root, 'media', '.checksums.json');
  await mkdir(path.dirname(file), { recursive: true });
  const sorted = Object.fromEntries(Object.entries(sums).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(file, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
}

/**
 * Compare les empreintes enregistrées à celles des fichiers sur disque.
 * Un média corrompu ou disparu se voit ici — c'est le contrôle d'intégrité
 * de l'archive, celui qui doit tourner périodiquement.
 */
export async function verifyMediaIntegrity(root: string): Promise<{
  ok: boolean;
  missing: string[];
  corrupted: string[];
  untracked: string[];
}> {
  const expected = await readChecksums(root);
  const actual = await inventoryMedia(root);

  const missing: string[] = [];
  const corrupted: string[] = [];

  for (const [src, sum] of Object.entries(expected)) {
    const found = actual.get(src);
    if (!found) missing.push(src);
    else if (found !== sum) corrupted.push(src);
  }
  const untracked = [...actual.keys()].filter((k) => !(k in expected));

  return { ok: missing.length === 0 && corrupted.length === 0, missing, corrupted, untracked };
}

// ---------------------------------------------------------------------------
// Lecture du miroir, sans aucun adaptateur
// ---------------------------------------------------------------------------

export async function mirrorExists(root: string): Promise<boolean> {
  try {
    const s = await stat(path.join(root, 'content', 'publication.yml'));
    return s.isFile();
  } catch {
    return false;
  }
}

/** Lit `publication.yml` sans passer par un adaptateur — utilisé par `doctor`. */
export async function readPublicationRaw(root: string): Promise<Record<string, unknown>> {
  const raw = await readFile(path.join(root, 'content', 'publication.yml'), 'utf8');
  return (parseYaml(raw) ?? {}) as Record<string, unknown>;
}
