import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'packages/theme-radar/assets/kiosque.js'), 'utf8');

test('KiosqueRefreshMasthead relance la météo après applyBranding', () => {
  const refresh = source.match(/function refreshMastheadStatus\(\) \{[\s\S]*?\n  \}/);
  assert.ok(refresh, 'refreshMastheadStatus est défini');
  assert.match(refresh[0], /initMastheadWeather\s*\(/);
  assert.match(refresh[0], /initMastheadSports\s*\(/);
});

test('initMastheadWeather ne repeint pas deux fois les mêmes localités', () => {
  const init = source.match(/function initMastheadWeather\(\) \{[\s\S]*?\n  \}/);
  assert.ok(init, 'initMastheadWeather est défini');
  assert.match(init[0], /dataset\.weatherReady/);
  assert.match(init[0], /weather-chip/);
});
