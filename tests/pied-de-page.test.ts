import assert from 'node:assert/strict';
import test from 'node:test';

import { footBuiltHtml, footCopyright, footRights, footYears, KIOSQUE_SITE_URL } from '../packages/theme-radar/src/templates.ts';
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
    assert.match(f('CC BY-NC-ND 4.0'), /<a href="https:\/\/creativecommons\.org\/licenses\/by-nc-nd\/4\.0\/deed\.fr" rel="license noopener" class="site-foot__license">CC BY-NC-ND 4\.0<\/a>/);
    assert.match(f('CC-BY-SA-4.0'), /<span class="site-foot__license">CC-BY-SA-4\.0<\/span>/);
    assert.match(f('CC BY-SA 4.0'), /<span class="site-foot__license">CC BY-SA 4\.0<\/span>/);
  }
  const pub = { name: 'La Vigie', founded: '1998' };
  assert.equal(footCopyright(pub, 2026), '© 1998–2026 La Vigie. Tous droits réservés.');
  assert.equal(footCopyright({ name: 'La <b>' }, 2026), '© 2026 La &lt;b&gt;. Tous droits réservés.');
  assert.equal(KIOSQUE_SITE_URL, 'https://kiosque.le-radar.ca/');
  assert.match(live, /const KIOSQUE_SITE_URL = 'https:\/\/kiosque\.le-radar\.ca\/'/);
  assert.doesNotMatch(live, /github\.io\/le-kiosque/);
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


test('pied de page : lien discret « Espace de rédaction » après Propulsé par, sans logo', () => {
  const root = footBuiltHtml('/redaction/');
  const nested = footBuiltHtml('/journal/redaction/');
  assert.match(root, /Propulsé par/);
  assert.match(root, /href="\/redaction\/"/);
  assert.match(nested, /href="\/journal\/redaction\/"/);
  assert.match(root, /Espace de rédaction/);
  assert.ok(root.indexOf('Propulsé par') < root.indexOf('Espace de rédaction'));
  assert.doesNotMatch(root, /<img\b/);
  const templates = readFileSync(new URL('../packages/theme-radar/src/templates.ts', import.meta.url), 'utf8');
  assert.match(templates, /footBuiltHtml\(ctx\.redactionHref \?\? asset\('\/redaction\/', ctx\)\)/);
  assert.match(live, /link\(base, '\/redaction\/'\)/);
  assert.match(live, /Espace de rédaction/);
  assert.doesNotMatch(live, /site-foot__built[\s\S]{0,200}<img/);
});

test('démo de la vitrine : le pied pointe vers /admin/, les journaux gardent /redaction/', () => {
  const templates = readFileSync(new URL('../packages/theme-radar/src/templates.ts', import.meta.url), 'utf8');
  const site = readFileSync(new URL('../tools/build-site.mjs', import.meta.url), 'utf8');
  assert.match(site, /redactionHref: withBase\(basePath, '\/admin\/'\)/);
  assert.match(site, /mode: 'demo-local'/);
  assert.match(site, /demoContent: true/);
  assert.match(templates, /ctx\.redactionHref \?\? asset\('\/redaction\/', ctx\)/);
  assert.match(templates, /ctx\.redactionHref \?\? `\$\{ctx\.basePath\}\/admin`/);
  assert.match(live, /mode === 'demo-local' && editorial\.adminBasePath/);
  assert.match(live, /link\(base, '\/redaction\/'\)/);
  assert.doesNotMatch(site, /demo\/redaction/);
});

test('pied mobile : le « · » de « Espace de rédaction » est masqué comme les autres', () => {
  const css = readFileSync(new URL('../packages/theme-radar/assets/theme.css', import.meta.url), 'utf8');
  assert.match(css, /\.site-foot__built \.site-foot__sep \{ display: none; \}/);
  assert.match(css, /\.site-foot__license \{ white-space: nowrap; \}/);
});
