import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { homeRailHtml } from '../packages/theme-radar/src/home-rail.js';
import { radioBarHtml } from '../packages/theme-radar/src/radio.js';
import { renderSourceArticle } from '../packages/theme-radar/src/source-view.js';
import { archivesPage, magazineFeedHtml, type RenderContext } from '../packages/theme-radar/src/templates.ts';
import type { Article, Publication } from '../packages/core/src/model.ts';

// Corrections d'ergonomie relevées sur La Vigie 0.3.3 (archives, accueil, recherche, mât, crédits).
const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const live = read('packages/theme-radar/assets/editorial/render.js');

const publication = {
  id: 'la-vigie', slug: 'la-vigie', name: 'La Vigie', lang: 'fr-CA', timeZone: 'America/Toronto',
  siteUrl: 'https://vigie.example/', theme: { accent: '#0d3b66' }, governance: { owner: 'L’association' },
} as Publication;
const ctx: RenderContext = {
  publication, basePath: '', taxonomies: { sections: [], categories: [], tags: [] }, authorsBySlug: new Map(), buildYear: 2026,
};
function article(id: string, title: string, publishedAt: string): Article {
  return {
    id, slug: id, publication: 'la-vigie', title, excerpt: 'Résumé.', body: { format: 'markdown', raw: 'Corps.' },
    media: [], authors: [], categories: [], tags: [], lang: 'fr-CA', status: 'published', updatedAt: publishedAt, publishedAt,
    canonicalUrl: `https://vigie.example/articles/${id}/`, source: { backend: 'markdown', backendId: id, fetchedAt: publishedAt },
  };
}

test('archives : une seule année, pas de barre des années ; plusieurs, oui', () => {
  const one = archivesPage([article('a', 'Un', '2026-11-18T21:00:00Z'), article('b', 'Deux', '2026-11-18T20:00:00Z')], ctx);
  assert.doesNotMatch(one, /archive-year-nav/);
  assert.equal(one.match(/>2026</g)?.length ?? 0, 1, 'l’année n’est écrite qu’une fois');
  const two = archivesPage([article('a', 'Un', '2026-11-18T21:00:00Z'), article('b', 'Deux', '2025-03-01T12:00:00Z')], ctx);
  assert.match(two, /archive-year-nav/);
  // Site vivant : même règle, et articles triés du plus récent au plus ancien.
  assert.match(live, /const years = groups\.length < 2 \? '' :/);
  assert.match(live, /export function byDateDesc/);
  assert.match(live, /const published = byDateDesc\(/);
});

test('accueil : la colonne de droite reçoit le tableau des sports et les rubriques', () => {
  const rail = homeRailHtml({
    publication: {
      timeZone: 'America/Toronto',
      masthead: { sports: { teams: [{ id: 'hiboux', name: 'Hiboux', sport: 'Basketball', results: [{ date: '2026-11-12', opponent: 'Lynx', scoreFor: 78, scoreAgainst: 71, result: 'W' }] }] } },
    },
    sections: [{ slug: 'campus', name: 'Campus' }, { slug: 'vide', name: 'Vide' }],
    articles: [{ section: 'campus' }, { section: 'campus' }],
    base: '/journal',
  });
  assert.match(rail, /<aside class="brief-rail home-rail"/);
  assert.match(rail, /Au tableau/);
  assert.match(rail, /home-rail__score--v">78–71<\/span> Lynx/);
  assert.match(rail, /href="\/journal\/sports\/"/);
  assert.match(rail, /Rubriques/);
  assert.match(rail, /href="\/journal\/sections\/campus\/"/);
  assert.match(rail, /2 articles/);
  assert.doesNotMatch(rail, /Vide/, 'une rubrique sans article n’est pas listée');
  assert.equal(homeRailHtml({ publication: {}, sections: [], articles: [] }), '');
  // Le fil prend la colonne quand il n'y a pas d'« En bref ».
  const feed = magazineFeedHtml([article('a', 'Un', '2026-11-18T21:00:00Z')], ctx, { heroLabel: 'Le fil', empty: '—', rail: '<aside class="home-rail">X</aside>' });
  assert.match(feed, /home-rail/);
  assert.match(live, /rail: homeRailHtml\(/);
});

test('recherche : résultats en cartes d’article et bouton à la taille du champ', () => {
  assert.match(live, /search-results search-results--cards">\$\{matches\.map\(\(article\) => articleCard\(article, bundle, base, 'tail'\)\)/);
  const css = read('packages/theme-radar/assets/theme.css');
  assert.match(css, /\.search-form button[^{]*\{[^}]*min-height: 46px/);
});

test('crédit photo lisible ; la une est chargée en priorité', () => {
  const view = {
    section: 'Campus', href: '/a/', title: 'Titre', excerpt: 'Extrait.', readMore: true,
    date: { iso: '2026-11-18T21:00:00Z', label: '18 novembre 2026' }, authors: [],
    image: { src: '/m.jpg', alt: '', caption: 'Une longue légende', credit: 'Wolven / Wikimedia Commons', license: 'CC BY 4.0', width: 1280, height: 720 },
  };
  const lead = renderSourceArticle(view, 'lead');
  const feature = renderSourceArticle(view, 'feature');
  assert.match(lead, /loading="eager" fetchpriority="high"/);
  assert.match(feature, /loading="lazy" fetchpriority="low"/);
  assert.match(feature, /<span class="article-media-caption">Une longue légende — <\/span><span class="article-media-photo">Photo : Wolven \/ Wikimedia Commons \(CC BY 4\.0\)<\/span>/);
  const css = read('packages/theme-radar/assets/source-view.css');
  assert.match(css, /\.article-media-credit \{[^}]*font-size: \.76rem/);
  assert.match(css, /\.article-media-credit:has\(\.article-media-photo\) \.article-media-caption \{ display: none; \}/);
  assert.match(css, /animation: une-attente/);
});

test('mât : place réservée pour la radio et la météo pendant le chargement', () => {
  assert.match(radioBarHtml({ enabled: true, station: 'chyz' }), /onerror="this\.parentNode\.dataset\.radarRadio='off'"/);
  const css = read('packages/theme-radar/assets/theme.css');
  assert.match(css, /\.radar-radio-slot:not\(\[data-radar-radio\]\)::before \{[^}]*height: 68px/);
  assert.match(css, /\.radar-radio-slot:not\(\[data-radar-radio\]\)::before \{ height: 58px; \}/);
  const js = read('packages/theme-radar/assets/kiosque.js');
  assert.match(js, /weather-chip--attente/);
  assert.match(js, /function preloadWeatherIcons/);
});
