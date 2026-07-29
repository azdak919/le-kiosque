/**
 * Algo de sélection photo libre (port LE-RADAR) + scoring banque locale.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  articleToStockItem,
  extractSearchQueries,
  rankLocalMedia,
  scoreStockFit,
  STOCK_MIN_RETAIN_SCORE,
} from '../packages/stock-photo/src/index.ts';
import { rankLocalMedia as rankBrowser } from '../packages/theme-radar/assets/editorial/stock-photo-match.js';

const DEMO = path.resolve(fileURLToPath(import.meta.url), '../../examples/demo-journal');

test('rankLocalMedia préfère soccer pour un article de soccer', async () => {
  const manifest = JSON.parse(await readFile(path.join(DEMO, 'media/demo-library/manifest.json'), 'utf8'));
  const item = articleToStockItem({
    title: 'Le tournoi de soccer interprogramme ouvrira les inscriptions lundi',
    excerpt: 'Six équipes mixtes de soccer sur terrain synthétique, inscriptions gratuites.',
    body: 'Les matchs de soccer se déroulent sur le terrain. Ballon, buts et arbitres bénévoles.',
    institution: 'Cégep de démonstration',
    region: 'Québec',
  });
  const ranked = rankLocalMedia(item, manifest.media, { usage: 'article', minScore: 30, limit: 5 });
  assert.ok(ranked.length >= 1, 'au moins une suggestion locale');
  const topSrc = ranked[0].src;
  assert.match(topSrc, /soccer|sport|football/i, `top inattendu: ${topSrc} score=${ranked[0].score}`);
  assert.ok(ranked[0].score >= 40, `score trop bas: ${ranked[0].score}`);
});

test('rankLocalMedia préfère labo pour un article de laboratoire', async () => {
  const manifest = JSON.parse(await readFile(path.join(DEMO, 'media/demo-library/manifest.json'), 'utf8'));
  const item = articleToStockItem({
    title: 'Le laboratoire de sciences tiendra une soirée portes ouvertes',
    excerpt: 'Chimie, paillasses et microscopes pour le public du campus.',
    body: 'Le laboratoire de chimie accueille les familles. Blouses, pipettes, expériences.',
  });
  const ranked = rankLocalMedia(item, manifest.media, { usage: 'article', minScore: 30, limit: 5 });
  assert.ok(ranked.length >= 1);
  assert.match(ranked[0].src, /labo|serre|science/i, `top: ${ranked[0].src}`);
});

test('extractSearchQueries produit des requêtes non vides', () => {
  const item = articleToStockItem({
    title: 'Collecte de sang sur le campus en septembre',
    excerpt: 'La croix-rouge revient pour une collecte de sang au local étudiant.',
  });
  const q = extractSearchQueries(item);
  assert.ok(q.length >= 1, 'requêtes attendues');
  assert.ok(q.some((s) => /sang|blood|collecte/i.test(s)), `queries: ${q.join(' | ')}`);
});

test('scoreStockFit refuse une photo hors-sujet évidente', () => {
  const item = articleToStockItem({
    title: 'Tournoi de soccer interprogramme',
    excerpt: 'Matchs de soccer sur terrain synthétique.',
  });
  const soccer = scoreStockFit(item, '/media/demo-library/articles/soccer.jpg', {
    title: 'Adidas soccer ball on a grass pitch',
    width: 1920,
    height: 1280,
  });
  const chess = scoreStockFit(item, '/media/demo-library/articles/chess.jpg', {
    title: 'Chess game Staunton pieces',
    width: 1920,
    height: 1260,
  });
  assert.ok(soccer > chess, `soccer ${soccer} devrait battre chess ${chess}`);
  assert.ok(soccer >= STOCK_MIN_RETAIN_SCORE || soccer >= 40, `soccer score ${soccer}`);
});

test('le scorer navigateur classe aussi le soccer en tête', async () => {
  const manifest = JSON.parse(await readFile(path.join(DEMO, 'media/demo-library/manifest.json'), 'utf8'));
  const ranked = rankBrowser(
    {
      title: 'Le tournoi de soccer interprogramme ouvrira les inscriptions',
      excerpt: 'Équipes de soccer, terrain synthétique, ballon.',
      body: 'Matchs de soccer gratuits sur le campus.',
    },
    manifest.media,
    { usage: 'article', minScore: 30, limit: 5 },
  );
  assert.ok(ranked.length >= 1);
  assert.match(ranked[0].src, /soccer/i, `browser top: ${ranked[0].src}`);
});
