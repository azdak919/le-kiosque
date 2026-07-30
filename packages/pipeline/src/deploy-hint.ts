/**
 * Jalon 4 suite — indications de publication (pas d’hébergement LE KIOSQUE).
 * Aucun push automatique vers un compte tiers.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import type { KiosqueConfig } from './config.ts';

export async function writeDeployHint(config: KiosqueConfig, outPath?: string): Promise<string> {
  const root = config.root;
  const dist = path.join(root, 'dist');
  const target = outPath ?? path.join(root, 'DEPLOY.md');
  let hasDist = false;
  try {
    await fs.access(path.join(dist, 'index.html'));
    hasDist = true;
  } catch {
    hasDist = false;
  }

  const base = config.deploy?.basePath || '/';
  const md = `# Publier ce journal (LE KIOSQUE)

Généré localement — **aucun hébergement n’est fourni par LE KIOSQUE**.

## Prérequis

1. \`kiosque doctor --root .\` sans erreur
2. \`kiosque build --root .\` → dossier \`dist/\`
${hasDist ? '3. `dist/index.html` **présent** sur cette machine' : '3. `dist/` **absent** ici — lancer `kiosque build` d’abord'}

## Options d’hébergement (au choix du journal)

### GitHub Pages (statique)

\`\`\`bash
# Depuis la racine du journal, après build :
# 1. Committer le miroir content/ + media/
# 2. Publier dist/ via Actions ou branche gh-pages
npx gh-pages -d dist   # si vous utilisez l’outil communautaire (optionnel)
\`\`\`

\`basePath\` configuré : \`${base}\`  
Sur \`https://ORG.github.io/REPO/\`, \`basePath\` doit être \`/REPO/\`.

### Netlify / Cloudflare Pages / serveur maison

Pointer la racine de publication vers **\`dist/\`**.  
Pas de build Node requis en production si \`dist/\` est déjà généré dans Git.

### Clé USB / intranet

\`\`\`bash
cp -R dist /media/USB/mon-journal
# Ouvrir index.html ou servir :
python3 -m http.server 8080 --directory dist
\`\`\`

## Ce que LE KIOSQUE ne fait pas

- Pas d’OAuth maison, pas de sous-domaine à vie, pas de CMS hébergé
- Pas de promesse de maintenance — l’accompagnement est bénévole

## Passation

Voir aussi \`kiosque adopt\` → \`PASSATION.md\`.
`;

  await fs.writeFile(target, md, 'utf8');
  return target;
}
