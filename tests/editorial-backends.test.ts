import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { MarkdownSource } from '../packages/adapters/markdown/src/index.ts';
import { GitMarkdownBackend, PocketBaseBackend, UnsupportedEditorialOperationError } from '../packages/core/src/editorial-backends.ts';
import type { Article, ContentBundle } from '../packages/core/src/model.ts';
import { createSourceContext } from '../packages/core/src/source.ts';
import { build } from '../packages/pipeline/src/build.ts';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEMO = path.join(ROOT, 'examples/demo-journal');
const silent = { info: () => {}, warn: () => {}, error: () => {} };

async function demoBundle(): Promise<ContentBundle> {
  const source = new MarkdownSource();
  await source.init({ root: DEMO }, createSourceContext({ logger: silent }));
  const articles: Article[] = [];
  for await (const article of source.fetchArticles()) articles.push(article);
  return { publication: await source.fetchPublication(), authors: await source.fetchAuthors(), taxonomies: await source.fetchTaxonomies(), articles, syncedAt: new Date().toISOString() };
}

test('GitMarkdownBackend expose le miroir sans prétendre pouvoir écrire', async () => {
  const bundle = await demoBundle();
  const backend = new GitMarkdownBackend(bundle);
  await backend.init({ basePath: '/journal', publicationSlug: bundle.publication.slug });
  assert.equal(backend.capabilities.writable, false);
  assert.deepEqual(await backend.getSnapshot({ audience: 'editorial' }), bundle);
  assert.ok((await backend.getSnapshot({ audience: 'public' })).articles.every((article) => article.status === 'published'));
  await assert.rejects(() => backend.remove('article', bundle.articles[0].id), UnsupportedEditorialOperationError);
});

test('PocketBase est un point d’extension explicite, sans connexion distante', async () => {
  const backend = new PocketBaseBackend();
  assert.equal(backend.capabilities.persistent, 'none');
  await assert.rejects(() => backend.init({ basePath: '', publicationSlug: 'test' }), /option future/);
});

test('le build PGlite est autonome et le build Git/Sveltia en est exempt', async (t) => {
  const demoOut = await mkdtemp(path.join(os.tmpdir(), 'kiosque-pglite-'));
  const gitOut = await mkdtemp(path.join(os.tmpdir(), 'kiosque-git-'));
  t.after(() => Promise.all([rm(demoOut, { recursive: true, force: true }), rm(gitOut, { recursive: true, force: true })]));
  const bundle = await demoBundle();

  await build({ config: { root: DEMO, source: { adapter: 'markdown' }, editorial: { mode: 'demo-local' }, deploy: { basePath: '/depot-renomme' } }, bundle, outDir: demoOut, logger: silent });
  const admin = await readFile(path.join(demoOut, 'admin/index.html'), 'utf8');
  const home = await readFile(path.join(demoOut, 'index.html'), 'utf8');
  assert.match(admin, /Mode démonstration local/);
  assert.match(home, /KIOSQUE_EDITORIAL/);
  assert.ok((await stat(path.join(demoOut, 'assets/editorial/pglite/pglite.wasm'))).size > 1_000_000);
  assert.ok((await stat(path.join(demoOut, 'assets/editorial/pglite/pglite.data'))).size > 1_000_000);
  assert.doesNotMatch(admin + home, /cdn\.jsdelivr|unpkg\.com|fonts\.googleapis/);

  await build({ config: { root: DEMO, source: { adapter: 'markdown' }, editorial: { mode: 'git-sveltia' } }, bundle, outDir: gitOut, logger: silent });
  await assert.rejects(() => stat(path.join(gitOut, 'assets/editorial')));
  await assert.rejects(() => stat(path.join(gitOut, 'media/demo-library')));
  const gitAdmin = await readFile(path.join(gitOut, 'admin/index.html'), 'utf8');
  assert.match(gitAdmin, /sveltia-cms\.js/);
  assert.doesNotMatch(gitAdmin, /PGlite|demo-pglite/);
});
