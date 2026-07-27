/** Vérifications propres à la vitrine, au contenu fictif et à la barre radio. */

import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { MarkdownSource } from '../packages/adapters/markdown/src/index.ts';
import type { Article, ContentBundle } from '../packages/core/src/model.ts';
import { createSourceContext } from '../packages/core/src/source.ts';
import { build } from '../packages/pipeline/src/build.ts';
import type { KiosqueConfig } from '../packages/pipeline/src/config.ts';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEMO = path.join(ROOT, 'examples/demo-journal');
const silent = { info: () => {}, warn: () => {}, error: () => {} };

async function bundle(): Promise<ContentBundle> {
  const source = new MarkdownSource();
  await source.init({ root: DEMO }, createSourceContext({ logger: silent }));
  const articles: Article[] = [];
  for await (const article of source.fetchArticles()) articles.push(article);
  return {
    publication: await source.fetchPublication(),
    authors: await source.fetchAuthors(),
    taxonomies: await source.fetchTaxonomies(),
    articles,
    syncedAt: new Date().toISOString(),
  };
}

const config = (extra: Partial<KiosqueConfig> = {}): KiosqueConfig => ({
  root: DEMO,
  source: { adapter: 'markdown' },
  ...extra,
});

test('demoContent=false masque tous les articles fictifs sans les supprimer du miroir', async (t) => {
  const out = await mkdtemp(path.join(os.tmpdir(), 'kiosque-demo-off-'));
  t.after(() => rm(out, { recursive: true, force: true }));

  const content = await bundle();
  assert.equal(content.articles.length, 8, 'Le Quorum doit couvrir huit cas éditoriaux');
  assert.ok(content.articles.every((article) => article.isDemo), 'chaque article du Quorum doit être marqué fictif');

  const result = await build({ config: config({ demoContent: false }), bundle: content, outDir: out, logger: silent });
  assert.equal(result.articles, 0);
  const home = await readFile(path.join(out, 'index.html'), 'utf8');
  assert.match(home, /Aucun article publié/);
  await assert.rejects(() => readdir(path.join(out, 'articles')));
});

test('la barre radio est différée et émet les paramètres documentés', async (t) => {
  const out = await mkdtemp(path.join(os.tmpdir(), 'kiosque-radio-'));
  t.after(() => rm(out, { recursive: true, force: true }));

  await build({
    config: config({ deploy: { basePath: '/depot-renomme' } }),
    bundle: await bundle(),
    outDir: out,
    logger: silent,
  });
  const home = await readFile(path.join(out, 'index.html'), 'utf8');
  assert.match(home, /<radar-tuner/);
  assert.match(home, /data-src="https:\/\/le-radar\.ca\/tuner-embed\.html\?station=chyz&amp;theme=auto"/);
  assert.ok(!home.includes('<iframe'), 'l’iframe doit être créée seulement à l’approche de la zone visible');
  assert.match(home, /href="\/depot-renomme\/assets\/theme\.css"/);
});

test('le déploiement et le configurateur du jalon 3 sont présents à la racine', async () => {
  const workflow = await readFile(path.join(ROOT, '.github/workflows/pages.yml'), 'utf8');
  const testAt = workflow.indexOf('npm test');
  const siteAt = workflow.indexOf('npm run site');
  assert.ok(testAt >= 0 && siteAt > testAt, 'les tests doivent précéder le build Pages');
  assert.match(workflow, /actions\/deploy-pages@v4/);

  const configurator = await readFile(path.join(ROOT, 'site/configurer/index.html'), 'utf8');
  assert.equal((configurator.match(/class="config-step/g) ?? []).length, 12);
  assert.ok(!/type="password"/i.test(configurator), 'le configurateur ne doit jamais demander de mot de passe');
  assert.match(configurator, /Effacer mes données/);
});
