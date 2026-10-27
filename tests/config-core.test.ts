/**
 * Noyau commun du configurateur web et du kit portable (t344u) : défauts,
 * validation, export WordPress et aller-retour exporter → importer.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import * as K from '../packages/config-core/kiosque-config.mjs';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

test('quatre essentiels seulement, le reste a un défaut', () => {
  assert.deepEqual(K.ESSENTIELS.map((q) => q.cle), ['name', 'institution', 'accent', 'sections']);
  assert.ok(K.ETAPES.length >= 3 && K.ETAPES.length <= 5);
  const c = K.completer({ name: 'L’Écho', institution: 'Cégep X', accent: '#005a78', sections: 'Actualités\nSports' });
  assert.equal(c.slug, 'l-echo');
  assert.equal(c.radioEnabled, true);
  assert.ok(K.contraste(c.accentDark, '#0e0f12') >= 4.5, 'couleur sombre lisible calculée');
  for (const q of K.ESSENTIELS) assert.ok(q.ou, `${q.cle} dit où trouver la réponse`);
});

test('validation : messages en français, étape bloquée tant que l’essentiel manque', () => {
  assert.equal(K.erreursEtape(1, { name: '', institution: 'X' }).length, 1);
  assert.equal(K.erreursEtape(1, { name: 'A', institution: 'X' }).length, 0);
  assert.match(K.valider('accent', 'rouge') ?? '', /#rrggbb/);
  assert.match(K.valider('sections', '  \n ') ?? '', /au moins une/);
});

test('exporter → importer : aller-retour sans perte des essentiels', () => {
  const c = K.completer({ name: 'La Gazette', institution: 'Cégep du Nord', accent: '#8a1538', sections: 'Nouvelles | nouv | Les nouvelles\nArts' });
  const json = K.exporter(c);
  assert.equal(json.format, 'kiosque-config');
  assert.deepEqual(json.roles.map((r) => r.nom), ['Journaliste', 'Chef de pupitre', 'Rédacteur en chef']);
  assert.deepEqual(json.pages.map((p) => p.titre), ['Équipe', 'À propos', 'Politique de correction', 'Déontologie']);
  const back = K.importer(JSON.stringify(json));
  assert.equal(back.name, 'La Gazette');
  assert.equal(back.accent, '#8a1538');
  assert.deepEqual(K.lireSections(back.sections).map((s) => s.slug), ['nouv', 'arts']);
  assert.throws(() => K.importer('{"format":"autre"}'), /kiosque-config/);
});

test('le configurateur web et le kit importent le même noyau', async () => {
  const web = await readFile(path.join(ROOT, 'site/configurer/configurateur.js'), 'utf8');
  const kit = await readFile(path.join(ROOT, 'tools/kit/installer.mjs'), 'utf8');
  assert.match(web, /from '\.\/kiosque-config\.mjs'/);
  assert.match(kit, /config-core', 'kiosque-config\.mjs'/);
  assert.match(kit, /K\.ESSENTIELS/);
});
