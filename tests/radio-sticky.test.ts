import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('barre radio collante : mêmes repères que LE-RADAR, seulement si elle est activée', () => {
  const css = read('packages/theme-radar/assets/theme.css');
  assert.match(css, /body\.with-radio \.radar-radio-slot:not\(\[data-radar-radio\]\),\nbody\.with-radio \.radar-radio-slot\[data-radar-radio="ready"\] \{\n  position: sticky;/);
  assert.match(css, /top: var\(--demo-banner-sticky-h, 0px\);/);
  assert.match(css, /z-index: 100;/);
  assert.match(css, /top: env\(safe-area-inset-top, 0px\);/);
  assert.match(css, /scroll-margin-top: calc\(var\(--demo-banner-sticky-h, 0px\) \+ var\(--radio-sticky-h, 5\.5rem\) \+ 8px\);/);
  // Sans with-radio, l'emplacement n'est pas sticky.
  const slotBase = css.slice(css.indexOf('.radar-radio-slot { display: none; }'), css.indexOf('body.with-radio .radar-radio-slot'));
  assert.doesNotMatch(slotBase, /position:\s*sticky/);
  const js = read('packages/theme-radar/assets/kiosque.js');
  assert.match(js, /function syncRadioStickyOffset/);
  assert.match(js, /--radio-sticky-h/);
});
