/**
 * Configuration du journal de démonstration.
 *
 * Avec `theme/tokens.css`, c'est l'un des DEUX seuls fichiers qu'une équipe
 * édite. L'amont n'y touche jamais : c'est ce qui rend « Sync fork » sans
 * conflit et donc les mises à jour de plateforme réellement praticables.
 */

import type { KiosqueConfig } from '../packages/pipeline/src/config.ts';

const config: Partial<KiosqueConfig> = {
  source: {
    adapter: 'markdown',
    options: {
      // Le miroir est le backend : l'adaptateur lit content/ et media/.
      root: new URL('.', import.meta.url).pathname,
    },
  },

  deploy: {
    // ⚠ Un fork est servi sur https://<organisation>.github.io/<depot>/ :
    //   le site vit dans un SOUS-DOSSIER. Sans ce réglage, toutes les feuilles
    //   de style et tous les liens pointent à côté.
    //
    //   fork GitHub Pages   →  basePath: '/mon-journal'
    //   domaine dédié       →  basePath: ''  +  cname ci-dessous
    basePath: '',
    // cname: 'mon-journal.ca',
  },

  feedLimit: 30,
};

export default config;
