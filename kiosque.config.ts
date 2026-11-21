import type { KiosqueConfig } from './packages/pipeline/src/config.ts';

/** Configuration de la vitrine amont et de sa démonstration Le Quorum. */
const config: Partial<KiosqueConfig> = {
  root: './examples/demo-journal',
  source: { adapter: 'markdown' },
  editorial: { mode: 'demo-local' },
  // La vitrine Pages est servie à la racine de kiosque.le-radar.ca.
  // Un fork sans domaine remet basePath à '/nom-du-depot'.
  deploy: {
    basePath: '/',
    cname: 'kiosque.le-radar.ca',
    origin: 'https://kiosque.le-radar.ca',
  },
  demoNotice: 'Démonstration du Kiosque — journal étudiant fictif',
  demoContent: true,
  feedLimit: 30,
};

export default config;
