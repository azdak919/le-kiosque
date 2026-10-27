/** Extension WordPress : fichiers présents, blueprint valide, cohérence avec le noyau. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import * as K from '../packages/config-core/kiosque-config.mjs';

const R = path.resolve(fileURLToPath(new URL('..', import.meta.url)), 'wordpress');

test('extension : en-tête, importeur réversible, rôles du noyau', async () => {
  const main = await readFile(path.join(R, 'le-kiosque/le-kiosque.php'), 'utf8');
  assert.match(main, /Plugin Name:\s+Le Kiosque/);
  const imp = await readFile(path.join(R, 'le-kiosque/includes/importeur.php'), 'utf8');
  assert.match(imp, /function annuler/);
  for (const r of K.ROLES) assert.match(imp, new RegExp(r.slug));
  assert.doesNotMatch(imp + main, /tison/i);
});

test('blueprint et exemple sont lisibles par le noyau', async () => {
  const bp = JSON.parse(await readFile(path.join(R, 'blueprint.json'), 'utf8'));
  assert.ok(bp.steps.some((s: { step: string }) => s.step === 'installPlugin'));
  const c = K.importer(await readFile(path.join(R, 'exemple-kiosque-config.json'), 'utf8'));
  assert.equal(c.name, 'La Gazette du Nord');
});
