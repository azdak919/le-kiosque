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
<div class="admin-app">
  <aside class="admin-sidebar">
    <div class="admin-brand"><span class="admin-brand-mark" aria-hidden="true">K</span><span><strong>Le Kiosque</strong><small>Rédaction</small></span></div>
    <nav class="admin-nav" aria-label="Administration"><button data-view="dashboard" aria-current="page"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>Tableau de bord</button><button data-view="articles"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5M8 13h8M8 17h5"/></svg>Articles</button><button data-view="media"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></svg>Photos</button><button data-view="authors"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>Auteurs</button><button data-view="taxonomies"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2H2v10l9.3 9.3a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7" cy="7" r="1.5"/></svg>Sections et catégories</button><button data-view="settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7h-9M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>Configuration</button><button data-view="exports"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>Exporter et poursuivre</button></nav>
  </aside>
  <div class="admin-column">
    <header class="admin-header"><h1><span class="muted">Rédaction de</span> <span id="publication-name">${esc(options.publicationName)}</span></h1><a class="btn" data-variant="outline" data-size="sm" href="${options.publicBasePath}/">Voir le journal ↗</a></header>
    <div class="local-warning" role="note"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg><span>Mode démonstration local — données conservées dans ce navigateur.</span></div>
    <main id="admin-main"><div class="loading"><h2>Ouverture du journal local…</h2><p>PGlite initialise PostgreSQL dans ce navigateur.</p></div></main>
  </div>
</div><div id="toast" role="status" aria-live="polite"></div>
<script>window.KIOSQUE_EDITORIAL=${manifest};</script><script type="module" src="${options.assetsBase}/admin.js"></script>
</body></html>`;
}
