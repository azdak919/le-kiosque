/**
 * Paquet complet : un seul dossier kiosque-journal/ (compatible avec
 * l'installateur 0.2.1), à déposer par son contenu à la racine du domaine,
 * avec la rédaction de Le Socle et le site vivant.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const repo = path.resolve(import.meta.dirname, '..');
const WRAP = 'kiosque-journal';
const INSTALLER = path.join(repo, 'tests/fixtures/installateur-0.2.1/installer.php');
const hasPhp = spawnSync('bash', ['-lc', 'command -v php'], { encoding: 'utf8' }).status === 0;

function makePaquet(): { out: string; names: string[]; read: (name: string) => string } {
  const out = path.join(mkdtempSync(path.join(tmpdir(), 'paquet-')), 'kiosque-journal.zip');
  const made = spawnSync(process.execPath, [path.join(repo, 'tools', 'paquet-complet.mjs'), '--sortie', out], { encoding: 'utf8' });
  assert.equal(made.status, 0, made.stderr);
  const names = spawnSync('unzip', ['-Z1', out], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  const read = (name: string) => spawnSync('unzip', ['-p', out, name], { encoding: 'utf8' }).stdout;
  return { out, names, read };
}

test('paquet complet : un dossier kiosque-journal/, site vivant et rédaction', () => {
  const { names, read } = makePaquet();
  const files = new Set(names);
  const roots = new Set(names.map((name) => name.split('/')[0]));
  assert.deepEqual([...roots], [WRAP], 'le ZIP a un seul dossier de premier niveau');
  for (const name of [
    `${WRAP}/index.php`, `${WRAP}/.htaccess`, `${WRAP}/admin/assets/admin.js`,
    `${WRAP}/site/index.html`, `${WRAP}/site/404.html`, `${WRAP}/site/kiosque-vivant.json`,
    `${WRAP}/site/assets/editorial/front.js`, `${WRAP}/site/assets/editorial/public-backend.js`,
    `${WRAP}/paquet.json`, `${WRAP}/INSTALLER-A-LA-RACINE.txt`, `${WRAP}/LISEZMOI.txt`,
  ]) {
    assert.ok(files.has(name), `${name} manque`);
  }
  assert.ok(!files.has('index.php'), 'les fichiers ne sont pas à la racine du ZIP');
  assert.ok(!files.has('journal/index.php'), 'le dossier enveloppant n’est plus journal/');
  for (const name of names) {
    assert.ok(!/^kiosque-journal\/site\/(admin\/|robots\.txt|assets\/editorial\/(sql-wasm|demo-backend|admin\.js))/.test(name), `${name} n'a rien à faire dans le site`);
  }
  const home = read(`${WRAP}/site/index.html`);
  assert.match(home, /"mode":"socle-vivant"/);
  assert.doesNotMatch(home, /lequorum|Saint-Louis/);
  const lisezmoi = read(`${WRAP}/LISEZMOI.txt`);
  assert.match(lisezmoi, /\/redaction\//);
  assert.match(lisezmoi, /CONTENU de ce dossier/);
  assert.doesNotMatch(lisezmoi, /public_html\/journal\/|www\/journal\//);
  const marqueur = read(`${WRAP}/INSTALLER-A-LA-RACINE.txt`);
  assert.match(marqueur, /racine du site/);
  const paquet = JSON.parse(read(`${WRAP}/paquet.json`));
  assert.equal(paquet.fichier, 'kiosque-journal.zip');
});

test('mise à jour depuis l’installateur 0.2.1 (Socle 1.2.2) vers le paquet actuel', {
  skip: !hasPhp && !process.env.CI ? 'php absent' : false,
}, () => {
  const { out } = makePaquet();
  const dest = path.join(mkdtempSync(path.join(tmpdir(), 'journal-021-')), 'site');
  mkdirSync(path.join(dest, 'donnees'), { recursive: true });
  mkdirSync(path.join(dest, 'site'), { recursive: true });
  writeFileSync(path.join(dest, 'index.php'), "<?php echo '0.2.1';");
  writeFileSync(path.join(dest, 'donnees', 'articles.txt'), 'mes-articles');
  const unpack = spawnSync('php', [INSTALLER, 'unpack', out], { encoding: 'utf8' });
  assert.equal(unpack.status, 0, unpack.stderr);
  const names: string[] = JSON.parse(unpack.stdout);
  assert.ok(names.includes('index.php'), 'l’installateur 0.2.1 lit le ZIP');
  assert.ok(names.includes('paquet.json'));
  assert.ok(names.includes('php/src/bootstrap.php'));
  assert.ok(!names.some((n) => n.startsWith('kiosque-journal/')), 'le dossier enveloppant est retiré');
  assert.ok(!names.some((n) => n.startsWith('donnees/')));
  const applied = spawnSync('php', [INSTALLER, 'apply', out, dest], { encoding: 'utf8' });
  assert.equal(applied.status, 0, applied.stderr + applied.stdout);
  assert.match(readFileSync(path.join(dest, 'index.php'), 'utf8'), /php/);
  assert.equal(readFileSync(path.join(dest, 'donnees', 'articles.txt'), 'utf8'), 'mes-articles');
  assert.ok(!existsSync(path.join(dest, WRAP)), 'rien n’est écrit dans un sous-dossier kiosque-journal/');
  assert.ok(existsSync(path.join(dest, 'php', 'src', 'bootstrap.php')));
  assert.ok(existsSync(path.join(dest, 'site', 'index.html')));
  assert.ok(existsSync(path.join(dest, 'paquet.json')));
});
