import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('météo du téléphone : prévisions du jour et de demain dans le même appel Open-Meteo', () => {
  const js = read('packages/theme-radar/assets/kiosque.js');
  assert.equal(js.match(/api\.open-meteo\.com\/v1\/forecast/g)?.length, 1, 'un seul appel de prévisions');
  assert.match(js, /&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=2/);
  assert.match(js, /kiosque-weather:v3:/, 'ancien cache sans prévisions ignoré');
  assert.match(js, /appendWeatherExtras\(wait, null, ''\)/, 'la puce d’attente a le même gabarit');
  assert.match(js, /function weatherFetch\(url\)/, 'Open-Meteo muet : abandon après un délai');
  const css = read('packages/theme-radar/assets/theme.css');
  assert.match(css, /\.weather-chip__today,\n\.weather-chip__tomorrow \{ display: none; \}/, 'prévisions cachées hors dock et hors mât bureau');
  assert.match(css, /\.masthead-weather-dock \.weather-chip__today,\n\.masthead-weather-dock \.weather-chip__tomorrow \{/, 'dock : max/min et demain visibles');
  assert.match(css, /\.masthead-utility > \.masthead-status:not\(\.masthead-status--docked\) \.weather-chip__today,/, 'bureau : max/min et demain dans le mât');
  assert.match(css, /@media \(max-width: 1099\.98px\) \{[\s\S]*\.masthead-status:not\(\.masthead-status--docked\)/, 'sous 1100 px la puce quitte le mât');
  assert.match(css, /\.masthead-weather-dock \.masthead-weather \{ display: grid !important; grid-template-columns: 1fr;/);
  const jsDock = read('packages/theme-radar/assets/kiosque.js');
  assert.match(jsDock, /max-width: 1099\.98px/, 'le dock suit le palier de colonne 1100 px');
  assert.match(jsDock, /dans le mât, à côté de la date/);
  assert.doesNotMatch(jsDock, /Toujours sous la radio \(ordinateur comme téléphone\)/);
});

test('mât illustré : pas de pastille de crédit vide ; crédit et licence comme dans la rotation', () => {
  const css = read('packages/theme-radar/assets/theme.css');
  assert.match(css, /\.masthead-photo-credit:empty \{ display: none; \}/);
  const live = read('packages/theme-radar/assets/editorial/render.js');
  assert.match(live, /const label = `Photo : \$\{images\[0\]\.credit\}\$\{images\[0\]\.license \? ` \(\$\{images\[0\]\.license\}\)` : ''\}`;/);
});

test('mât mobile : boutons également espacés, crédit sous les outils, sports hors du mât', () => {
  const css = read('packages/theme-radar/assets/theme.css');
  assert.match(css, /justify-content: space-between;/);
  assert.match(css, /padding-bottom: 34px/);
  assert.match(css, /\.masthead:has\(\.masthead-photo-credit:not\(:empty\)\) \.masthead-photo-credit \{[\s\S]*?bottom: var\(--mat-gap\);/);
  assert.match(css, /\.masthead-sports-strip\[hidden\]:not\(\.is-empty\)/);
  assert.match(css, /min-height: 60px/);
  const tpl = read('packages/theme-radar/src/templates.ts');
  assert.match(tpl, /id="masthead-sports-strip"/);
  assert.match(tpl, /sportsStripHtml\(ctx\)/);
  const js = read('packages/theme-radar/assets/kiosque.js');
  assert.match(js, /function syncSportsStripVisibility/);
  assert.match(js, /#masthead-sports-strip/);
});
