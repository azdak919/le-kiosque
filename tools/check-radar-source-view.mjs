#!/usr/bin/env node
/**
 * Vérifie explicitement la révision de LE-RADAR dont dépend le port contrôlé.
 * Ce contrôle est volontairement manuel : LE-KIOSQUE reste clonable seul et
 * ne télécharge jamais ni ne couple son build à un autre dépôt.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const argument = process.argv.find((value) => value.startsWith('--from='));
const repository = path.resolve(process.cwd(), argument ? argument.slice('--from='.length) : '../le-radar');
const manifestPath = path.resolve(process.cwd(), 'packages/theme-radar/LE-RADAR-SOURCE-VIEW.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

function section(source, start, end) {
  const startAt = source.indexOf(start);
  const endAt = startAt < 0 ? -1 : source.indexOf(end, startAt + start.length);
  return startAt < 0 || endAt < 0 ? '' : source.slice(startAt, endAt).trim();
}

function fingerprint(source) {
  return createHash('sha256').update(source).digest('hex');
}

let revision = '';
try {
  revision = execFileSync('git', ['-C', repository, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
} catch {
  console.error(`[radar:reference:check] LE-RADAR introuvable à ${repository}.`);
  console.error('Passez --from=/chemin/vers/le-radar ou exécutez ce contrôle dans un clone voisin.');
  process.exitCode = 2;
  process.exit();
}

const app = await readFile(path.join(repository, 'app.js'), 'utf8').catch(() => '');
const css = await readFile(path.join(repository, 'style.css'), 'utf8').catch(() => '');
const referenceSections = {
  partitionSourceFeed: section(app, 'function partitionSourceFeed(', 'function safeCreateArticle('),
  createArticle: section(app, 'function createArticle(', '/** Place .article-title juste avant .article-media'),
  articleCardsCss: section(css, '/* ── Articles (text only) ── */', '/* ─────────────── FOOTER ─────────────── */'),
};
const fingerprints = Object.fromEntries(Object.entries(referenceSections).map(([name, value]) => [name, value ? fingerprint(value) : '']));
const requiredMarkers = [
  ['app.js#createArticle', Boolean(referenceSections.createArticle)],
  ['app.js#partitionSourceFeed', Boolean(referenceSections.partitionSourceFeed)],
  ['style.css#article cards', Boolean(referenceSections.articleCardsCss)],
];
const missing = requiredMarkers.filter(([, present]) => !present).map(([name]) => name);
const expected = manifest.reference.fingerprints ?? {};
const changed = Object.keys(fingerprints).filter((name) => !fingerprints[name] || fingerprints[name] !== expected[name]);

if (process.argv.includes('--print')) {
  console.log(JSON.stringify({ revision, fingerprints }, null, 2));
}

if (missing.length || changed.length) {
  console.error('[radar:reference:check] Le port contrôlé doit être revu avant publication.');
  if (missing.length) console.error(`  repères absents : ${missing.join(', ')}`);
  if (changed.length) console.error(`  portions de référence modifiées : ${changed.join(', ')}`);
  console.error('Mettez à jour source-view.js, source-view.css et le manifeste après une revue des écarts intentionnels.');
  process.exitCode = 1;
} else {
  console.log(`[radar:reference:check] Portions LE-RADAR vérifiées à ${revision}; port déclaré dans ${path.relative(process.cwd(), manifestPath)} (révision d’origine ${manifest.reference.commit}).`);
}
