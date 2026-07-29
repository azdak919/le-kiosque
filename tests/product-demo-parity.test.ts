/**
 * Garantit que la démo Quorum et le gabarit produit partagent le même chrome
 * (packages/theme-radar). Un journal généré ne doit pas diverger du look démo
 * par un autre chemin de build.
 */

import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { MarkdownSource } from '../packages/adapters/markdown/src/index.ts';
import { createSourceContext } from '../packages/core/src/source.ts';
import { build } from '../packages/pipeline/src/build.ts';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const silent = { info: () => {}, warn: () => {}, error: () => {} };

async function buildFrom(srcRelative: string): Promise<{ dir: string; out: string }> {
  const src = path.join(ROOT, srcRelative);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kiosque-parity-'));
  await cp(path.join(src, 'content'), path.join(dir, 'content'), { recursive: true });
  await cp(path.join(src, 'media'), path.join(dir, 'media'), { recursive: true }).catch(() => {});
  await cp(path.join(src, 'theme'), path.join(dir, 'theme'), { recursive: true }).catch(() => {});

  const source = new MarkdownSource();
  await source.init({ root: dir }, createSourceContext({ logger: silent }));
  const articles = [];
  for await (const article of source.fetchArticles()) articles.push(article);
  const bundle = {
    publication: await source.fetchPublication(),
    authors: await source.fetchAuthors(),
    taxonomies: await source.fetchTaxonomies(),
    articles,
    syncedAt: new Date().toISOString(),
  };
  const out = path.join(dir, 'dist');
  await build({
    config: { root: dir, source: { adapter: 'markdown' }, deploy: { basePath: '' } },
    bundle,
    outDir: out,
    logger: silent,
  });
  return { dir, out };
}

test('demo et template reçoivent le même theme.css / kiosque.js (packages/theme-radar)', async (t) => {
  const demo = await buildFrom('examples/demo-journal');
  const tpl = await buildFrom('template');
  t.after(async () => {
    await rm(demo.dir, { recursive: true, force: true });
    await rm(tpl.dir, { recursive: true, force: true });
  });

  const demoCss = await readFile(path.join(demo.out, 'assets/theme.css'), 'utf8');
  const tplCss = await readFile(path.join(tpl.out, 'assets/theme.css'), 'utf8');
  const demoJs = await readFile(path.join(demo.out, 'assets/kiosque.js'), 'utf8');
  const tplJs = await readFile(path.join(tpl.out, 'assets/kiosque.js'), 'utf8');

  assert.equal(demoCss, tplCss, 'theme.css doit être identique pour démo et produit');
  assert.equal(demoJs, tplJs, 'kiosque.js doit être identique pour démo et produit');
  assert.match(demoCss, /--masthead-ar:\s*3\.55/, 'bandeau mât fixe type Quorum présent');
  assert.match(
    demoCss,
    /\.masthead--illustrated\s*\{[^}]*height:\s*clamp\(156px/,
    'hauteur mât plafonnée (pas fluid content-driven)',
  );
  // Impression : bandeau démo rouge visible (accueil + article), fond forcé.
  assert.match(
    demoCss,
    /@media\s+print\s*\{[\s\S]*?\.demo-banner\s*\{[\s\S]*?display:\s*block\s*!important[\s\S]*?print-color-adjust:\s*exact/,
    'impression : bandeau démo rouge conservé',
  );
  assert.match(demoJs, /computeMastheadFocalY/, 'cadrage auto mât présent');
  assert.match(demoJs, /function applyTheme/, 'bascule thème présente');

  const demoHome = await readFile(path.join(demo.out, 'index.html'), 'utf8');
  const tplHome = await readFile(path.join(tpl.out, 'index.html'), 'utf8');
  assert.match(demoHome, /class="[^"]*masthead/);
  assert.match(tplHome, /class="[^"]*masthead/);
  // Même moteur de gabarits : outil thème + shuffle si multi-photos.
  assert.match(demoHome, /id="theme-toggle"/);
  assert.match(tplHome, /id="theme-toggle"/);
  assert.match(demoHome, /wire-title">Le fil</, 'démo Quorum : libellé focus-group');
  assert.match(tplHome, /wire-title">À la une</, 'template : fallback tant que labels absents');
});
