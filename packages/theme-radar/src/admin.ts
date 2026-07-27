/**
 * LE KIOSQUE — page d'administration (Sveltia CMS).
 *
 * Le script est servi depuis le site lui-même, jamais depuis un CDN : voir
 * tools/vendor-cms.mjs pour le pourquoi.
 *
 * Cette page est la seule du site à dépendre de JavaScript. C'est acceptable —
 * et c'est la frontière du projet : si elle ne charge pas, **seule l'écriture
 * s'arrête**. Le journal publié, lui, reste entièrement lisible.
 */

import { esc } from './templates.ts';

export interface AdminPageOptions {
  /** Nom du journal, affiché pendant le chargement. */
  publicationName: string;
  lang: string;
  /** Sous-chemin de déploiement ('' ou '/depot'). */
  basePath: string;
  /** Couleur d'accent du journal. */
  accent: string;
}

export function adminPage(options: AdminPageOptions): string {
  const { basePath } = options;

  return `<!doctype html>
<html lang="${esc(options.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- Cette page ne doit jamais se retrouver dans un moteur de recherche. -->
<meta name="robots" content="noindex, nofollow">
<title>Rédaction — ${esc(options.publicationName)}</title>
<link rel="icon" href="data:,">
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
  /* Écran d'attente : remplacé par le CMS dès qu'il a démarré. Sans lui, une
     page blanche pendant plusieurs secondes ressemble à une panne. */
  #chargement {
    position: fixed; inset: 0; display: grid; place-content: center;
    gap: 14px; text-align: center; padding: 24px;
    background: Canvas; color: CanvasText;
  }
  #chargement h1 { font-size: 1.1rem; font-weight: 600; margin: 0; }
  #chargement p { margin: 0; opacity: 0.7; font-size: 0.9rem; max-width: 32rem; }
  #chargement .barre {
    width: 180px; height: 3px; border-radius: 2px; margin: 0 auto;
    background: color-mix(in srgb, ${esc(options.accent)} 25%, transparent);
    overflow: hidden;
  }
  #chargement .barre::after {
    content: ""; display: block; width: 40%; height: 100%;
    background: ${esc(options.accent)};
    animation: glisse 1.1s ease-in-out infinite;
  }
  @keyframes glisse { 0% { transform: translateX(-100%) } 100% { transform: translateX(350%) } }
  @media (prefers-reduced-motion: reduce) { #chargement .barre::after { animation: none } }
</style>
</head>
<body>

<div id="chargement">
  <h1>Rédaction de ${esc(options.publicationName)}</h1>
  <div class="barre" aria-hidden="true"></div>
  <p id="message">Chargement de l’interface d’édition…</p>
</div>

<script src="${basePath}/admin/sveltia-cms.js"></script>
<script>
  // Si le CMS n'a pas pris la main au bout de quelques secondes, on le dit
  // clairement — et surtout on rappelle que le journal, lui, va bien. C'est
  // l'inquiétude réelle de quelqu'un qui voit une page bloquée.
  setTimeout(function () {
    var ecran = document.getElementById('chargement');
    if (!ecran || !ecran.isConnected) return;
    var msg = document.getElementById('message');
    if (msg) {
      msg.innerHTML =
        'L’interface d’édition ne démarre pas. ' +
        '<strong>Le journal publié n’est pas touché</strong> : il reste en ligne et complet. ' +
        'Seule la rédaction est momentanément indisponible.<br><br>' +
        '<a href="${basePath}/">Retour au journal</a>';
    }
  }, 8000);
</script>

</body>
</html>
`;
}

export function unavailableExternalAdminPage(options: AdminPageOptions, backend = 'PocketBase'): string {
  return `<!doctype html><html lang="${esc(options.lang)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Backend externe indisponible — ${esc(options.publicationName)}</title></head><body style="font-family:system-ui,sans-serif;max-width:42rem;margin:4rem auto;padding:1rem;line-height:1.6"><h1>${esc(backend)} n’est pas encore disponible</h1><p>Ce point d’extension prépare une option future. Aucun serveur, compte, OAuth ou stockage distant n’a été configuré.</p><p><a href="${options.basePath}/">Retour au journal</a></p></body></html>`;
}
