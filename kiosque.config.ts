import type { KiosqueConfig } from './packages/pipeline/src/config.ts';

/** Configuration de la vitrine amont et de sa démonstration Le Quorum. */
const config: Partial<KiosqueConfig> = {
  root: './examples/demo-journal',
  source: { adapter: 'markdown' },
  editorial: { mode: 'demo-local' },
  deploy: { basePath: '/le-kiosque' },
  demoNotice: 'Journal de démonstration — toutes les personnes et tous les faits sont fictifs',
  demoContent: true,
  feedLimit: 30,
};

export default config;
