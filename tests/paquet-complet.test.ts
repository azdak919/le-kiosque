/**
 * Paquet complet : un seul ZIP « journal/ » avec la rédaction du socle et le
 * site vivant (coquille Kiosque dessinée depuis le socle de l'installation).
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';


const repo = path.resolve(import.meta.dirname, '..');

test('paquet complet : site vivant + rédaction dans journal/', () => {
  const out = path.join(mkdtempSync(path.join(tmpdir(), 'paquet-')), 'kiosque-journal.zip');
  const made = spawnSync(process.execPath, [path.join(repo, 'tools', 'paquet-complet.mjs'), '--sortie', out], { encoding: 'utf8' });
  assert.equal(made.status, 0, made.stderr);
  // `unzip` (Info-ZIP) est présent sur les machines de CI comme chez nous.
  const names = spawnSync('unzip', ['-Z1', out], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  const read = (name: string) => spawnSync('unzip', ['-p', out, name], { encoding: 'utf8' }).stdout;
  const files = new Set(names);
  for (const name of ['journal/index.php', 'journal/.htaccess', 'journal/admin/assets/admin.js', 'journal/site/index.html', 'journal/site/404.html',
    'journal/site/kiosque-vivant.json', 'journal/site/assets/editorial/front.js', 'journal/site/assets/editorial/public-backend.js', 'journal/paquet.json']) {
    assert.ok(files.has(name), `${name} manque`);
  }
  for (const name of names) {
    assert.ok(!/^journal\/site\/(admin\/|feed\.xml|robots\.txt|assets\/editorial\/(sql-wasm|demo-backend|admin\.js))/.test(name), `${name} n'a rien à faire dans le site`);
  }
  const home = read('journal/site/index.html');
  assert.match(home, /"mode":"socle-vivant"/);
  assert.doesNotMatch(home, /feed\.xml|lequorum|Saint-Louis/);
  const paquet = JSON.parse(read('journal/paquet.json'));
  assert.equal(paquet.fichier, 'kiosque-journal.zip');
});
