import assert from 'node:assert/strict';
import test from 'node:test';

import { footCopyright, footRights, footYears, KIOSQUE_SITE_URL } from '../packages/theme-radar/src/templates.ts';
import { readFileSync } from 'node:fs';

// render.js (site vivant) importe des fichiers copiés au build : on le lit comme texte.
const live = readFileSync(new URL('../packages/theme-radar/assets/editorial/render.js', import.meta.url), 'utf8');

test('pied de page : année courante, ou fondation–année courante', () => {
  for (const f of [footYears]) {
    assert.equal(f(undefined, 2026), '2026');
    assert.equal(f('', 2026), '2026');
    assert.equal(f('1998', 2026), '1998–2026');
    assert.equal(f('2026', 2026), '2026');
    assert.equal(f('depuis 1971', 2026), '1971–2026');
  }
});

test('pied de page : « Tous droits réservés » par défaut, CC BY-NC-ND 4.0 avec son lien', () => {
  for (const f of [footRights]) {
    assert.equal(f(undefined), 'Tous droits réservés.');
    assert.equal(f('Tous droits réservés'), 'Tous droits réservés.');
    assert.match(f('CC BY-NC-ND 4.0'), /<a href="https:\/\/creativecommons\.org\/licenses\/by-nc-nd\/4\.0\/deed\.fr" rel="license noopener">CC BY-NC-ND 4\.0<\/a>/);
  }
  const pub = { name: 'La Vigie', founded: '1998' };
  assert.equal(footCopyright(pub, 2026), '© 1998–2026 La Vigie. Tous droits réservés.');
  assert.equal(footCopyright({ name: 'La <b>' }, 2026), '© 2026 La &lt;b&gt;. Tous droits réservés.');
  assert.equal(KIOSQUE_SITE_URL, 'https://azdak919.github.io/le-kiosque/');
});

test('site vivant : même pied de page, logo à la place du nom, licence sur les cartes', () => {
  assert.match(live, /export function footCopyright\(publication, year\)/);
  assert.match(live, /footCopyright\(publication, new Date\(\)\.getFullYear\(\)\)/);
  assert.match(live, /creativecommons\.org\/licenses\/by-nc-nd\/4\.0\/deed\.fr/);
  assert.match(live, /paintWordmark\(node, publication\)/);
  assert.match(live, /wordmark-name/);
  assert.match(live, /usablePublicationLogo/);
  assert.match(live, /license: lead\.license,/);
  assert.doesNotMatch(live, /Contenus sous licence \$\{esc\(publication\.license\)\}, sauf mention contraire/);
});

