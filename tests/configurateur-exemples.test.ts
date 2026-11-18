import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as K from '../packages/config-core/kiosque-config.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

test('configurateur : exemples pâles en placeholder, aucune valeur préremplie', async () => {
  const html = await readFile(path.join(ROOT, 'site/configurer/index.html'), 'utf8');
  const js = await readFile(path.join(ROOT, 'site/configurer/configurateur.js'), 'utf8');
  for (const key of ['name', 'institution', 'slug', 'region', 'founded', 'logoAlt', 'contact', 'quiPublie', 'weatherLocalities']) {
    const input = html.match(new RegExp(`<input data-key="${key}"[^>]*>`))?.[0] || '';
    assert.match(input, /placeholder="[^"]+"/, `exemple pour ${key}`);
    assert.doesNotMatch(input, /\svalue=/, `aucune valeur pour ${key}`);
  }
  for (const example of ['La Vigie', 'Cégep de Sainte-Foy', 'redaction@exemple.ca']) assert.ok(html.includes(`placeholder="${example}"`), example);
  // Les sections proposées sont un exemple ; on les reprend seulement d'un clic.
  assert.match(js, /\n  sections: '',\n/);
  assert.match(js, /\$\('config-sections'\)\.placeholder = K\.SECTIONS_PROPOSEES/);
  assert.match(html, /id="sections-proposees"/);
  // Le nom ne recopie plus en douce le nom court ni le texte alternatif.
  assert.doesNotMatch(js, /state\.logoAlt = state\.name/);
});

test('configurateur : texte alternatif et nom court vides sont déduits du nom', () => {
  const c = K.completer({ name: 'La Vigie', institution: 'Cégep de Sainte-Foy', sections: 'Campus' });
  assert.equal(c.logoAlt, 'La Vigie');
  assert.equal(c.slug, 'la-vigie');
});
