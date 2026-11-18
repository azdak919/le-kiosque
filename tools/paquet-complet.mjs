/**
 * Paquet complet d'un journal : un seul ZIP par version. Il contient un
 * dossier `kiosque-journal/` (avec le marqueur INSTALLER-A-LA-RACINE.txt) :
 * on dépose le *contenu* de ce dossier à la racine du domaine
 * (votre-journal.com). Ce dossier unique rend la mise à jour en un clic
 * possible depuis un journal en 0.2.x. Un sous-dossier reste possible : le
 * programme détecte le préfixe tout seul. Il contient
 * la rédaction du Socle
 * (articles, banque de photos, rôles, sauvegardes, mises à jour) et le site
 * du journal, une coquille Kiosque qui se dessine dans le navigateur à partir
 * des articles publiés (mode « socle-vivant »). Nom, logo, couleurs, radio et
 * noindex viennent de l'assistant d'installation : rien n'est figé ici.
 *
 * Usage : node tools/paquet-complet.mjs [--sortie dist/kiosque-journal.zip]
 */
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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
// La rédaction a sa propre copie de ses fichiers (admin/assets).
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
const made = spawnSync(process.execPath, [path.join(socle, 'tools', 'paquet-php.mjs'), '--sortie', out, '--site', site, '--paquet', JSON.stringify(paquet)], { encoding: 'utf8' });
process.stdout.write(made.stdout);
process.stderr.write(made.stderr);
if (made.status !== 0) {
  await rm(work, { recursive: true, force: true });
  process.exit(made.status ?? 1);
}
// À la racine du domaine : si le programme du Socle épinglé a encore enveloppé
// les fichiers dans un dossier (journal/ ou socle/), on le retire.
const { unzip, zipStore } = await import(pathToFileURL(path.join(socle, 'src/zip.ts')).href);
const packed = unzip(new Uint8Array(await readFile(out)));
const names = [...packed.keys()].filter((name) => !name.endsWith('/'));
const roots = new Set(names.map((name) => name.split('/')[0]));
const folder = roots.size === 1 && packed.has(`${[...roots][0]}/index.php`) ? [...roots][0] : '';
const prefix = folder ? `${folder}/` : '';
const lisezmoi = await readFile(path.join(repoRoot, 'tools', 'LISEZMOI-journal.txt'));
const marqueur = await readFile(path.join(repoRoot, 'tools', 'INSTALLER-A-LA-RACINE.txt'));
const files = names
  .filter((name) => !folder || (name.startsWith(prefix) && name.length > prefix.length))
  .map((name) => {
    const relative = folder ? name.slice(prefix.length) : name;
    const data = relative === 'LISEZMOI.txt' ? lisezmoi : packed.get(name);
    return { name: relative, data };
  });
// Un seul dossier de premier niveau, comme les paquets 0.2.x : l'ancien
// installateur (Socle 1.2.2) n'accepte que cette forme. Le marqueur dit que
// le contenu s'installe à la racine du site déjà en place, pas dans un
// sous-dossier kiosque-journal/.
const wrap = 'kiosque-journal';
const wrapped = files.map((file) => ({ name: `${wrap}/${file.name}`, data: file.data }));
wrapped.push({ name: `${wrap}/INSTALLER-A-LA-RACINE.txt`, data: marqueur });
await writeFile(out, zipStore(wrapped));
console.log(`[paquet] dossier ${wrap}/ (mise à jour possible depuis 0.2.x)`);
await rm(work, { recursive: true, force: true });
