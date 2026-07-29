import { esc } from './templates.ts';

export interface LocalAdminPageOptions {
  publicationName: string;
  lang: string;
  publicBasePath: string;
  adminBasePath: string;
  assetsBase: string;
  seedUrl: string;
  publicationSlug: string;
  databaseKey: string;
}

export function localAdminPage(options: LocalAdminPageOptions): string {
  const manifest = JSON.stringify({
    mode: 'demo-local',
    publicBasePath: options.publicBasePath,
    adminBasePath: options.adminBasePath,
    assetsBase: options.assetsBase,
    seedUrl: options.seedUrl,
    publicationSlug: options.publicationSlug,
    databaseKey: options.databaseKey,
  }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="${esc(options.lang)}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Rédaction — ${esc(options.publicationName)}</title><link rel="stylesheet" href="${options.assetsBase}/admin.css"></head>
<body>
<div class="local-warning">Mode démonstration local — les données sont conservées uniquement dans ce navigateur et ne sont pas partagées avec d’autres utilisateurs.</div>
<header class="admin-header"><h1>Rédaction de <span id="publication-name">${esc(options.publicationName)}</span></h1><a href="${options.publicBasePath}/">Voir le journal</a></header>
<div class="admin-shell">
  <nav class="admin-nav" aria-label="Administration">
    <button data-view="dashboard" aria-current="page">Tableau de bord</button><button data-view="articles">Articles</button><button data-view="media">Photos</button><button data-view="authors">Auteurs</button><button data-view="taxonomies">Sections et catégories</button><button data-view="settings">Configuration</button><button data-view="exports">Exporter et poursuivre</button>
  </nav>
  <main id="admin-main"><div class="loading"><h2>Ouverture du journal local…</h2><p>PGlite initialise PostgreSQL dans ce navigateur.</p></div></main>
</div><div id="toast" role="status" aria-live="polite"></div>
<script>window.KIOSQUE_EDITORIAL=${manifest};</script><script type="module" src="${options.assetsBase}/admin.js"></script>
</body></html>`;
}
