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
  await writeFile(rep, JSON.stringify({ nom: 'Le Test', etablissement: 'Cégep du Test', couleur: '#005a78', sections: 'Actualités, Sports, Vie étudiante', type: '4', dossier: cible, adresse: 'http://localhost:8080/sous', motdepasse: 'secret' }));

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
  // Même noyau que le configurateur web : couleur et sections appliquées.
  assert.match(await readFile(path.join(kit, 'journal/theme/tokens.css'), 'utf8'), /--accent: #005a78;/);
  assert.match(await readFile(path.join(kit, 'journal/content/sections/vie-etudiante.yml'), 'utf8'), /name: "Vie étudiante"/);
  assert.match(await readFile(path.join(kit, 'journal/content/publication.yml'), 'utf8'), /institution: "Cégep du Test"/);
});

test('installateur : reprend un kiosque-config.json exporté par le configurateur', async () => {
  const K = await import(path.join(REPO, 'packages/config-core/kiosque-config.mjs'));
  const kit = await mkdtemp(path.join(os.tmpdir(), 'kiosque-kit-'));
  await mkdir(path.join(kit, 'outils'));
  await cp(path.join(REPO, 'tools/kit/installer.mjs'), path.join(kit, 'outils/installer.mjs'));
  await cp(path.join(REPO, 'template'), path.join(kit, 'journal'), { recursive: true });
  await symlink(path.join(REPO, 'packages'), path.join(kit, 'packages'));
  await symlink(path.join(REPO, 'node_modules'), path.join(kit, 'node_modules'));
  const c = K.completer({ name: 'La Gazette du Nord', institution: 'Cégep du Nord', accent: '#8a1538', sections: 'Nouvelles\nArts' });
  await writeFile(path.join(kit, 'kiosque-config.json'), JSON.stringify(K.exporter(c)));
  const cible = path.join(kit, 'publie');
  const rep = path.join(kit, 'rep.json');
  await writeFile(rep, JSON.stringify({ type: '4', dossier: cible, adresse: 'http://localhost:8080' }));
  const r = spawnSync(process.execPath, [path.join(kit, 'outils/installer.mjs')], { env: { ...process.env, KIOSQUE_REPONSES: rep }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(await readFile(path.join(cible, 'index.html'), 'utf8'), /La Gazette du Nord/);
  assert.match(await readFile(path.join(kit, 'journal/theme/tokens.css'), 'utf8'), /--accent: #8a1538;/);
  assert.match(await readFile(path.join(kit, 'journal/content/sections/arts.yml'), 'utf8'), /name: "Arts"/);
});
