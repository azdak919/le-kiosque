/**
 * Notes de la Release du paquet complet : ce que lit la page Mise à jour de la
 * rédaction (socle, php/src/admin.php, socle_paquet_page).
 *
 *  - une ligne `<!-- kiosque-paquet {"kiosque":"X","socle":"Y"} -->` : les
 *    versions des deux parties ;
 *  - « ## Site Web du journal (Kiosque X) » : les nouveautés de cette version,
 *    prises dans CHANGELOG.md sous la ligne « - Version X » ;
 *  - « ## Espace de rédaction (socle Y) » : de même dans le CHANGELOG.md du
 *    socle épinglé (node_modules/le-socle).
 *
 * Usage : node tools/notes-paquet.mjs [dépôt] > notes.md
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

/** Entrées d'une version : les puces sous « - Version X », jusqu'à la version suivante. */
export function nouveautes(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^- Version ${version.replaceAll('.', '\\.')}\\b`).test(line));
  if (start < 0) return [];
  // La ligne « - Version X (…). Socle épinglé… » porte souvent le résumé de la version.
  const items = /\.\s+\S/.test(lines[start]) ? [lines[start]] : [];
  for (const line of lines.slice(start + 1)) {
    if (/^- Version \d/.test(line) || /^#{1,3} /.test(line)) break;
    if (/^- /.test(line)) items.push(line);
    else if (/^\s+\S/.test(line) && items.length) items[items.length - 1] += ` ${line.trim()}`;
  }
  return items;
}

export function notesPaquet({ kiosque, socle, kiosqueLog, socleLog, depot }) {
  const site = nouveautes(kiosqueLog, kiosque);
  const redaction = nouveautes(socleLog, socle);
  const none = '- Corrections sans changement visible.';
  return [
    `<!-- kiosque-paquet ${JSON.stringify({ kiosque, socle })} -->`,
    `Paquet complet d'un journal : **kiosque-journal.zip**, le site Web du journal et l'espace de rédaction dans un seul fichier.`,
    '',
    `## Site Web du journal (Kiosque ${kiosque})`,
    ...(site.length ? site : [none]),
    '',
    `## Espace de rédaction (socle ${socle})`,
    ...(redaction.length ? redaction : [none]),
    '',
    '## Installer ou mettre à jour',
    `Première installation : décompressez, envoyez le contenu du ZIP à la racine de votre espace Web PHP (par exemple public_html/), puis ouvrez https://votre-journal.com/redaction/ : l'assistant d'installation demande le nom, le logo, les couleurs et le compte administrateur. Un sous-dossier reste possible.`,
    '',
    'Mise à jour : page **Mise à jour** de l’espace de rédaction, en un clic (sauvegarde et retour en arrière compris).',
    '',
    `Guide : https://github.com/${depot}/blob/main/docs/guide-etudiant.md`,
    '',
    `Adresse fixe de la dernière version : https://github.com/${depot}/releases/latest/download/kiosque-journal.zip`,
    '',
  ].join('\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const depot = process.argv[2] || 'azdak919/le-kiosque';
  const read = (file) => readFileSync(path.join(root, file), 'utf8');
  process.stdout.write(notesPaquet({
    kiosque: JSON.parse(read('package.json')).version,
    socle: JSON.parse(read('node_modules/le-socle/package.json')).version,
    kiosqueLog: read('CHANGELOG.md'),
    socleLog: read('node_modules/le-socle/CHANGELOG.md'),
    depot,
  }));
}
