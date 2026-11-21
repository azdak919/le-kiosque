import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('réglage ordre aléatoire, manifeste enrichi, lib de rotation LE-RADAR', () => {
  const model = read('packages/core/src/model.ts');
  assert.match(model, /randomOrder\?: boolean/);
  const cms = read('packages/pipeline/src/cms-config.ts');
  assert.match(cms, /name: 'randomOrder', label: 'Ordre aléatoire'/);
  const yml = read('examples/demo-journal/content/publication.yml');
  assert.match(yml, /randomOrder: true/);
  assert.match(yml, /- id: 13cc6735-b623-5a85-a5ec-5b3bc3d9f706/);
  assert.match(yml, /- id: 506eab88-88d1-5cfa-ae44-baf4fc0bb5c5/);
  assert.match(yml, /caption: "Le lac Témiscouata\."/);
  assert.match(yml, /credit: "Gabriel Picard"/);
  assert.doesNotMatch(yml, /caption: ".*[Cc]ampus/);
  const tpl = read('packages/theme-radar/src/templates.ts');
  assert.match(tpl, /randomOrder: settings.randomOrder !== false/);
  assert.match(tpl, /bg-rotation-lib\.js/);
  assert.match(tpl, /data-masthead-start/);
  const js = read('packages/theme-radar/assets/kiosque.js');
  assert.match(js, /function mastheadRandomOrder/);
  assert.match(js, /window\.BgRotation/);
  assert.match(js, /function preloadMastheadIndex/);
  assert.match(js, /shuffleBtn.hidden = images.length < 2/);
  const lib = read('packages/theme-radar/assets/bg-rotation-lib.js');
  assert.match(lib, /root\.BgRotation = api/);
});

test('le script de départ aléatoire est du JS valide (pas de regex // dans un gabarit)', () => {
  const tpl = read('packages/theme-radar/src/templates.ts');
  assert.match(tpl, /creditUrl\.indexOf\('https:\/\/'\)===0/);
  const start = tpl.indexOf('(function(){');
  const end = tpl.indexOf('})();', start);
  assert.ok(start >= 0 && end > start, 'script de départ présent');
  const body = tpl.slice(start, end + 5);
  assert.doesNotThrow(() => new Function(body));
});

