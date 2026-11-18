/**
 * Paquet complet d'un journal : un seul ZIP par version, à déposer chez un
 * hébergeur PHP (dossier « journal/ »). Il contient la rédaction du socle
 * (articles, banque de photos, rôles, sauvegardes, mises à jour) et le site
 * du journal, une coquille Kiosque qui se dessine dans le navigateur à partir
 * des articles publiés (mode « socle-vivant »). Nom, logo, couleurs, radio et
 * noindex viennent de l'assistant d'installation : rien n'est figé ici.
 *
 * Usage : node tools/paquet-complet.mjs [--sortie dist/kiosque-journal.zip]
 */
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MarkdownSource } from '../packages/adapters/markdown/src/index.ts';
import { createSourceContext } from '../packages/core/src/source.ts';
import { build } from '../packages/pipeline/src/build.ts';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const out = path.resolve(args.includes('--sortie') ? args[args.indexOf('--sortie') + 1] : path.join(repoRoot, 'dist', 'kiosque-journal.zip'));
const work = await mkdtemp(path.join(tmpdir(), 'kiosque-paquet-'));
const site = path.join(work, 'site');

// Fiche de départ : celle du journal d'exemple, vidée de tout ce qui le nomme.
// L'assistant d'installation la remplace au premier passage.
const source = new MarkdownSource();
await source.init({ root: path.join(repoRoot, 'examples', 'demo-journal') }, createSourceContext({ logger: { info() {}, warn() {}, error() {} } }));
const example = await source.fetchPublication();
const publication = {
  ...example,
  id: 'journal', slug: 'journal', name: 'Le journal', tagline: '', institution: '', founded: undefined, license: undefined, siteUrl: 'https://journal.invalid',
  governance: { ...(example.governance ?? {}), contact: '', stewardEntity: '' },
  logo: undefined, radio: undefined, repository: undefined,
  masthead: { ...(example.masthead ?? {}), backgrounds: undefined, weather: undefined, sports: undefined },
  theme: { accent: '#6c2163', typography: 'modern-accessible' },
};
await build({
  config: { root: work, editorial: { mode: 'socle-vivant' }, source: { adapter: 'socle' }, deploy: { basePath: '' } },
  bundle: { publication, authors: [], taxonomies: { sections: [], categories: [], tags: [] }, articles: [], media: [], syncedAt: new Date().toISOString() },
  outDir: site,
  allowDeletions: true,
  logger: { info: (m) => console.log(`[paquet] ${m}`), warn: (m) => console.warn(`[paquet] ${m}`) },
});
// Le socle sert lui-même /admin, /redaction et robots.txt ; une coquille vide
// n'a ni plan du site ni fil RSS à figer.
// La rédaction a sa propre copie de ses fichiers (journal/admin/assets).
for (const name of ['admin', 'archives', 'plan-du-site', '.nojekyll', 'robots.txt', 'sitemap.xml', 'feed.xml', 'rss.xml', 'CNAME', '_redirects', 'assets/kiosque-admin.css',
  ...['admin.js', 'admin.css', 'export.js', 'socle-backend.js', 'stock-photo-match.js'].map((file) => `assets/editorial/${file}`)]) {
  await rm(path.join(site, name), { recursive: true, force: true });
}

// Le programme du socle épinglé dans package.json. Node ne lit pas le
// TypeScript sous node_modules : on le copie d'abord hors de node_modules.
const socle = path.join(work, 'le-socle');
await cp(path.join(repoRoot, 'node_modules', 'le-socle'), socle, { recursive: true, filter: (src) => !src.includes(`${path.sep}test${path.sep}`) });
const kiosque = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
const socleVersion = JSON.parse(await readFile(path.join(socle, 'package.json'), 'utf8')).version;
const paquet = {
  nom: 'kiosque-journal',
  // Version du paquet = version du Kiosque = étiquette vX.Y.Z de la Release.
  version: kiosque.version,
  kiosque: kiosque.version,
  socle: socleVersion,
  // Mise à jour en un clic : la page Mise à jour lit la dernière version ici.
  depot: 'azdak919/le-kiosque',
  fichier: 'kiosque-journal.zip',
};
const made = spawnSync(process.execPath, [path.join(socle, 'tools', 'paquet-php.mjs'), '--sortie', out, '--racine', 'journal', '--site', site, '--paquet', JSON.stringify(paquet)], { encoding: 'utf8' });
process.stdout.write(made.stdout);
process.stderr.write(made.stderr);
await rm(work, { recursive: true, force: true });
if (made.status !== 0) process.exit(made.status ?? 1);
