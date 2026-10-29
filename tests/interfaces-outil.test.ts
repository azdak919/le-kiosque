/** Interfaces d'outil : vitrine, configurateur et administration partagent la feuille Tailwind + Basecoat. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('vitrine et configurateur chargent kiosque-ui.css, pas le thème du journal', async () => {
  for (const f of ['site/index.html', 'site/configurer/index.html']) {
    const html = await readFile(f, 'utf8');
    assert.match(html, /assets\/kiosque-ui\.css/);
    assert.ok(!/assets\/theme\.css/.test(html), `${f} ne doit pas dépendre du thème du journal`);
  }
  const css = await readFile('site/assets/kiosque-ui.css', 'utf8');
  assert.match(css, /\.btn/);
});

test('l’administration compilée vient de ui/admin.css et les crédits sont présents', async () => {
  const css = await readFile('packages/theme-radar/assets/editorial/admin.css', 'utf8');
  assert.match(css, /\.admin-sidebar/);
  const credits = await readFile('THIRD_PARTY.md', 'utf8');
  assert.match(credits, /Basecoat/);
  assert.match(credits, /Tailwind/);
});
