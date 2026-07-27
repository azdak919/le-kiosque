/**
 * Configuration du journal de démonstration.
 *
 * Avec `theme/tokens.css`, c'est l'un des DEUX seuls fichiers qu'une équipe
 * édite. L'amont n'y touche jamais : c'est ce qui rend « Sync fork » sans
 * conflit et donc les mises à jour de plateforme réellement praticables.
 */

import type { KiosqueConfig } from '../../packages/pipeline/src/config.ts';

const config: Partial<KiosqueConfig> = {
  source: {
    adapter: 'markdown',
    options: {
      // Le miroir est le backend : l'adaptateur lit content/ et media/.
      root: new URL('.', import.meta.url).pathname,
    },
  },

  // Cette racine est la démonstration Le Quorum : sa banque photo et PGlite
  // ne sont jamais copiés dans un déploiement `git-sveltia` standard.
  editorial: { mode: 'demo-local' },

  deploy: {
    // Domaine dédié → laisser vide.
    // Fork servi par GitHub Pages sur <org>.github.io/<depot>/ → mettre '/<depot>'.
    basePath: '',
    // cname: 'journal-exemple.invalid',
  },

  demoNotice:
    'Journal de démonstration — contenu fictif, produit pour illustrer Le Kiosque',

  demoContent: true,

  feedLimit: 30,
};

export default config;
