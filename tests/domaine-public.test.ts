import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import rootConfig from '../kiosque.config.ts';
import { normalizeBasePath } from '../packages/pipeline/src/config.ts';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const ORIGIN = 'https://kiosque.le-radar.ca';

// Images, polices et wasm : le chemin de publication n’y est pas écrit.
// Le PDF du guide est une affiche figée (glyphes) : on le lit quand même,
// pour attraper une annotation qui garderait /le-kiosque/.
const SKIP = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.woff', '.woff2', '.wasm', '.ico']);

async function walk(dir: string, files: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file, files);
    else files.push(file);
  }
  return files;
}

/** Chemins de site /le-kiosque/…, pas l’URL du dépôt GitHub. */
function cheminsVitrine(text: string): string[] {
  const stripped = text
    .replaceAll('https://github.com/azdak919/le-kiosque', '')
    .replaceAll('github.com/azdak919/le-kiosque', '');
  const found: string[] = [];
  const re = /\/le-kiosque(?:\/|["'\s]|$)/g;
  for (const match of stripped.matchAll(re)) found.push(match[0]);
  if (stripped.includes('azdak919.github.io/le-kiosque') || stripped.includes('azdak919.github.io/le-socle')) {
    found.push('github.io');
  }
  return found;
}

test('la vitrine publiée est à la racine de kiosque.le-radar.ca', async (t) => {
  assert.equal(normalizeBasePath(rootConfig.deploy?.basePath), '');
  assert.equal(rootConfig.deploy?.cname, 'kiosque.le-radar.ca');
  assert.equal(rootConfig.deploy?.origin, ORIGIN);

  const workflow = await readFile(path.join(ROOT, '.github/workflows/verification.yml'), 'utf8');
  assert.doesNotMatch(workflow, /export BASE="\$PAGES_BASE"/);
  assert.doesNotMatch(workflow, /PAGES_BASE/);

  const out = await mkdtemp(path.join(os.tmpdir(), 'kiosque-site-'));
  t.after(() => rm(out, { recursive: true, force: true }));
  const env = { ...process.env, OUT_DIR: out };
  delete env.BASE;
  delete env.SITE_ORIGIN;

  const code = await new Promise<number>((resolve, reject) => {
    const child = spawn(process.execPath, ['tools/build-site.mjs'], { cwd: ROOT, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (status) => resolve(status ?? 1));
  });
  assert.equal(code, 0, 'le build de la vitrine a échoué');

  const offenders: string[] = [];
  for (const file of await walk(out)) {
    if (SKIP.has(path.extname(file).toLowerCase())) continue;
    const text = await readFile(file, 'latin1');
    const hits = cheminsVitrine(text);
    if (hits.length) offenders.push(`${path.relative(out, file)} (${hits.slice(0, 3).join(', ')})`);
  }
  assert.deepEqual(offenders, [], 'un chemin /le-kiosque/ est resté dans le site généré');

  const home = await readFile(path.join(out, 'index.html'), 'utf8');
  assert.match(home, new RegExp(`rel="canonical" href="${ORIGIN}/"`));
  assert.match(home, new RegExp(`property="og:url" content="${ORIGIN}/"`));
  assert.match(home, /href="\/assets\/kiosque-ui\.css"/);
  assert.match(home, /href="\/guide\/"/);
  assert.match(home, /href="\/demo\/"/);
  assert.match(home, /href="\/admin\/"/);
  assert.match(home, /https:\/\/socle\.le-radar\.ca\//);
  assert.doesNotMatch(home, /href="\/le-kiosque/);

  const guide = await readFile(path.join(out, 'guide/index.html'), 'utf8');
  assert.match(guide, new RegExp(`rel="canonical" href="${ORIGIN}/guide/"`));
  assert.match(guide, /kiosque\.le-radar\.ca/);

  const manifest = JSON.parse(await readFile(path.join(out, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.start_url, `${ORIGIN}/`);
  assert.equal(manifest.scope, `${ORIGIN}/`);
  assert.equal(manifest.id, `${ORIGIN}/`);
  assert.ok(manifest.icons.every((icon: { src: string }) => icon.src.startsWith(`${ORIGIN}/assets/logo/`)));

  const sitemap = await readFile(path.join(out, 'sitemap.xml'), 'utf8');
  for (const url of [`${ORIGIN}/`, `${ORIGIN}/guide/`, `${ORIGIN}/configurer/`, `${ORIGIN}/demo/`]) {
    assert.ok(sitemap.includes(`<loc>${url}</loc>`), url);
  }

  assert.equal((await readFile(path.join(out, 'CNAME'), 'utf8')).trim(), 'kiosque.le-radar.ca');

  const demo = await readFile(path.join(out, 'demo/index.html'), 'utf8');
  assert.match(demo, new RegExp(`rel="canonical" href="${ORIGIN}/demo/"`));
  assert.match(demo, new RegExp(`property="og:url" content="${ORIGIN}/demo/"`));
  assert.match(demo, /href="\/demo\/articles\//);
  const demoMap = await readFile(path.join(out, 'demo/sitemap.xml'), 'utf8');
  assert.match(demoMap, new RegExp(`${ORIGIN}/demo/`));
  assert.doesNotMatch(demo, /\/le-kiosque\//);
});
