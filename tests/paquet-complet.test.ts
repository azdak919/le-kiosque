/**
 * Paquet complet : un seul ZIP, fichiers à la racine (à déposer à la racine
 * du domaine), avec la rédaction de Le Socle et le site vivant (coquille
 * Kiosque dessinée depuis le Socle de l'installation).
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';


const repo = path.resolve(import.meta.dirname, '..');

test('paquet complet : site vivant + rédaction à la racine du ZIP', () => {
  const out = path.join(mkdtempSync(path.join(tmpdir(), 'paquet-')), 'kiosque-journal.zip');
  const made = spawnSync(process.execPath, [path.join(repo, 'tools', 'paquet-complet.mjs'), '--sortie', out], { encoding: 'utf8' });
  assert.equal(made.status, 0, made.stderr);
  // `unzip` (Info-ZIP) est présent sur les machines de CI comme chez nous.
  const names = spawnSync('unzip', ['-Z1', out], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  const read = (name: string) => spawnSync('unzip', ['-p', out, name], { encoding: 'utf8' }).stdout;
  const files = new Set(names);
  for (const name of ['index.php', '.htaccess', 'admin/assets/admin.js', 'site/index.html', 'site/404.html',
    'site/kiosque-vivant.json', 'site/assets/editorial/front.js', 'site/assets/editorial/public-backend.js', 'paquet.json']) {
    assert.ok(files.has(name), `${name} manque`);
  }
  assert.ok(!files.has('journal/index.php'), 'le ZIP ne doit plus envelopper les fichiers dans journal/');
  for (const name of names) {
    assert.ok(!/^site\/(admin\/|robots\.txt|assets\/editorial\/(sql-wasm|demo-backend|admin\.js))/.test(name), `${name} n'a rien à faire dans le site`);
  }
  const home = read('site/index.html');
  assert.match(home, /"mode":"socle-vivant"/);
  assert.doesNotMatch(home, /lequorum|Saint-Louis/);
  const lisezmoi = read('LISEZMOI.txt');
  assert.match(lisezmoi, /\/redaction\//);
  assert.doesNotMatch(lisezmoi, /public_html\/journal\/|www\/journal\//);
  const paquet = JSON.parse(read('paquet.json'));
  assert.equal(paquet.fichier, 'kiosque-journal.zip');
});
