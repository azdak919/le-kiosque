import assert from 'node:assert/strict';
import test from 'node:test';

import { notesPaquet, nouveautes } from '../tools/notes-paquet.mjs';

const kiosqueLog = `# Journal

## Non publié
- Pas encore publié.
- Version 0.2.2 (corrections). Mât et pied de page revus.
- Site : le mât écrit le nom du journal.
  suite de la ligne.
- Version 0.2.1.
- Ancien.
`;

test('nouveautés : les puces sous « - Version X », jusqu’à la version suivante', () => {
  assert.deepEqual(nouveautes(kiosqueLog, '0.2.2'), [
    '- Version 0.2.2 (corrections). Mât et pied de page revus.',
    '- Site : le mât écrit le nom du journal. suite de la ligne.',
  ]);
  assert.deepEqual(nouveautes(kiosqueLog, '0.2.1'), ['- Ancien.']);
  assert.deepEqual(nouveautes(kiosqueLog, '9.9.9'), []);
});

test('notes du paquet : versions et deux parties pour la page Mise à jour', () => {
  const notes = notesPaquet({ kiosque: '0.2.2', socle: '1.2.3', kiosqueLog, socleLog: '- Version 1.2.3\n- Restauration en deux temps.\n', depot: 'a/b' });
  assert.match(notes, /^<!-- kiosque-paquet \{"kiosque":"0\.2\.2","socle":"1\.2\.3"\} -->/);
  assert.match(notes, /## Site Web du journal \(Kiosque 0\.2\.2\)\n- Version 0\.2\.2/);
  assert.match(notes, /## Espace de rédaction \(socle 1\.2\.3\)\n- Restauration en deux temps\./);
  assert.match(notes, /https:\/\/github\.com\/a\/b\/releases\/latest\/download\/kiosque-journal\.zip/);
  assert.match(notes, /https:\/\/votre-journal\.com\/redaction\//);
  assert.doesNotMatch(notes, /public_html\/journal\//);
  assert.match(notesPaquet({ kiosque: '0.2.2', socle: '1.2.3', kiosqueLog: '', socleLog: '', depot: 'a/b' }), /Corrections sans changement visible/);
});
