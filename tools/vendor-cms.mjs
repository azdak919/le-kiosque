#!/usr/bin/env node
/**
 * LE KIOSQUE — fige Sveltia CMS dans le dépôt.
 *
 * Pourquoi ne pas simplement charger depuis unpkg :
 *
 *   <script src="https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js"></script>
 *
 * Cette ligne, sans version épinglée, veut dire qu'une publication tierce peut
 * casser l'interface d'édition de tous les journaux le même matin — et qu'un
 * CDN qui disparaît emporte l'admin de chacun d'eux. C'est exactement le type
 * de dépendance que ce projet existe pour éliminer.
 *
 * Le fichier vendu est sous Git : versionné, auditable, fonctionnel hors ligne,
 * et mis à jour volontairement par la pull request de plateforme — comme le
 * reste. Sveltia CMS est sous licence MIT, ce que la redistribution autorise
 * (l'avis de licence est conservé dans admin/SVELTIA-LICENSE.txt).
 *
 *   node tools/vendor-cms.mjs            # version courante du registre
 *   node tools/vendor-cms.mjs 0.173.0    # version précise
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const VENDOR_DIR = path.join(ROOT, 'packages', 'theme-radar', 'assets', 'admin');

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

async function main() {
  let version = process.argv[2];

  if (!version) {
    const meta = JSON.parse(await fetchText('https://registry.npmjs.org/@sveltia/cms/latest'));
    version = meta.version;
    console.log(`version courante du registre : ${version}`);
  }

  const base = `https://unpkg.com/@sveltia/cms@${version}`;
  console.log(`téléchargement de @sveltia/cms@${version}…`);

  const script = await fetchText(`${base}/dist/sveltia-cms.js`);
  if (script.length < 10_000) {
    throw new Error(`fichier suspect (${script.length} octets) — téléchargement interrompu ?`);
  }

  // La licence MIT exige que l'avis accompagne toute redistribution. Sans elle,
  // on n'a pas le droit de vendre le fichier — donc on échoue plutôt que de
  // publier une copie non conforme. Le nom du fichier varie selon les paquets.
  let license = '';
  for (const name of ['LICENSE.txt', 'LICENSE', 'LICENSE.md', 'LICENCE']) {
    try {
      license = await fetchText(`${base}/${name}`);
      break;
    } catch {
      /* essayer le suivant */
    }
  }
  if (!license) {
    throw new Error(
      'avis de licence introuvable dans le paquet — redistribution impossible.\n' +
        '  Récupérer la licence à la main avant de figer le fichier.',
    );
  }

  await mkdir(VENDOR_DIR, { recursive: true });
  await writeFile(path.join(VENDOR_DIR, 'sveltia-cms.js'), script, 'utf8');
  await writeFile(path.join(VENDOR_DIR, 'VERSION.txt'), `${version}\n`, 'utf8');
  await writeFile(path.join(VENDOR_DIR, 'SVELTIA-LICENSE.txt'), license, 'utf8');

  console.log(`✓ figé : ${(script.length / 1024).toFixed(0)} Ko → ${path.relative(ROOT, VENDOR_DIR)}`);
  console.log('  Le commit de ce fichier fait partie de la mise à jour de plateforme.');
}

main().catch((err) => {
  console.error(`✖ ${err.message}`);
  process.exit(1);
});
