/**
 * Kit portable : l'installateur publie dans un dossier local sans réseau, et
 * son fichier de reprise ne contient jamais de mot de passe.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

test('installateur : dossier local, reprise sans mot de passe', async () => {
  const kit = await mkdtemp(path.join(os.tmpdir(), 'kiosque-kit-'));
  await mkdir(path.join(kit, 'outils'));
  await cp(path.join(REPO, 'tools/kit/installer.mjs'), path.join(kit, 'outils/installer.mjs'));
  await cp(path.join(REPO, 'template'), path.join(kit, 'journal'), { recursive: true });
  await symlink(path.join(REPO, 'packages'), path.join(kit, 'packages'));
  await symlink(path.join(REPO, 'node_modules'), path.join(kit, 'node_modules'));
  const cible = path.join(kit, 'publie');
  const rep = path.join(kit, 'rep.json');
  await writeFile(rep, JSON.stringify({ nom: 'Le Test', type: '4', dossier: cible, adresse: 'http://localhost:8080/sous', motdepasse: 'secret' }));

  const r = spawnSync(process.execPath, [path.join(kit, 'outils/installer.mjs')], {
    env: { ...process.env, KIOSQUE_REPONSES: rep },
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const html = await readFile(path.join(cible, 'index.html'), 'utf8');
  assert.match(html, /Le Test/);
  assert.match(html, /href="\/sous\/assets\//);
  const etat = await readFile(path.join(kit, 'journal/installation-kiosque.json'), 'utf8');
  assert.equal(Object.keys(JSON.parse(etat).etapes).length, 5);
  assert.doesNotMatch(etat, /secret|motdepasse/);
});
