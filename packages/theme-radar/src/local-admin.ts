/**
 * L'admin de rédaction vit dans le socle (`le-socle/admin/`), dépendance
 * versionnée du Kiosque : une seule interface, développée à un seul endroit.
 * Ce fichier ne fait que la brancher sur la construction du Kiosque (mode
 * navigateur, pour la démo) et sur la page Mise à jour.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
// @ts-expect-error — JavaScript simple, sans fichier de types.
import { ADMIN_ASSETS, adminNav as socleAdminNav, adminPage, adminShell as socleAdminShell } from 'le-socle/admin/page.js';

const require = createRequire(import.meta.url);
const SOCLE_ROOT = path.dirname(require.resolve('le-socle/package.json'));

/** Version du socle installée avec ce Kiosque (`package.json` de `le-socle`). */
export const SOCLE_VERSION: string = JSON.parse(readFileSync(path.join(SOCLE_ROOT, 'package.json'), 'utf8')).version;

/** Fichiers de l'admin fournis par le socle. */
export const SOCLE_ADMIN_ASSETS: readonly string[] = ADMIN_ASSETS;

/** Chemin d'un fichier de l'admin dans la dépendance `le-socle`. */
export function socleAdminAsset(file: string): string {
  if (!SOCLE_ADMIN_ASSETS.includes(file)) throw new Error(`Fichier d'admin inconnu : ${file}`);
  return path.join(SOCLE_ROOT, 'admin', 'assets', file);
}

export interface LocalAdminPageOptions {
  publicationName: string;
  lang: string;
  publicBasePath: string;
  adminBasePath: string;
  assetsBase: string;
  seedUrl: string;
  publicationSlug: string;
  databaseKey: string;
}

export const adminNav: (adminBasePath: string, active: string, updateHref?: string) => string = socleAdminNav;

export const adminShell: (options: {
  lang: string;
  title: string;
  publicationName: string;
  publicBasePath: string;
  adminBasePath: string;
  cssHref: string;
  active: string;
  note: string;
  main: string;
  scripts?: string;
  updateHref?: string;
}) => string = socleAdminShell;

/** La page de l'admin en mode navigateur (démo, données dans ce navigateur). */
export function localAdminPage(options: LocalAdminPageOptions): string {
  return adminPage({ ...options, mode: 'navigateur' });
}
