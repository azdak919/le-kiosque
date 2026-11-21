import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createContext, runInContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

const src = readFileSync(new URL('../packages/theme-radar/assets/sports-board-lib.js', import.meta.url), 'utf8');
const sandbox = createContext({ module: { exports: {} }, exports: {}, globalThis: {} });
sandbox.globalThis = sandbox;
runInContext(src, sandbox);
const lib = sandbox.module.exports as {
  SPORTS_CASCADE_STEP_MS: number;
  SPORTS_BOARD_HOLD_MIN_MS: number;
  SPORTS_BOARD_HOLD_MAX_MS: number;
  SPORTS_MIN_SLOT_PX: number;
  SPORTS_GAP_PX: number;
  sportsBoardCountFromWidth: (avail: number, options?: { desktop?: boolean }) => number;
  sportsSplitVisible: (items: Array<Record<string, unknown>>, n: number) => Array<{ key: string; live?: boolean }>;
  sportsNextForSlot: (pool: Array<Record<string, unknown>>, visible: Array<Record<string, unknown>>, slot: number, cursor: number) => Record<string, unknown> | null;
  sportsWaveSchedule: (n: number, options?: Record<string, unknown>) => Array<{ slot: number; at: number }>;
  sportsWaveStaggered: (events: Array<{ at: number }>) => boolean;
};

test('nombre de cartes selon la largeur : 1 au téléphone, 2 à la tablette, 3 à l’ordinateur', () => {
  assert.equal(lib.sportsBoardCountFromWidth(390, { desktop: false }), 1);
  assert.equal(lib.sportsBoardCountFromWidth(700, { desktop: true }), 1);
  assert.equal(lib.sportsBoardCountFromWidth(720, { desktop: true }), 2);
  assert.equal(lib.sportsBoardCountFromWidth(768, { desktop: true }), 2);
  assert.equal(lib.sportsBoardCountFromWidth(899, { desktop: true }), 2);
  assert.equal(lib.sportsBoardCountFromWidth(900, { desktop: true }), 3);
  assert.equal(lib.sportsBoardCountFromWidth(1152, { desktop: true }), 3);
  assert.equal(lib.sportsBoardCountFromWidth(1920, { desktop: true }), 3);
  const need = (n: number) => n * lib.SPORTS_MIN_SLOT_PX + lib.SPORTS_GAP_PX * (n - 1);
  assert.ok(1152 >= need(3));
  assert.ok(720 < need(3));
});

function slide(key: string, mode: 'live' | 'result' | 'next', sport: string) {
  return { key, mode, live: mode === 'live', sport };
}

test('sportsSplitVisible : directs prioritaires non exclusifs, aucune case vide, tout le bassin joignable', () => {
  const pool = [
    slide('l1', 'live', 'volleyball'),
    slide('l2', 'live', 'soccer'),
    slide('r1', 'result', 'volleyball'),
    slide('r2', 'result', 'basketball'),
    slide('n1', 'next', 'hockey'),
    slide('n2', 'next', 'football'),
    slide('n3', 'next', 'soccer'),
    slide('r3', 'result', 'hockey'),
  ];
  const four = lib.sportsSplitVisible(pool, 4);
  assert.equal(four.length, 4, '4 cases remplies');
  assert.ok(four.filter((s) => s.live).length <= 3, 'un slot reste pour autre chose que le direct');
  assert.equal(lib.sportsSplitVisible(pool, 8).length, 8);
  assert.equal(lib.sportsSplitVisible(pool, 10).length, 8, 'pas plus que le bassin');

  const seen = new Set<string>();
  let visible = lib.sportsSplitVisible(pool, 4);
  let cursor = 0;
  for (let rot = 0; rot < 40; rot += 1) {
    visible.forEach((s) => seen.add(s.key));
    const slot = rot % 4;
    const next = lib.sportsNextForSlot(pool, visible, slot, cursor);
    cursor += 1;
    if (next) visible = visible.map((s, i) => (i === slot ? next : s));
  }
  assert.equal(seen.size, pool.length, `toutes les cartes joignables, vu ${[...seen]}`);
});

test('vague L→R : horodatages décalés de 440 ms, pas simultanés', () => {
  const wave = lib.sportsWaveSchedule(4, {
    stepMs: lib.SPORTS_CASCADE_STEP_MS,
    holdMs: lib.SPORTS_BOARD_HOLD_MIN_MS,
    firstWait: true,
  });
  assert.equal(wave.length, 4);
  assert.equal(wave[0].at, lib.SPORTS_BOARD_HOLD_MIN_MS);
  assert.equal(wave[1].at - wave[0].at, lib.SPORTS_CASCADE_STEP_MS);
  assert.equal(wave[2].at - wave[1].at, lib.SPORTS_CASCADE_STEP_MS);
  assert.ok(lib.sportsWaveStaggered(wave));
  const starts = new Set(wave.map((e) => e.at));
  assert.equal(starts.size, 4, 'aucun départ simultané');
});

test('kiosque.js réutilise la lib et la vague LE-RADAR', () => {
  const js = readFileSync(new URL('../packages/theme-radar/assets/kiosque.js', import.meta.url), 'utf8');
  const tpl = readFileSync(new URL('../packages/theme-radar/src/templates.ts', import.meta.url), 'utf8');
  assert.match(js, /KiosqueSportsBoard/);
  assert.match(js, /scheduleSportsWave/);
  assert.match(js, /SPORTS_CASCADE_STEP_MS/);
  assert.match(tpl, /sports-board-lib\.js/);
  const libSrc = readFileSync(fileURLToPath(new URL('../packages/theme-radar/assets/sports-board-lib.js', import.meta.url)), 'utf8');
  assert.match(libSrc, /var SPORTS_CASCADE_STEP_MS = 440/);
});
