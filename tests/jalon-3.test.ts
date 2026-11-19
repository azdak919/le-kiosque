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
  assert.equal(content.articles.length, 42, 'Le Quorum doit offrir quarante articles publiés et deux cas de travail');
  assert.equal(content.articles.filter((article) => article.status === 'published').length, 40);
  assert.ok(content.articles.every((article) => article.isDemo), 'chaque article du Quorum doit être marqué fictif');

  const result = await build({ config: config({ demoContent: false }), bundle: content, outDir: out, logger: silent });
  assert.equal(result.articles, 0);
  const home = await readFile(path.join(out, 'index.html'), 'utf8');
  assert.match(home, /Aucun article publié/);
  await assert.rejects(() => readdir(path.join(out, 'articles')));
});

test('la barre radio est le module de LE-RADAR, appelé en une ligne', async (t) => {
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
  assert.match(home, /<div class="radar-radio-slot" data-station="chyz"><script src="https:\/\/le-radar\.ca\/radio-barre\.js" data-station="chyz" async onerror="this\.parentNode\.dataset\.radarRadio='off'"><\/script><\/div>/);
  assert.match(home, /<body class="[^"]*with-radio/);
  assert.ok(!home.includes('<iframe'), 'aucune iframe radio');
  assert.ok(!home.includes('tuner-embed'));
  // Aucune copie des stations, du lecteur ou de son style dans le Kiosque.
  assert.ok(!home.includes('ecoutez.chyz.ca') && !client.includes('ecoutez.chyz.ca'), 'pas de flux copié');
  assert.ok(!client.includes('enhanceRadio'), 'pas de lecteur copié');
  assert.ok(!theme.includes('kiosque-radio'), 'pas de style de lecteur copié');
  // Place réservée pendant le chargement ; repliée si LE-RADAR est muet (« off »).
  assert.match(theme, /\.radar-radio-slot \{ display: none; \}/);
  assert.match(theme, /\.radar-radio-slot:not\(\[data-radar-radio\]\),/);
  assert.match(theme, /\.radar-radio-slot\[data-radar-radio="ready"\]/);
  assert.match(home, /href="\/depot-renomme\/assets\/theme\.css"/);
});

test('radio éteinte : aucune barre et aucune requête vers le-radar.ca', async (t) => {
  const { radioBarHtml, radioStation } = await import('../packages/theme-radar/src/radio.js');
  assert.equal(radioBarHtml({ enabled: false, station: 'chyz' }), '');
  assert.equal(radioBarHtml({ enabled: true }), '');
  assert.equal(radioBarHtml(undefined), '');
  assert.equal(radioStation({ enabled: true, station: '<script>' }), null);
  assert.equal(radioStation({ enabled: true, station: 'CHYZ' }), 'chyz');

  const out = await mkdtemp(path.join(os.tmpdir(), 'kiosque-sans-radio-'));
  t.after(() => rm(out, { recursive: true, force: true }));
  const data = await bundle();
  data.publication = { ...data.publication, radio: { enabled: false, station: 'chyz' } };
  await build({ config: config({ deploy: { basePath: '' } }), bundle: data, outDir: out, logger: silent });
  for (const page of ['index.html', `articles/${data.articles.find((a) => a.status === 'published')?.slug}/index.html`]) {
    const html = await readFile(path.join(out, page), 'utf8').catch(() => '');
    if (!html) continue;
    assert.ok(!html.includes('le-radar.ca/radio-barre'), `${page} : le module n'est pas appelé`);
    assert.ok(!html.includes('radar-radio-slot'), `${page} : pas d'emplacement radio`);
    assert.doesNotMatch(html, /<body class="[^"]*with-radio/);
  }
});

