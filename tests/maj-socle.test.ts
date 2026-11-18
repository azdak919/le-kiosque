/** Mise à jour du socle en un clic : sauvegarde d'abord, retour possible. */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { plan, readPin, update } from '../tools/maj-socle.mjs';
import { updatePage } from '../packages/theme-radar/src/update-page.ts';
import { SOCLE_COMMIT, socleUpdateAction } from '../packages/theme-radar/src/local-admin.ts';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);

function journal(pin: string): string {
  const root = mkdtempSync(path.join(tmpdir(), 'kiosque-maj-socle-'));
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ dependencies: { 'le-socle': `github:azdak919/le-socle#${pin}` } }));
  return root;
}
const fakeInstall = (root: string, calls: string[]) => (spec: string) => {
  calls.push(spec);
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  pkg.dependencies['le-socle'] = spec;
  writeFileSync(path.join(root, 'package.json'), JSON.stringify(pkg));
};

test('le Kiosque épingle le socle sur un commit précis', () => {
  assert.match(String(SOCLE_COMMIT), /^[0-9a-f]{40}$/);
  assert.equal(readPin({ dependencies: { 'le-socle': `github:azdak919/le-socle#${A}` } }), A);
  assert.equal(readPin({ dependencies: { 'le-socle': 'github:azdak919/le-socle#main' } }), null, 'une branche n’est pas une version');
  assert.throws(() => plan(A, 'main'));
  assert.deepEqual(plan(A, A), { change: false });
});

test('appliquer : la sauvegarde est écrite avant, puis le commit est épinglé ; revenir remet celui d’avant', () => {
  const root = journal(A);
  try {
    const calls: string[] = [];
    const step = update(root, B, { install: fakeInstall(root, calls), now: new Date('2026-11-18T09:00:00Z') });
    assert.equal(step.backup, 'sauvegardes/socle-aaaaaaa-vers-bbbbbbb.json');
    const backup = JSON.parse(readFileSync(path.join(root, step.backup), 'utf8'));
    assert.equal(backup.avant.commit, A);
    assert.equal(backup.revenir, `node tools/maj-socle.mjs ${A}`);
    assert.equal(readPin(JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))), B);
    // Retour en arrière : le commit d'avant, noté dans la sauvegarde.
    update(root, backup.avant.commit, { install: fakeInstall(root, calls) });
    assert.equal(readPin(JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))), A);
    assert.ok(existsSync(path.join(root, 'sauvegardes/socle-bbbbbbb-vers-aaaaaaa.json')));
    assert.deepEqual(calls, [`github:azdak919/le-socle#${B}`, `github:azdak919/le-socle#${A}`]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('sans sauvegarde possible, rien ne change', () => {
  const root = journal(A);
  try {
    writeFileSync(path.join(root, 'sauvegardes'), 'un fichier, pas un dossier');
    const calls: string[] = [];
    assert.throws(() => update(root, B, { install: fakeInstall(root, calls) }));
    assert.equal(calls.length, 0, 'pas d’installation sans sauvegarde');
    assert.equal(readPin(JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))), A);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('le workflow propose une pull request, sans force ni réécriture', () => {
  const wf = readFileSync('.github/workflows/maj-socle.yml', 'utf8');
  assert.match(wf, /workflow_dispatch:/);
  assert.match(wf, /node tools\/maj-socle\.mjs "\$CIBLE"/, 'le commit demandé passe par une variable, pas dans le script');
  assert.match(wf, /tools\/proposer-maj\.sh/);
  assert.doesNotMatch(wf, /--force|-f origin|gh pr merge/);
  const proposer = readFileSync('tools/proposer-maj.sh', 'utf8');
  assert.match(proposer, /gh pr create --repo "\$REPO"/, 'la PR vise le dépôt du journal, pas l’amont');
  assert.match(proposer, /gh issue create --repo "\$REPO"/, 'l’issue vise le dépôt du journal, pas l’amont');
  assert.match(proposer, /gh pr create/);
  assert.match(proposer, /gh issue create/, 'si GitHub interdit la pull request, une issue donne le lien en un clic');
  assert.match(proposer, /compare\/main\.\.\./);
  assert.match(wf, /npm run kiosque -- build/, 'le journal doit se construire avant la proposition');
});

test('la page Mise à jour montre le commit et le bouton qui propose la nouvelle version', () => {
  const action = socleUpdateAction('gazette/journal');
  assert.equal(action, 'https://github.com/gazette/journal/actions/workflows/maj-socle.yml');
  assert.equal(socleUpdateAction('organisation/depot'), null, 'pas de lien vers un dépôt d’exemple');
  const lines = [{ id: 'socle' as const, title: 'Socle', installed: '1.0.0', offered: null, notes: '', commit: A, actionHref: action }];
  const html = updatePage({ lang: 'fr-CA', publicationName: 'La Gazette', backHref: '/admin/', mode: 'git-sveltia', lines });
  assert.match(html, /Commit épinglé<\/dt><dd><code>aaaaaaa<\/code>/);
  assert.match(html, /href="https:\/\/github\.com\/gazette\/journal\/actions\/workflows\/maj-socle\.yml"[^>]*>Proposer la dernière version du socle/);
  assert.match(html, /Revert/);
  const demo = updatePage({ lang: 'fr-CA', publicationName: 'Le Quorum', backHref: '/admin/', mode: 'demo-local', lines });
  assert.doesNotMatch(demo, /data-propose/, 'la démo ne lance rien');
});
