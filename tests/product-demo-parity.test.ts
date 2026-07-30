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

async function buildFrom(
  srcRelative: string,
  opts: { editorial?: { mode: 'demo-local' | 'off' } } = {},
): Promise<{ dir: string; out: string }> {
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
    config: {
      root: dir,
      source: { adapter: 'markdown' },
      deploy: { basePath: '' },
      ...(opts.editorial ? { editorial: opts.editorial } : {}),
    },
    bundle,
    outDir: out,
    logger: silent,
  });
  return { dir, out };
}

test('demo et template reçoivent le même theme.css / kiosque.js (packages/theme-radar)', async (t) => {
  const demo = await buildFrom('examples/demo-journal', { editorial: { mode: 'demo-local' } });
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
  // Impression : photos modestes + texte qui flotte autour (lead + corps).
  assert.match(demoCss, /\.post-body\s+figure\.post-figure/, 'figures flottantes dans le corps');
  assert.match(demoCss, /\.post-flow/, 'conteneur lead+corps pour float print');
  assert.match(
    demoCss,
    /@media\s+print\s*\{[\s\S]*?\.post-lead\s*\{[\s\S]*?float:\s*right[\s\S]*?6\.8cm/,
    'impression : lead flottant, largeur en cm',
  );
  assert.match(
    demoCss,
    /@media\s+print\s*\{[\s\S]*?\.post-body\s+figure\.post-figure[\s\S]*?5\.8cm/,
    'impression : photos du corps en cm',
  );
  assert.match(demoJs, /computeMastheadFocalY/, 'cadrage auto mât présent');
  assert.match(demoJs, /function applyTheme/, 'bascule thème présente');
  // Mobile UX (7 points) : dock météo, nav peek, volume overlay.
  assert.match(demoJs, /setMastheadWeatherDocked/, 'dock météo mobile');
  assert.match(demoJs, /initMastheadSports/, 'puce sports mât');
  assert.match(demoJs, /initNavCollapse/, 'nav collapse + peek');
  assert.match(demoJs, /is-vol-overlay/, 'volume popover sans poussée layout');
  assert.match(demoCss, /masthead-weather-dock/, 'styles dock météo');
  assert.match(demoCss, /\.sports-chip/, 'styles puce sports');
  assert.match(demoCss, /\.nav-shell\.has-overflow/, 'styles nav peek');
  assert.match(demoCss, /--lead-title-size/, 'titre une ≤ wordmark (token)');

  const demoHome = await readFile(path.join(demo.out, 'index.html'), 'utf8');
  const tplHome = await readFile(path.join(tpl.out, 'index.html'), 'utf8');
  assert.match(demoHome, /class="[^"]*masthead/);
  assert.match(tplHome, /class="[^"]*masthead/);
  // Même moteur de gabarits : outil thème + shuffle si multi-photos.
  assert.match(demoHome, /id="theme-toggle"/);
  assert.match(tplHome, /id="theme-toggle"/);
  assert.match(demoHome, /id="masthead-weather-dock"/, 'emplacement dock météo');
  assert.match(tplHome, /id="masthead-weather-dock"/);
  assert.match(demoHome, /data-sports-payload/, 'équipe sports démo embarquée');
  assert.match(demoHome, /Les Élans|Les &Eacute;lans/, 'surnom maison unique (focus-group Élans)');
  assert.match(demoHome, /code&quot;:&quot;QUO&quot;|"code":"QUO"/, 'code équipe QUO');
  assert.match(demoHome, /data-nav-shell/, 'shell nav mobile');
  assert.match(tplHome, /data-nav-shell/);
  assert.match(demoHome, /data-nav-toggle/, 'bouton Toutes les rubriques');
  assert.match(tplHome, /data-nav-toggle/);
  assert.match(demoHome, /wire-title">Le fil</, 'démo Quorum : libellé focus-group');
  assert.match(tplHome, /wire-title">À la une</, 'template : fallback tant que labels absents');

  // Équipe : portraits + intro lisible ; seed PGlite versionné pour re-sync.
  const demoAuthors = await readFile(path.join(demo.out, 'auteurs/index.html'), 'utf8');
  assert.match(demoAuthors, /author-avatar__img/, 'portraits d’équipe dans le HTML statique');
  assert.match(demoAuthors, /author-avatar__initials/, 'initiales en secours sous la photo');
  assert.match(
    demoAuthors,
    /L’équipe en poste : rôle, cohorte et bio de chaque signature/,
    'intro équipe reformulée',
  );
  const seed = await readFile(path.join(demo.out, 'assets/editorial/seed.json'), 'utf8');
  assert.match(seed, /"version":\s*16/, 'seed démo v16 (surnom Élans, focus-group)');
  assert.match(seed, /Les Élans/, 'seed embarque le surnom maison Élans');
  assert.doesNotMatch(seed, /Les Quorums/, 'plus de surnom redondant Quorums');
  assert.match(seed, /"sport":"volleyball"/, 'plusieurs formations (sports) sous le même surnom');
  assert.match(seed, /"sport":"basketball"|"sport":"soccer"|"sport":"hockey"/, 'au moins un autre sport');
  assert.match(seed, /Titans|Boomerang|Géants|Cheetahs/, 'adversaires = clubs RSEQ collégial réels');
  assert.match(seed, /"code":"QUO"/, 'code institution Cégep du Quorum = QUO');
  assert.match(demoJs, /sportsHomeRichLabel|sportsOppRichLabel/, 'puce : maison sans (institution)');
  assert.match(seed, /"opponentCode":"(GAR|LIM|CSF|CAL|SLA|CEM|SJR)"/, 'codes adversaires = institutions RSEQ');
  // Prochains matchs : institution adverse (puce bureau + page Au tableau).
  assert.match(
    seed,
    /"nextGame"\s*:\s*\{[^}]*"opponentInstitution"\s*:\s*"Cégep de Sainte-Foy"/,
    'nextGame porte opponentInstitution (ex. Géants / Sainte-Foy)',
  );
  assert.match(demoJs, /sportsIsDesktopLabel|sports-chip--rich|SPORTS_SPORT_TONES/, 'densité mobile codes / bureau noms');
  const demoBackend = await readFile(path.join(demo.out, 'assets/editorial/demo-backend.js'), 'utf8');
  assert.match(demoBackend, /#refreshUnmodifiedDemo|refreshUnmodifiedDemo/, 'upgrade seed local sans perdre les éditions');
  assert.match(demoBackend, /seed\.publication/, 'refresh seed met à jour publication (sports mât)');
  assert.match(demoJs, /KiosqueRefreshMasthead/, 're-paint sports après branding éditorial');
  assert.match(demoJs, /SPORTS_ROTATE_MIN_MS|5600/, 'dwell min sports ~5,6 s');
  assert.match(demoJs, /SPORTS_MARQUEE_PX_PER_S|scheduleSportsRotate/, 'marquee lent + rotation après cycle');
  assert.match(demoJs, /sports-chip__badge|sports-chip__score/, 'format scoreboard codes + score');
  assert.match(demoJs, /is-arriving/, 'animation gare sports');
  assert.match(demoCss, /sports-tile-arrive/, 'keyframes arrivée scoreboard');
  assert.match(demoCss, /sports-marquee-slide[\s\S]*18%/, 'marquee avec pauses aux extrémités');
});