test('la vitrine expose le bandeau illustré, les outils et la composition magazine', async (t) => {
  const out = await mkdtemp(path.join(os.tmpdir(), 'kiosque-magazine-'));
  t.after(() => rm(out, { recursive: true, force: true }));

  const content = await bundle();
  const weatherLoc = content.publication.masthead?.weather?.localities[0];
  const weatherName = typeof weatherLoc === 'string' ? weatherLoc : weatherLoc?.name;
  assert.equal(weatherName, 'Saint-Louis-du-Ha! Ha!');
  assert.equal(content.publication.masthead?.tools?.pomodoro, true);
  assert.equal(content.publication.masthead?.tools?.solitaire, true);
  const sportsTeams = content.publication.masthead?.sports?.teams?.length
    ? content.publication.masthead.sports.teams
    : content.publication.masthead?.sports?.team
      ? [content.publication.masthead.sports.team]
      : [];
  assert.ok(sportsTeams.length >= 8, 'plusieurs formations H/F/mixte (démo multi-cartes)');
  assert.ok(sportsTeams.some((t) => t.code === 'SLHH' && t.sport === 'volleyball'));
  assert.ok(sportsTeams.some((t) => t.sport === 'basketball'));
  assert.ok(sportsTeams.some((t) => t.sport === 'hockey' && (t.sex === 'F' || t.sex === 'f')), 'hockey féminin');
  assert.ok(
    sportsTeams.some((t) => t.sport === 'flag-football' && (t.sex === 'F' || t.sex === 'f')),
    'flag football féminin',
  );
  assert.ok(sportsTeams.some((t) => t.sex === 'F' || t.sex === 'f'));
  assert.ok(sportsTeams.some((t) => t.sex === 'M' || t.sex === 'm'));
  assert.ok(sportsTeams.some((t) => String(t.sex || '').toLowerCase().includes('mix')));
  assert.equal(sportsTeams[0]?.fictional, true);

  const result = await build({ config: config({ editorial: { mode: 'demo-local' } }), bundle: content, outDir: out, logger: silent });
  assert.equal(result.articles, 40);
  const home = await readFile(path.join(out, 'index.html'), 'utf8');
  const feed = await readFile(path.join(out, 'feed.xml'), 'utf8');
  assert.match(home, /id="masthead-backgrounds"/);
  assert.match(home, /data-weather-localities="/);
  assert.match(home, /data-sports-payload="/);
  assert.match(home, /Les Élans|Les &Eacute;lans/);
  assert.match(home, /\/sports\//, 'puce sports pointe vers la page résultats');
  const sportsPage = await readFile(path.join(out, 'sports/index.html'), 'utf8');
  assert.match(sportsPage, /Au tableau/);
  assert.match(sportsPage, /sports-board/);
  assert.match(sportsPage, /sports-board-wrap|data-sports-board-wrap/, 'repli tableau pour articles en bas');
  assert.match(sportsPage, /Plus de matchs/, 'bouton Plus de matchs (parité Plus d’articles)');
  assert.match(sportsPage, /sports-panel/);
  assert.match(sportsPage, /Boomerang|Titans|Cheetahs/);
  assert.match(sportsPage, /sports-result__venue--home|Domicile/, 'domicile visible sur les cartes');
  assert.match(sportsPage, /sports-result__venue--away|Extérieur/, 'extérieur visible sur les cartes');
  assert.match(sportsPage, /sports-panel__sex/, 'pastille F/M/Mixte (parité LE-RADAR)');
  assert.match(sportsPage, /sports-result--next/, 'prochain match en tête de carte');
  assert.match(sportsPage, /data-team="/, 'cartes formation portent data-team (deep-link puce)');
  // Première ligne d’un panneau : À venir (ou score récent), pas un vieux résultat en bas.
  const firstPanel = sportsPage.match(/<section class="sports-panel"[\s\S]*?<\/section>/);
  assert.ok(firstPanel, 'au moins un panneau formation');
  assert.match(firstPanel![0], /sports-result--next|À venir/, '1ʳᵉ rangée carte = à venir / récent');
  // Nav section Sports = même contenu Au tableau (pas le fil seul).
  const sportsSection = await readFile(path.join(out, 'sections/sports/index.html'), 'utf8');
  assert.match(sportsSection, /Au tableau/, 'section Sports affiche Au tableau');
  assert.match(sportsSection, /sports-board/);
  assert.match(sportsSection, /Plus de matchs/);
  assert.match(home, /Saint-Louis-du-Ha|Ha! Ha!|Ha!/, 'météo mât = ville du cégep fictif');
  assert.match(home, /47\.6709|-68\.9797|saint-louis-du-ha-ha/, 'coords / slug météo Ha! Ha!');
  assert.match(home, /href="https:\/\/le-radar\.ca\/pomo\/"/);
  assert.match(home, /href="https:\/\/le-radar\.ca\/solitaire\/"/);
  assert.match(home, /class="article article--lead(?: [^"]*)?"/);
  assert.match(home, /class="article article--feature(?: [^"]*)?"/);
  assert.match(home, /class="article article--brief(?: [^"]*)?"/);
  assert.match(home, /5 octobre 2026, 06 h 00/, 'l’heure doit être présentée dans le fuseau éditorial du journal');
  assert.match(feed, /<published>2026-10-05T10:00:00\.000Z<\/published>/);
  assert.match(feed, /<media:content url="https:\/\/journal-exemple\.invalid\/media\//);
  assert.match(feed, /<link href="https:\/\/journal-exemple\.invalid\/articles\/veille-sante-mentale\/" rel="alternate" type="text\/html"\/>/);
});

test('le déploiement et le configurateur du jalon 3 sont présents à la racine', async () => {
  const workflow = await readFile(path.join(ROOT, '.github/workflows/verification.yml'), 'utf8');
  const testAt = workflow.indexOf('npm test');
  const siteAt = workflow.indexOf('npm run site');
  assert.ok(testAt >= 0 && siteAt > testAt, 'les tests doivent précéder le build Pages');
  assert.match(workflow, /actions\/deploy-pages@v\d+/);

  const configurator = await readFile(path.join(ROOT, 'site/configurer/index.html'), 'utf8');
  assert.equal((configurator.match(/class="config-step"/g) ?? []).length, 4, "configurateur en 4 étapes (t344u)");
  assert.ok(!/type="password"/i.test(configurator), 'le configurateur ne doit jamais demander de mot de passe');
  assert.match(configurator, /Effacer mes données/);
});
