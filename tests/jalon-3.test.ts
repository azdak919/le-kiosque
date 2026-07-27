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
  assert.equal(content.articles.length, 22, 'Le Quorum doit offrir vingt articles publiés et deux cas de travail');
  assert.equal(content.articles.filter((article) => article.status === 'published').length, 20);
  assert.ok(content.articles.every((article) => article.isDemo), 'chaque article du Quorum doit être marqué fictif');

  const result = await build({ config: config({ demoContent: false }), bundle: content, outDir: out, logger: silent });
  assert.equal(result.articles, 0);
  const home = await readFile(path.join(out, 'index.html'), 'utf8');
  assert.match(home, /Aucun article publié/);
  await assert.rejects(() => readdir(path.join(out, 'articles')));
});

test('la barre radio suit le contrat sombre et reste masquée avant la confirmation du RADAR', async (t) => {
  const out = await mkdtemp(path.join(os.tmpdir(), 'kiosque-radio-'));
  t.after(() => rm(out, { recursive: true, force: true }));

  await build({
    config: config({ deploy: { basePath: '/depot-renomme' } }),
    bundle: await bundle(),
    outDir: out,
    logger: silent,
  });
  const home = await readFile(path.join(out, 'index.html'), 'utf8');
  const client = await readFile(path.join(out, 'assets/kiosque.js'), 'utf8');
  const theme = await readFile(path.join(out, 'assets/theme.css'), 'utf8');
  assert.match(home, /<radar-tuner/);
  assert.match(home, /data-src="https:\/\/le-radar\.ca\/tuner-embed\.html\?station=chyz&amp;surface=kiosque-v1"/);
  assert.match(home, /<radar-tuner[^>]+hidden/);
  assert.ok(!home.includes('<iframe'), 'l’iframe doit être créée par le composant client');
  assert.match(client, /message\.protocol !== 1 \|\| message\.surface !== 'kiosque-v1'/);
  assert.match(client, /frame\.loading = 'eager'/, 'un iframe masqué ne doit pas attendre le lazy loading pour confirmer sa disponibilité');
  assert.match(theme, /\.radar-tuner\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(home, /href="\/depot-renomme\/assets\/theme\.css"/);
});

test('la vitrine expose le bandeau illustré, les outils et la composition magazine', async (t) => {
  const out = await mkdtemp(path.join(os.tmpdir(), 'kiosque-magazine-'));
  t.after(() => rm(out, { recursive: true, force: true }));

  const content = await bundle();
  assert.equal(content.publication.masthead?.weather?.localities[0], 'Québec');
  assert.equal(content.publication.masthead?.tools?.pomodoro, true);
  assert.equal(content.publication.masthead?.tools?.solitaire, true);

  const result = await build({ config: config({ editorial: { mode: 'demo-local' } }), bundle: content, outDir: out, logger: silent });
  assert.equal(result.articles, 20);
  const home = await readFile(path.join(out, 'index.html'), 'utf8');
  const feed = await readFile(path.join(out, 'feed.xml'), 'utf8');
  assert.match(home, /id="masthead-backgrounds"/);
  assert.match(home, /data-weather-localities="\[&quot;Québec&quot;\]"/);
  assert.match(home, /href="https:\/\/le-radar\.ca\/pomo\/"/);
  assert.match(home, /href="https:\/\/le-radar\.ca\/solitaire\/"/);
  assert.match(home, /class="article article--lead"/);
  assert.match(home, /class="article article--feature"/);
  assert.match(home, /class="article article--brief"/);
  assert.match(home, /5 octobre 2026, 06 h 00/, 'l’heure doit être présentée dans le fuseau éditorial du journal');
  assert.match(feed, /<published>2026-10-05T10:00:00\.000Z<\/published>/);
  assert.match(feed, /<media:content url="https:\/\/journal-exemple\.invalid\/media\//);
  assert.match(feed, /<link href="https:\/\/journal-exemple\.invalid\/articles\/veille-sante-mentale\/" rel="alternate" type="text\/html"\/>/);
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
