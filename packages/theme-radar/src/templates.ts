/**
 * LE KIOSQUE — thème « radar ». Gabarits HTML.
 *
 * Fonctions pures : (modèle commun) → chaîne HTML. Aucun accès disque, aucun
 * réseau, aucun état. Un thème alternatif n'a qu'à exporter les mêmes fonctions.
 *
 * Le HTML produit est lisible sans JavaScript. Le script du thème n'ajoute que
 * le bouton clair/sombre et le défilement des titres — jamais du contenu.
 */

import {
  articleUrl,
  authorUrl,
  sectionUrl,
  type Article,
  type Author,
  type MastheadSports,
  type MediaAsset,
  type Publication,
  type Section,
  type SportsNextGame,
  type SportsTeam,
  type Taxonomies,
} from '../../core/src/model.ts';
import { renderSourceArticle } from './source-view.js';
import { usablePublicationLogo } from './generated-logo.js';
import { inflateSync } from 'node:zlib';
import { radioBarHtml } from './radio.js';
import { socialNavHtml } from './social.js';
import { homeRailHtml } from './home-rail.js';
import { officialSportsUrl, pruneSportsPayload, sportsSexLabel } from './sports-freshness.js';

export interface RenderContext {
  publication: Publication;
  /**
   * Sous-chemin de publication ('' ou '/depot'). Un fork servi par GitHub Pages
   * vit sous `<org>.github.io/<depot>/` : sans ce préfixe, tous les liens et
   * toutes les feuilles de style pointent à côté.
   */
  basePath: string;
  taxonomies: Taxonomies;
  authorsBySlug: Map<string, Author>;
  /** Bandeau « démonstration » affiché en tête de chaque page. */
  demoNotice?: string;
  /**
   * Accès explicite à l’espace de rédaction, seulement si le drapeau de
   * démo est activé. Un vrai journal ne le pose jamais.
   */
  demoEditorialEntry?: boolean;
  /** Année de génération, pour le pied de page. */
  buildYear: number;
  /** Active uniquement pour la démonstration éditoriale navigateur. */
  editorial?: {
    mode: 'demo-local' | 'socle-vivant';
    assetsBase: string;
    seedUrl: string;
    databaseKey: string;
  };
  /**
   * Lien du pied « Espace de rédaction ». Absent : `<basePath>/redaction/`,
   * comme sur un vrai journal. La vitrine le pose sur `/admin/`.
   */
  redactionHref?: string;
}

export interface MastheadOptions {
  name: string;
  signature?: string;
  institution: string;
  logo?: MediaAsset;
  image?: MediaAsset;
  backgroundPosition: string;
  overlayStrength: number;
  textAlignment: 'left' | 'center' | 'right';
  theme: Publication['theme'];
}

function clampPercent(value: number | undefined): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value!)) : 50;
}

/** Ligne sous le nom dans le pied de page, sans tiret orphelin quand un morceau manque. */
function footSignature(pub: { institution?: string; founded?: string; tagline?: string }): string {
  const where = [pub.institution, pub.founded ? `depuis ${pub.founded}` : ''].filter(Boolean).join(' · ');
  return [where, pub.tagline].filter(Boolean).join(' — ');
}

/** Licence CC proposée dans la configuration (sinon : « Tous droits réservés »). */
const CC_BY_NC_ND_URL = 'https://creativecommons.org/licenses/by-nc-nd/4.0/deed.fr';

/** Années du droit d'auteur : l'année courante, ou « fondation–année courante ». */
export function footYears(founded: string | undefined, year: number): string {
  const start = Number(/\d{4}/.exec(String(founded ?? ''))?.[0]);
  return start && start < year ? `${start}–${year}` : String(year);
}

/** Licence des contenus du journal, en HTML : « Tous droits réservés. » par défaut. */
export function footRights(license: string | undefined): string {
  const value = String(license ?? '').trim();
  if (!value || /^tous droits réservés\.?$/i.test(value)) return 'Tous droits réservés.';
  if (/by-nc-nd/i.test(value)) return `Contenus sous licence <a href="${CC_BY_NC_ND_URL}" rel="license noopener">CC BY-NC-ND 4.0</a>.`;
  return `Contenus sous licence ${esc(value)}.`;
}

/** Première ligne du bas de page : « © 2026 La Vigie. Tous droits réservés. » */
export function footCopyright(pub: { name?: string; founded?: string; license?: string }, year: number): string {
  const name = String(pub.name ?? '').trim();
  return `© ${footYears(pub.founded, year)}${name ? ` ${esc(name)}` : ''}. ${footRights(pub.license)}`;
}

/** Page de présentation du Kiosque, liée au bas de chaque page publique (seul endroit à changer). */
export const KIOSQUE_SITE_URL = 'https://kiosque.le-radar.ca/';

const POWERED_BY = `Propulsé par <a href="${KIOSQUE_SITE_URL}" rel="noopener">Le Kiosque</a>, plateforme libre sous licence GNU AGPLv3 pour les journaux étudiants.`;

/** Accès explicite à l’espace de rédaction : drapeau de démo et mode local. */
export function showDemoEditorialEntry(ctx: Pick<RenderContext, 'demoEditorialEntry' | 'editorial'>): boolean {
  return ctx.demoEditorialEntry === true && ctx.editorial?.mode === 'demo-local';
}

const DEMO_EDITORIAL_FULL = 'Essayer l’espace de rédaction (démo)';
const DEMO_EDITORIAL_SHORT = 'Espace de rédaction (démo)';

/** Libellé du pied : explicite sur la démo, discret sur un vrai journal. */
export function footRedactionLabel(demoEntry = false): string {
  return demoEntry
    ? `<span class="site-foot__redaction-full">${DEMO_EDITORIAL_FULL}</span><span class="site-foot__redaction-short">${DEMO_EDITORIAL_SHORT}</span>`
    : 'Espace de rédaction';
}

/** Ligne du bas : mention Propulsé par, puis un lien vers l’espace de rédaction. */
export function footBuiltHtml(redactionHref: string, demoEntry = false): string {
  const attrs = demoEntry ? ` aria-label="${DEMO_EDITORIAL_FULL}"` : '';
  return `<span class="site-foot__powered">${POWERED_BY}</span> <span class="site-foot__sep" aria-hidden="true">·</span> <a class="site-foot__redaction" href="${esc(redactionHref)}"${attrs}>${footRedactionLabel(demoEntry)}</a>`;
}

/** Pastille d’accent du mât, uniquement quand le drapeau de démo est activé. */
export function mastheadDemoEditorialHtml(ctx: RenderContext): string {
  if (!showDemoEditorialEntry(ctx)) return '';
  const href = esc(ctx.redactionHref ?? asset('/admin/', ctx));
  return `<a class="masthead-demo-editorial" href="${href}" aria-label="${DEMO_EDITORIAL_FULL}">` +
    `<svg class="masthead-demo-editorial__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>` +
    `<span class="masthead-demo-editorial__full">${DEMO_EDITORIAL_FULL}</span>` +
    `<span class="masthead-demo-editorial__short">${DEMO_EDITORIAL_SHORT}</span>` +
    `</a>`;
}

/** L'organisme responsable, sauf s'il répète ce que le pied de page dit déjà. */
function footSteward(pub: { name?: string; institution?: string; governance: { stewardEntity?: string } }): string {
  const steward = String(pub.governance.stewardEntity || '').trim();
  // Ni le nom du journal ni l'établissement, déjà écrits juste au-dessus.
  return steward && steward !== String(pub.name || '').trim() && steward !== String(pub.institution || '').trim() ? steward : '';
}

export function mastheadOptions(publication: Publication): MastheadOptions {
  const images = publication.masthead?.backgrounds?.enabled === false
    ? [] : (publication.masthead?.backgrounds?.images ?? []);
  const image = images[0];
  const focal = image?.focalPoint;
  const overlay = publication.masthead?.overlayStrength;
  return {
    name: publication.name,
    signature: publication.tagline,
    institution: publication.institution,
    logo: usablePublicationLogo(publication.logo, undefined, inflateSync),
    image,
    backgroundPosition: `${clampPercent(focal?.x)}% ${clampPercent(focal?.y)}%`,
    overlayStrength: Number.isFinite(overlay) ? Math.min(0.9, Math.max(0, overlay!)) : 0.55,
    textAlignment: publication.masthead?.textAlignment ?? 'left',
    theme: publication.theme,
  };
}

// ---------------------------------------------------------------------------
// Échappement
// ---------------------------------------------------------------------------

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Échappe le texte destiné au corps du document ou à un attribut. */
export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/**
 * URL sûre pour un attribut `href`/`src`. Neutralise `javascript:` et `data:`
 * — un lien vient parfois d'un CMS tiers dont on ne contrôle pas la saisie.
 */
export function safeUrl(value: unknown): string {
  const raw = String(value ?? '').trim();
  if (/^(?:https?:|mailto:|tel:|#|\/|\.{1,2}\/)/i.test(raw)) return esc(raw);
  return '#';
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function dateParts(iso?: string, timeZone = 'America/Toronto'): Record<string, string> | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return Object.fromEntries(new Intl.DateTimeFormat('fr-CA', {
    timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).map((part) => [part.type, part.value]));
}

/** « 12 septembre 2026 » dans le fuseau éditorial du journal. */
export function formatDate(iso?: string, timeZone = 'America/Toronto'): string {
  const parts = dateParts(iso, timeZone);
  if (!parts) return '';
  return `${Number(parts.day)} ${MOIS[Number(parts.month) - 1]} ${parts.year}`;
}

export function formatDateTime(iso?: string, timeZone = 'America/Toronto'): string {
  const parts = dateParts(iso, timeZone);
  if (!parts) return '';
  return `${formatDate(iso, timeZone)}, ${parts.hour} h ${parts.minute}`;
}

// ---------------------------------------------------------------------------
// Fragments
// ---------------------------------------------------------------------------

/**
 * Convertit une URL absolue du site en chemin servable — le site reste
 * déplaçable, et fonctionne aussi bien à la racine d'un domaine que dans le
 * sous-dossier d'un fork GitHub Pages.
 */
function relative(absolute: string, ctx: RenderContext): string {
  const base = ctx.publication.siteUrl.replace(/\/+$/, '');
  const rooted = absolute.startsWith(base) ? absolute.slice(base.length) || '/' : absolute;
  return rooted.startsWith('/') ? `${ctx.basePath}${rooted}` : rooted;
}

/** Chemin d'un fichier statique (feuilles de style, script, flux). */
function asset(path: string, ctx: RenderContext): string {
  if (/^(?:https?:|data:)/i.test(path)) return path;
  return `${ctx.basePath}${path}`;
}


type ResponsiveImage = {
  src: string;
  width?: number;
  height?: number;
  variants?: Array<{ src: string; width: number; height: number }>;
};

const SIZES_CARD = '(max-width: 40rem) 100vw, (max-width: 70rem) 50vw, 22rem';
const SIZES_LEAD_CARD = '(max-width: 40rem) 100vw, 45rem';
const SIZES_POST = '(max-width: 40rem) 100vw, 70rem';
const SIZES_MASTHEAD = '100vw';

/** srcset des miniatures du Socle (480, 960, 1600) plus l’original. */
export function responsiveAttrs(image: ResponsiveImage, ctx: RenderContext, sizes: string): { src: string; srcset?: string; sizes?: string } {
  const src = safeUrl(asset(image.src, ctx));
  const variants = image.variants ?? [];
  if (!variants.length) return { src };
  const originalWidth = image.width ?? Math.max(2400, ...variants.map((item) => item.width));
  const srcset = [
    ...variants.map((item) => `${safeUrl(asset(item.src, ctx))} ${item.width}w`),
    `${src} ${originalWidth}w`,
  ].join(', ');
  return { src, srcset, sizes };
}

function srcsetHtml(attrs: { src: string; srcset?: string; sizes?: string }): string {
  const srcset = attrs.srcset ? ` srcset="${esc(attrs.srcset)}"` : '';
  const sizes = attrs.sizes ? ` sizes="${esc(attrs.sizes)}"` : '';
  return `src="${attrs.src}"${srcset}${sizes}`;
}

/**
 * Couleur du journal en mode sombre, que le mode vienne du bouton ou du
 * système : sans la seconde règle, le violet de démonstration de tokens.css
 * l'emportait chez qui a son téléphone en sombre.
 */
function darkAccent(color: string): string {
  const c = esc(color);
  return `:root[data-theme="dark"]{--accent:${c}}@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--accent:${c}}}`;
}

/**
 * Mât : sans logo, le nom du journal en grand, en caractères de titre de
 * journal ; avec un logo (SVG ou image), le logo remplace le nom écrit
 * (son texte alternatif porte le nom). Jamais les deux.
 */
export function wordmarkInner(masthead: { name: string; logo?: { src: string; alt?: string; width?: number; height?: number } }, ctx: RenderContext): string {
  const logo = usablePublicationLogo(masthead.logo, undefined, inflateSync);
  if (!logo) return `<span class="wordmark-name">${esc(masthead.name)}</span>`;
  const { width, height } = logo;
  const size = width && height ? ` width="${width}" height="${height}"` : '';
  const src = safeUrl(asset(logo.src, ctx));
  return `<img class="publication-logo" src="${src}" alt="${esc(logo.alt || masthead.name)}"${size}>`;
}

/** « Photo : Nom (CC BY-SA 4.0) », licence liée quand on a son adresse. */
function photoCredit(item: { credit?: string; license?: string }): string {
  if (!item.credit) return '';
  return `Photo : ${item.credit}${item.license ? ` (${item.license})` : ''}`;
}

function sectionName(slug: string | undefined, ctx: RenderContext): Section | undefined {
  return ctx.taxonomies.sections.find((s) => s.slug === slug);
}

function radioTuner(ctx: RenderContext): string {
  // Une ligne : le module radio de LE-RADAR (radio.js). Rien si la radio est éteinte.
  return radioBarHtml(ctx.publication.radio);
}

/** Emplacement sous le tuner pour la météo téléphone/tablette (rempli en JS). */
function weatherDockHtml(): string {
  return `<div class="masthead-weather-dock" id="masthead-weather-dock" hidden aria-label="Météo"></div>`;
}

/** Cartes sports sous la radio (et sous le dock météo sur téléphone), hors du mât. */
function sportsStripHtml(ctx: RenderContext): string {
  return sportsPayload(ctx);
}

/**
 * Bandeau démo sticky. Coupe sur — / – pour deux lignes contrôlées sur mobile :
 *   lead  (ex. Démonstration du Kiosque)
 *   rest  (ex. journal étudiant fictif)
 * Le CSS mobile masque le séparateur et ajoute « — » en fin de 1ʳᵉ ligne.
 */
function demoBannerHtml(notice: string | undefined): string {
  const trimmed = (notice ?? '').trim();
  if (!trimmed) return '';
  const m = trimmed.match(/^(.+?)\s*[—–]\s*(.+)$/u);
  if (m) {
    return (
      `<div class="demo-banner" role="note">` +
      `<span class="demo-banner__lead">${esc(m[1])}</span>` +
      `<span class="demo-banner__sep" aria-hidden="true"> — </span>` +
      `<span class="demo-banner__rest">${esc(m[2])}</span>` +
      `</div>`
    );
  }
  return `<div class="demo-banner" role="note">${esc(trimmed)}</div>`;
}

/** Icônes du mât — mêmes tracés que LE-RADAR (index.html). */
function icon(label: 'home' | 'rss' | 'shuffle' | 'sun' | 'moon', _assetsBase?: string): string {
  if (label === 'home') {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z"/></svg>`;
  }
  if (label === 'rss') {
    return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="6.18" cy="17.82" r="2.18"/><path d="M4 4.44v2.83c7.03 0 12.73 5.7 12.73 12.73h2.83C19.56 12.06 12.94 5.44 4 4.44z"/><path d="M4 10.11v2.83c3.9 0 7.07 3.17 7.07 7.07h2.83c0-5.46-4.42-9.9-9.9-9.9z"/></svg>`;
  }
  if (label === 'shuffle') {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 4 4-4 4"/><path d="M20 7H9a5 5 0 0 0-5 5v1"/><path d="m8 21-4-4 4-4"/><path d="M4 17h11a5 5 0 0 0 5-5v-1"/></svg>`;
  }
  if (label === 'sun') {
    // Icône = action future (comme LE-RADAR) : soleil = passer en clair.
    return `<svg class="ico-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>`;
  }
  // Lune masquée par défaut (thème clair initial) — classe .hidden comme LE-RADAR.
  return `<svg class="ico-moon hidden" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
}

function emojiIcon(assetsBase: string, file: 'tomato.png' | 'playing-cards.png'): string {
  return `<img class="app-emoji" src="${esc(assetsBase)}emoji/${file}" width="16" height="16" alt="" decoding="async" aria-hidden="true">`;
}

function mastheadBackground(ctx: RenderContext, options: MastheadOptions): string {
  const settings = ctx.publication.masthead?.backgrounds;
  if (settings?.enabled === false || !settings?.images?.length) return '';
  const image = settings.images[0];
  const credit = image.credit
    ? image.creditUrl
      ? `<a href="${safeUrl(image.creditUrl)}" rel="noopener">${esc(photoCredit(image))}</a>`
      : esc(photoCredit(image))
    : '';
  const manifest = settings.images.map((item) => {
    const attrs = responsiveAttrs(item, ctx, SIZES_MASTHEAD);
    return {
      src: attrs.src, srcset: attrs.srcset, sizes: attrs.sizes, alt: item.alt, credit: item.credit ?? '', license: item.license ?? '', creditUrl: item.creditUrl ?? '',
      backgroundPosition: `${clampPercent(item.focalPoint?.x)}% ${clampPercent(item.focalPoint?.y)}%`,
    };
  });
  const first = responsiveAttrs(image, ctx, SIZES_MASTHEAD);
  const payload = { randomOrder: settings.randomOrder !== false, images: manifest };
  return `<img class="masthead-background" ${srcsetHtml(first)} alt="" data-masthead-background style="object-position:${esc(options.backgroundPosition)}">
  <span class="masthead-background-shade" aria-hidden="true"></span>
  <span class="masthead-photo-credit" data-masthead-credit>${credit}</span>
  <script type="application/json" id="masthead-backgrounds">${JSON.stringify(payload).replace(/</g, '\\u003c')}</script>
  <script>
  (function(){
    var data=document.getElementById('masthead-backgrounds');
    if(!data) return;
    var parsed; try{parsed=JSON.parse(data.textContent||'[]');}catch(e){return;}
    var images=Array.isArray(parsed)?parsed:(parsed&&parsed.images)||[];
    var random=Array.isArray(parsed)?true:parsed.randomOrder!==false;
    if(!random||images.length<2) return;
    var img=document.querySelector('[data-masthead-background]');
    if(!img) return;
    var n=images.length, i=0;
    try{
      if(window.crypto&&crypto.getRandomValues){
        var buf=new Uint32Array(1), max=0x100000000, limit=max-(max%n), x;
        do{crypto.getRandomValues(buf);x=buf[0];}while(x>=limit);
        i=x%n;
      }else i=Math.floor(Math.random()*n);
    }catch(e){i=Math.floor(Math.random()*n);}
    var item=images[i];
    if(!item||!item.src) return;
    if(item.srcset) img.setAttribute('srcset',item.srcset); else img.removeAttribute('srcset');
    if(item.sizes) img.setAttribute('sizes',item.sizes); else if(item.srcset) img.setAttribute('sizes','100vw');
    img.src=item.src;
    if(item.backgroundPosition) img.style.objectPosition=item.backgroundPosition;
    img.setAttribute('data-masthead-start', String(i));
    var creditEl=document.querySelector('[data-masthead-credit]');
    if(creditEl&&item.credit){
      var label='Photo : '+item.credit+(item.license?' ('+item.license+')':'');
      creditEl.replaceChildren();
      if(item.creditUrl&&item.creditUrl.indexOf('https://')===0){
        var a=document.createElement('a'); a.href=item.creditUrl; a.rel='noopener'; a.textContent=label; creditEl.appendChild(a);
      } else creditEl.textContent=label;
    }
  })();
  </script>`;
}

/** Route de la page résultats (puce mât) — `/sports/` par défaut. */
export function sportsPagePath(sports: MastheadSports | undefined, ctx: RenderContext): string {
  if (sports?.href) return asset(sports.href, ctx);
  return asset('/sports/', ctx);
}

function sportsTeamRoster(sports: MastheadSports): SportsTeam[] {
  if (sports.teams?.length) return sports.teams;
  if (sports.team) return [sports.team];
  return [];
}

/** Date d’activité d’une formation (prochain match, sinon dernier score). */
function sportsTeamActivityDate(team: SportsTeam, sports: MastheadSports): string {
  let next = team.nextGame;
  if (!next && sports.nextGame && (!sports.nextGame.teamId || sports.nextGame.teamId === team.id)) {
    next = sports.nextGame;
  }
  if (!next && sports.nextGames?.length) {
    next = sports.nextGames.find((n) => !n.teamId || n.teamId === team.id);
  }
  if (next?.date) return next.date;
  const nested = team.results ?? [];
  const global = (sports.results ?? []).filter((g) => !g.teamId || g.teamId === team.id);
  const dates = [...nested, ...global].map((g) => g.date).filter(Boolean);
  if (!dates.length) return '';
  return dates.slice().sort((a, b) => String(b).localeCompare(String(a)))[0] ?? '';
}

/**
 * Ordre des cartes : formations avec match à venir (date croissante),
 * puis les autres par dernier score (plus récent d’abord).
 * La 1ʳᵉ rangée CSS affiche donc l’actualité la plus chaude.
 */
function sortSportsTeamsForBoard(teams: SportsTeam[], sports: MastheadSports): SportsTeam[] {
  return teams.slice().sort((a, b) => {
    const aNext = Boolean(
      a.nextGame
      || (sports.nextGame && (!sports.nextGame.teamId || sports.nextGame.teamId === a.id))
      || sports.nextGames?.some((n) => !n.teamId || n.teamId === a.id),
    );
    const bNext = Boolean(
      b.nextGame
      || (sports.nextGame && (!sports.nextGame.teamId || sports.nextGame.teamId === b.id))
      || sports.nextGames?.some((n) => !n.teamId || n.teamId === b.id),
    );
    if (aNext !== bNext) return aNext ? -1 : 1;
    const da = sportsTeamActivityDate(a, sports);
    const db = sportsTeamActivityDate(b, sports);
    if (aNext && bNext) return String(da).localeCompare(String(db));
    return String(db).localeCompare(String(da));
  });
}

function sportsPayload(ctx: RenderContext): string {
  const sports = ctx.publication.masthead?.sports;
  if (!sports || sports.enabled === false) return '';
  const teams = sportsTeamRoster(sports);
  if (!teams.length) return '';
  /* Focus-group B : prune sessions (demoAsOf / demoLive en démo, sinon now). */
  const pruned = pruneSportsPayload(
    {
      teams,
      results: sports.results ?? [],
      nextGame: sports.nextGame ?? null,
      nextGames: sports.nextGames ?? [],
      demoAsOf: sports.demoAsOf,
      demoLive: sports.demoLive,
    },
    { demoAsOf: sports.demoAsOf, demoLive: sports.demoLive },
  );
  const prunedTeams = pruned.teams ?? [];
  if (!prunedTeams.length) return '';
  const payload = {
    teams: prunedTeams,
    team: prunedTeams[0],
    results: pruned.results ?? [],
    nextGame: pruned.nextGame ?? null,
    nextGames: pruned.nextGames ?? [],
    href: sportsPagePath(sports, ctx),
    demoAsOf: pruned.demoAsOf ?? sports.demoAsOf,
    demoLive: sports.demoLive,
    timeZone: ctx.publication.timeZone || 'America/Toronto',
  };
  return `<div class="masthead-sports-strip masthead-sports" id="masthead-sports-strip" hidden data-sports-payload="${esc(JSON.stringify(payload))}" aria-label="Au tableau — scores et matchs" aria-live="polite"></div>`;
}

function sportsGlyphHtml(sport: string): string {
  const s = sport.toLowerCase();
  if (s.includes('basket')) return '🏀';
  if (s.includes('hockey')) return '🏒';
  if (s.includes('soccer') || (s.includes('foot') && !s.includes('flag'))) return '⚽';
  if (s.includes('flag') || s.includes('football')) return '🏈';
  if (s.includes('volley')) return '🏐';
  return '🏅';
}

function formatSportsDate(iso: string, timeZone: string, now = new Date()): string {
  if (!iso) return '';
  try {
    const day = String(iso).slice(0, 10);
    const todayParts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const y = todayParts.find((p) => p.type === 'year')?.value;
    const m = todayParts.find((p) => p.type === 'month')?.value;
    const d = todayParts.find((p) => p.type === 'day')?.value;
    const todayKey = y && m && d ? `${y}-${m}-${d}` : '';
    if (todayKey && day === todayKey) return 'Aujourd’hui';
    if (todayKey) {
      const tomorrow = new Date(`${todayKey}T12:00:00`);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const ty = tomorrow.getFullYear();
      const tm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const td = String(tomorrow.getDate()).padStart(2, '0');
      if (day === `${ty}-${tm}-${td}`) return 'Demain';
      const yesterday = new Date(`${todayKey}T12:00:00`);
      yesterday.setDate(yesterday.getDate() - 1);
      const yy = yesterday.getFullYear();
      const ym = String(yesterday.getMonth() + 1).padStart(2, '0');
      const yd = String(yesterday.getDate()).padStart(2, '0');
      if (day === `${yy}-${ym}-${yd}`) return 'Hier';
    }
    return new Intl.DateTimeFormat('fr-CA', {
      day: 'numeric',
      month: 'short',
      timeZone,
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso;
  }
}

/** Raccourci établissement pour cartes (évite les coupures verticales). */
function sportsShortInstitutionLabel(inst: string): string {
  let s = String(inst || '')
    .replace(/^Cégep\s+(de\s+|du\s+|d’|d')?/i, '')
    .replace(/^Collège\s+/i, '')
    .replace(/^Champlain\s+College\s+/i, 'Champlain ')
    .replace(/^Université\s+(de\s+|du\s+|d’|d')?/i, '')
    .trim();
  // Formes courtes RSEQ collégial (cartes étroites).
  const aliases: Array<[RegExp, string]> = [
    [/^François-Xavier-Garneau$/i, 'Garneau'],
    [/^André-Laurendeau$/i, 'Laurendeau'],
    [/^Édouard-Montpetit$/i, 'É.-Montpetit'],
    [/^Saint-Jean-sur-Richelieu$/i, 'St-Jean'],
    [/^Saint-Laurent$/i, 'St-Laurent'],
    [/^Sainte-Foy$/i, 'Ste-Foy'],
    [/^Champlain\s+Saint-Lambert$/i, 'Champlain St-L.'],
    [/^Valleyfield$/i, 'Valleyfield'],
    [/^Limoilou$/i, 'Limoilou'],
  ];
  for (const [re, short] of aliases) {
    if (re.test(s)) return short;
  }
  return s;
}

/** Pastille domicile / extérieur — bloc sous l’adversaire (lisible). */
function sportsVenueHtml(home?: boolean): string {
  if (home === true) {
    return `<span class="sports-result__venue sports-result__venue--home" title="Match à domicile">Domicile</span>`;
  }
  if (home === false) {
    return `<span class="sports-result__venue sports-result__venue--away" title="Match à l’extérieur">Extérieur</span>`;
  }
  return '';
}

/** Adversaire : surnom gras + école courte sur ligne suivante. */
function sportsOppHtml(opponent: string, institution?: string): string {
  const nick = `<span class="sports-result__opp">${esc(opponent)}</span>`;
  if (!institution) return nick;
  const short = sportsShortInstitutionLabel(institution);
  if (!short || short === opponent) return nick;
  return `${nick}<span class="sports-result__opp-school">${esc(short)}</span>`;
}

function sportsSexBadgeHtml(sex?: string): string {
  const label = sportsSexLabel(sex);
  if (!label) return '';
  const key = label === 'Féminin' ? 'f' : label === 'Masculin' ? 'm' : 'x';
  const title = key === 'x' ? ' title="Ouvert / mixte"' : '';
  return ` <span class="sports-panel__sex sports-panel__sex--${key}"${title}>${esc(label)}</span>`;
}

function sportsOfficialLinkHtml(team: SportsTeam): string {
  const href = officialSportsUrl(team.officialUrl);
  if (!href) return '';
  return `<p class="sports-panel__official"><a class="sports-panel__results-source" href="${esc(href)}" rel="noopener noreferrer" target="_blank">Résultats officiels</a></p>`;
}

/** Jour de référence éditorial (demoAsOf ou aujourd’hui dans le fuseau). */
function sportsRefDayKey(sports: MastheadSports, timeZone: string): string {
  if (sports.demoAsOf && /^\d{4}-\d{2}-\d{2}/.test(sports.demoAsOf)) {
    return sports.demoAsOf.slice(0, 10);
  }
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function sportsResultRows(
  team: SportsTeam,
  sports: MastheadSports,
  timeZone: string,
): string {
  const global = (sports.results ?? []).filter((g) => !g.teamId || g.teamId === team.id);
  const nested = team.results ?? [];
  const allResults = [...nested, ...global]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  /* Un seul « à venir » par carte (nextGame ; pas de nextGames multi). */
  let next: SportsNextGame | undefined = team.nextGame;
  if (!next && sports.nextGame && (!sports.nextGame.teamId || sports.nextGame.teamId === team.id)) {
    next = sports.nextGame;
  }
  if (!next && sports.nextGames?.length) {
    next = sports.nextGames.find((n) => !n.teamId || n.teamId === team.id);
  }

  const refDay = sportsRefDayKey(sports, timeZone);
  const nextDay = next?.date ? String(next.date).slice(0, 10) : '';
  /* Si le prochain est déjà passé vs ref, ne pas l’afficher. */
  if (next && nextDay && nextDay < refDay) next = undefined;

  const todayResults = allResults.filter((g) => String(g.date).slice(0, 10) === refDay);
  const olderResults = allResults
    .filter((g) => String(g.date).slice(0, 10) !== refDay)
    .slice(0, 5);

  const renderPast = (g: (typeof allResults)[0]): string => {
    const badge = g.result === 'W' ? 'V' : g.result === 'L' ? 'D' : 'N';
    const label = g.result === 'W' ? 'Victoire' : g.result === 'L' ? 'Défaite' : 'Nul';
    const venue = sportsVenueHtml(g.home);
    const homeAria = g.home === true ? ' · domicile' : g.home === false ? ' · extérieur' : '';
    const opp = sportsOppHtml(g.opponent, g.opponentInstitution);
    const prior = !!g.priorSeason;
    const priorClass = prior ? ' sports-result--prior-season' : '';
    const priorMeta = prior
      ? `\n  <span class="sports-result__season-meta">Saison précédente</span>`
      : '';
    const homeAttr = g.home === true ? ' data-home="1"' : g.home === false ? ' data-home="0"' : '';
    return `<li class="sports-result sports-result--${esc(g.result)}${priorClass}" data-result="${esc(g.result)}"${prior ? ' data-prior-season="1"' : ''}${homeAttr}>
  <time class="sports-result__time" datetime="${esc(g.date)}">${esc(formatSportsDate(g.date, timeZone))}</time>
  <span class="sports-result__score" aria-label="${esc(label)}${homeAria}">${g.scoreFor}–${g.scoreAgainst}</span>
  <span class="sports-result__title"><span class="sports-result__vs">vs</span> ${opp}${venue}</span>
  <span class="sports-result__badge" title="${esc(label)}">${badge}</span>${priorMeta}
</li>`;
  };

  /*
   * Ordre anti-bug long terme :
   * 1) matchs du jour (scores) — au-dessus de « À venir »
   * 2) un seul prochain match
   * 3) passés plus anciens
   */
  const rows: string[] = [];
  for (const g of todayResults) rows.push(renderPast(g));

  if (next) {
    const day = formatSportsDate(next.date, timeZone) || next.date;
    const clock = next.time ? next.time.replace(':', ' h ') : '';
    const timeInner = clock
      ? `<span class="sports-result__day">${esc(day)}</span><span class="sports-result__clock">${esc(clock)}</span>`
      : esc(day);
    const opp = sportsOppHtml(next.opponent, next.opponentInstitution);
    const venue = sportsVenueHtml(next.home);
    const homeAttr = next.home === true ? ' data-home="1"' : next.home === false ? ' data-home="0"' : '';
    const isLive = next.live === true;
    const nextLabel = isLive ? 'En cours' : 'À venir';
    rows.push(`<li class="sports-result sports-result--next${isLive ? ' sports-result--live' : ''}"${homeAttr}>
  <time class="sports-result__time" datetime="${esc(next.date)}">${timeInner}</time>
  <span class="sports-result__score sports-result__score--next" aria-label="${esc(nextLabel)}">${esc(nextLabel)}</span>
  <span class="sports-result__title"><span class="sports-result__vs">vs</span> ${opp}${venue}</span>
  <span class="sports-result__badge sports-result__badge--next" title="${esc(nextLabel)}">${isLive ? '●' : '→'}</span>
</li>`);
  }

  for (const g of olderResults) rows.push(renderPast(g));

  if (!rows.length) {
    return '<p class="sports-panel__empty">Aucun résultat pour le moment.</p>';
  }
  return `<ul class="sports-panel__list">${rows.join('\n')}</ul>`;
}

/**
 * Page résultats sportifs — inspirée de la grille horaire SEO LE-RADAR
 * (panneaux par entité + lignes date / détail), adaptée au journal.
 */
export function sportsResultsPage(ctx: RenderContext, sportsArticles: Article[] = []): string {
  const sports = ctx.publication.masthead?.sports;
  const rawTeams = sports && sports.enabled !== false ? sportsTeamRoster(sports) : [];
  const prunedSports = sports
    ? pruneSportsPayload(
        {
          teams: rawTeams,
          results: sports.results ?? [],
          nextGame: sports.nextGame ?? null,
          nextGames: sports.nextGames ?? [],
          demoAsOf: sports.demoAsOf,
          demoLive: sports.demoLive,
        },
        { demoAsOf: sports.demoAsOf, demoLive: sports.demoLive },
      )
    : null;
  const rawPrunedTeams = (prunedSports?.teams ?? []) as SportsTeam[];
  const sportsForRows: MastheadSports = sports
    ? {
        ...sports,
        teams: rawPrunedTeams,
        results: (prunedSports?.results ?? []) as MastheadSports['results'],
        nextGame: (prunedSports?.nextGame ?? undefined) as MastheadSports['nextGame'],
        nextGames: (prunedSports?.nextGames ?? undefined) as MastheadSports['nextGames'],
        /* demoLive décale les dates : la ref jour doit suivre le demoAsOf pruné
           (sinon nextGame « aujourd’hui » est jugé passé vs l’ancre YAML). */
        demoAsOf: (prunedSports?.demoAsOf as string | undefined) ?? sports.demoAsOf,
        demoLive: sports.demoLive,
      }
    : { enabled: false };
  const teams = sports
    ? sortSportsTeamsForBoard(rawPrunedTeams, sportsForRows)
    : [];
  if (!sports || !teams.length) {
    return page(
      `<div class="wrap wire">
      <div class="wire-head"><h1 class="wire-title">Au tableau</h1></div>
      <p class="section-intro">Aucun score n’est encore affiché pour ce journal.</p>
      <p><a href="${asset('/sections/sports/', ctx)}">Voir la section Sports</a></p>
    </div>`,
      {
        title: `Au tableau — ${ctx.publication.name}`,
        canonical: `${ctx.publication.siteUrl.replace(/\/+$/, '')}/sports/`,
        current: asset('/sports/', ctx),
      },
      ctx,
    );
  }

  const tz = ctx.publication.timeZone || 'America/Toronto';
  const panels = teams.map((team) => {
    const color = team.colors?.primary || 'var(--accent)';
    const sexBadge = sportsSexBadgeHtml(team.sex);
    const codeHtml = team.code
      ? ` <span class="sports-panel__code">${esc(team.code)}</span>`
      : '';
    return `<section class="sports-panel" data-sport="${esc(team.sport)}" data-team="${esc(team.id)}" style="--sports-panel-c:${esc(color)}">
  <header class="sports-panel__head">
    <span class="sports-panel__glyph" aria-hidden="true">${sportsGlyphHtml(team.sport)}</span>
    <div class="sports-panel__identity">
      <h2 class="sports-panel__name sports-panel__name--branded"><span class="sports-panel__brand">${esc(team.name)}</span>${codeHtml}${sexBadge}</h2>
      <p class="sports-panel__meta">${esc(team.sportLabel || team.sport)}${team.institution ? ` · ${esc(team.institution)}` : ''}</p>
      ${sportsOfficialLinkHtml(team)}
    </div>
  </header>
  ${sportsResultRows(team, sportsForRows, tz)}
</section>`;
  }).join('\n');

  const feed = sportsArticles.length
    ? `<div class="sports-articles">
      <div class="wire-head"><h2 class="wire-title">Dans le journal</h2>
        <span class="wire-status">${sportsArticles.length} article${sportsArticles.length > 1 ? 's' : ''}</span>
      </div>
      ${magazineFeedHtml(sportsArticles, ctx, {
        heroLabel: 'Sports',
        empty: 'Aucun article dans la section Sports.',
      })}
    </div>`
    : `<p class="section-intro"><a href="${asset('/sections/sports/', ctx)}">Voir les articles de la section Sports</a></p>`;

  return page(
    `<div class="wrap wire wire--sports">
      <div class="wire-head">
        <h1 class="wire-title">Au tableau</h1>
        <span class="wire-status">${teams.length} équipe${teams.length > 1 ? 's' : ''}</span>
      </div>
      <p class="section-intro">Scores et prochains matchs des équipes du ${esc(ctx.publication.institution)} — le tableau d’affichage du campus.</p>
      <div class="sports-board-wrap" data-sports-board-wrap>
        <div class="sports-board-scroll">
          <div class="sports-board" role="list">
            ${panels}
          </div>
        </div>
        <button type="button" class="sports-board-toggle" data-sports-board-toggle hidden aria-expanded="false">
          <span class="sports-board-toggle__label">Plus de matchs</span>
        </button>
      </div>
      ${feed}
    </div>`,
    {
      title: `Au tableau — ${ctx.publication.name}`,
      description: `Au tableau : scores et prochains matchs des équipes du ${ctx.publication.institution}.`,
      canonical: `${ctx.publication.siteUrl.replace(/\/+$/, '')}/sports/`,
      current: asset('/sports/', ctx),
    },
    ctx,
  );
}

function mastheadTools(ctx: RenderContext, current?: string): string {
  const masthead = ctx.publication.masthead;
  const weather = masthead?.weather;
  const backgrounds = masthead?.backgrounds;
  const tools = masthead?.tools;
  const localities = weather?.enabled === false ? [] : (weather?.localities ?? []);
  const assetsBase = asset('/assets/', ctx);
  const homeHref = asset('/', ctx);
  const button = (href: string, label: string, glyph: string, extraClass = '', currentPage = false) =>
    `<a class="masthead-tool${extraClass ? ` ${extraClass}` : ''}" href="${safeUrl(href)}" aria-label="${esc(label)}" title="${esc(label)}"${currentPage ? ' aria-current="page"' : ''}>${glyph}</a>`;
  return `<div class="masthead-utility">
    <p class="masthead-clock"><span data-masthead-date></span><time data-masthead-time></time></p>
    ${localities.length
      ? `<div class="masthead-status" data-masthead-status>
    <div class="masthead-weather" data-weather-localities="${esc(JSON.stringify(localities))}" data-meteocons-base="${esc(asset('/assets/meteocons/animated/', ctx))}" aria-label="Météo"></div>
  </div>`
      : ''}
    <div class="masthead-tools">
      ${button(homeHref, 'Accueil', icon('home', assetsBase), 'masthead-home', current === homeHref)}
      ${ctx.publication.noindex ? '' : button(asset('/feed.xml', ctx), 'Flux RSS', icon('rss', assetsBase), 'masthead-rss')}
      ${tools?.pomodoro !== false ? button('https://le-radar.ca/pomo/', 'Pomodoro', emojiIcon(assetsBase, 'tomato.png'), 'masthead-pomo') : ''}
      ${tools?.solitaire !== false ? button('https://le-radar.ca/solitaire/', 'Solitaire', emojiIcon(assetsBase, 'playing-cards.png'), 'masthead-solitaire') : ''}
      <button type="button" id="theme-toggle" class="masthead-tool theme-toggle" aria-label="Passer en mode sombre" title="Passer en mode sombre">${icon('sun', assetsBase)}${icon('moon', assetsBase)}</button>
      ${backgrounds?.enabled !== false && (backgrounds?.images?.length ?? 0) > 1 ? `<button type="button" id="masthead-shuffle" class="masthead-tool masthead-shuffle" aria-label="Changer la photo du mât" title="Changer la photo du mât">${icon('shuffle', assetsBase)}</button>` : ''}
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Carte d'article
// ---------------------------------------------------------------------------

export function articleCard(article: Article, ctx: RenderContext, variant: boolean | 'lead' | 'feature' | 'brief' | 'tail' = false): string {
  const role = variant === true ? 'lead' : variant === false ? 'tail' : variant;
  const section = sectionName(article.section, ctx);
  // Couleur de rubrique ; à défaut première catégorie colorée (choix éditorial).
  const categoryColor = article.categories
    .map((slug) => ctx.taxonomies.categories.find((c) => c.slug === slug)?.color)
    .find((c) => c && /^#/.test(c));
  const href = relative(articleUrl(ctx.publication, article), ctx);
  const date = article.publishedAt ?? article.updatedAt;
  const labels = ctx.publication.labels;
  return renderSourceArticle({
    section: section?.name,
    color: section?.color || categoryColor,
    href: safeUrl(href),
    /* SPA démo navigateur : ne pas recharger le bandeau ni l’iframe radio. */
    linkAttributes: ctx.editorial ? 'data-editorial-link' : '',
    title: article.title,
    excerpt: article.excerpt,
    readMore: true,
    // « À la une » seulement pour un article vraiment mis en avant (featured).
    leadEyebrow: role === 'lead' && article.featured ? (labels?.leadEyebrow || 'À la une') : undefined,
    date: { iso: date, label: formatDateTime(date, ctx.publication.timeZone) },
    authors: article.authors.map((slug) => ({
      name: ctx.authorsBySlug.get(slug)?.name ?? slug,
      href: safeUrl(relative(authorUrl(ctx.publication, slug), ctx)),
    })),
    image: article.lead ? {
      ...responsiveAttrs(article.lead, ctx, role === 'lead' ? SIZES_LEAD_CARD : SIZES_CARD),
      alt: article.lead.alt,
      caption: article.lead.caption,
      credit: article.lead.credit,
      license: article.lead.license,
      focalPoint: article.lead.focalPoint,
      width: article.lead.width,
      height: article.lead.height,
    } : undefined,
  }, role);
}

// ---------------------------------------------------------------------------
// Enveloppe de page
// ---------------------------------------------------------------------------

export interface PageOptions {
  title: string;
  description?: string;
  canonical: string;
  /** Chemin racine de la page courante, pour marquer la navigation. */
  current?: string;
  /** Métadonnées Open Graph supplémentaires. */
  image?: string;
  type?: 'website' | 'article';
  /** JSON-LD déjà sérialisé. */
  jsonLd?: string;
  bodyClass?: string;
}

/** Liens de navigation principale (en-tête + pied de page). */
function mainNavItems(ctx: RenderContext): { href: string; label: string; color?: string }[] {
  const pub = ctx.publication;
  return [
    { href: asset('/', ctx), label: 'Accueil' },
    ...ctx.taxonomies.sections.map((s) => ({
      href: relative(sectionUrl(pub, s.slug), ctx),
      label: s.name,
      color: s.color,
    })),
    { href: asset('/auteurs/', ctx), label: 'Équipe' },
  ];
}

function navLinksHtml(
  items: { href: string; label: string; color?: string }[],
  options: { current?: string; editorial?: boolean } = {},
): string {
  return items
    .map((n) => {
      const current = options.current === n.href ? ' aria-current="page"' : '';
      const color = n.color && /^#[0-9a-fA-F]{3,8}$/.test(n.color)
        ? ` class="nav-section" style="--nav-c:${esc(n.color)}"`
        : '';
      const dataEd = options.editorial ? ' data-editorial-link' : '';
      return `<a href="${safeUrl(n.href)}"${current}${color}${dataEd}>${esc(n.label)}</a>`;
    })
    .join('\n      ');
}

/** Menu principal en pied de page (séparateurs ·, comme LE-RADAR). */
function footerNavHtml(
  items: { href: string; label: string; color?: string }[],
  options: { current?: string; editorial?: boolean } = {},
): string {
  const sep = `<span class="site-foot__sep" aria-hidden="true">·</span>`;
  return items
    .map((n) => {
      const current = options.current === n.href ? ' aria-current="page"' : '';
      const color = n.color && /^#[0-9a-fA-F]{3,8}$/.test(n.color)
        ? ` class="nav-section" style="--nav-c:${esc(n.color)}"`
        : '';
      const dataEd = options.editorial ? ' data-editorial-link' : '';
      return `<a href="${safeUrl(n.href)}"${current}${color}${dataEd}>${esc(n.label)}</a>`;
    })
    .join(`\n      ${sep}\n      `);
}

export function page(content: string, options: PageOptions, ctx: RenderContext): string {
  const pub = ctx.publication;
  const masthead = mastheadOptions(pub);
  const nav = mainNavItems(ctx);
  const editorial = Boolean(ctx.editorial);

  const description = options.description ?? pub.tagline ?? pub.name;
  const radio = radioTuner(ctx);
  const withRadio = Boolean(radio);
  const bodyClasses = [options.bodyClass, withRadio ? 'with-radio' : ''].filter(Boolean).join(' ');

  return `<!doctype html>
<html lang="${esc(pub.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(options.title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${safeUrl(options.canonical)}">
<meta name="theme-color" content="${esc(pub.theme.accent)}">

<meta property="og:site_name" content="${esc(pub.name)}">
<meta property="og:type" content="${esc(options.type ?? 'website')}">
<meta property="og:title" content="${esc(options.title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${safeUrl(options.canonical)}">
<meta property="og:locale" content="${esc(pub.lang.replace('-', '_'))}">${
    options.image ? `\n<meta property="og:image" content="${safeUrl(options.image)}">` : ''
  }
<meta name="twitter:card" content="${options.image ? 'summary_large_image' : 'summary'}">

${pub.noindex ? '' : `<link rel="alternate" type="application/atom+xml" title="${esc(pub.name)}" href="${asset('/feed.xml', ctx)}">`}
<link rel="stylesheet" href="${asset('/assets/tokens.css', ctx)}">
<link rel="stylesheet" href="${asset('/assets/theme.css', ctx)}">
<link rel="stylesheet" href="${asset('/assets/source-view.css', ctx)}">
<style>:root{--accent:${esc(pub.theme.accent)}}${darkAccent(pub.theme.accentDark || pub.theme.accent)}</style>${
    pub.noindex ? '\n<meta name="robots" content="noindex, nofollow">' : ''
  }
${options.jsonLd ? `<script type="application/ld+json">${options.jsonLd}</script>\n` : ''}</head>
<body${bodyClasses ? ` class="${esc(bodyClasses)}"` : ''}>
<a class="skip-link" href="#contenu">Aller au contenu</a>
${demoBannerHtml(ctx.demoNotice)}
<header class="masthead${masthead.image ? ' masthead--illustrated' : ''}" data-text-alignment="${masthead.textAlignment}" style="--masthead-overlay:${masthead.overlayStrength}">
  ${mastheadBackground(ctx, masthead)}
  <div class="wrap">
    ${mastheadTools(ctx, options.current)}
    <div class="masthead-top">
      <div>
        <p class="wordmark"><a href="${asset('/', ctx)}">${wordmarkInner(masthead, ctx)}</a></p>
        ${masthead.signature ? `<p class="masthead-tagline">${esc(masthead.signature)}</p>` : ''}
        ${mastheadDemoEditorialHtml(ctx)}
      </div>
      <div class="masthead-meta">
        <span>${esc(masthead.institution)}</span>
        ${socialNavHtml(pub.social, pub.name, 'masthead-social')}
      </div>
    </div>
  </div>
</header>
${radio}
${weatherDockHtml()}
${sportsStripHtml(ctx)}
<nav class="nav-wrap" aria-label="Sections">
  <div class="wrap">
    <div class="nav-shell" data-nav-shell>
      <div class="nav">
      ${navLinksHtml(nav, { current: options.current, editorial })}
      </div>
      <button type="button" class="nav-toggle" data-nav-toggle hidden aria-expanded="false">Toutes les rubriques</button>
    </div>
  </div>
</nav>
<main id="contenu">
${content}
</main>
<footer class="site-foot">
  <div class="wrap">
    <div class="site-foot__brand">
      <p class="site-foot__wordmark">${esc(pub.name)}</p>
      <p class="site-foot__signature"${footSignature(pub) ? '' : ' hidden'}>${esc(footSignature(pub))}</p>
      ${socialNavHtml(pub.social, pub.name, 'site-foot__social')}
    </div>
    <nav class="site-foot__nav" aria-label="Sections, pied de page">
      ${footerNavHtml(nav, { current: options.current, editorial })}
    </nav>
    <nav class="site-foot__links" aria-label="Liens de pied de page">
      ${pub.noindex ? '' : `<a href="${asset('/feed.xml', ctx)}">Flux RSS</a><span class="site-foot__sep" aria-hidden="true">·</span>`}
      <a href="${asset('/archives/', ctx)}"${editorial ? ' data-editorial-link' : ''}>Archives</a>
      <span class="site-foot__sep" aria-hidden="true">·</span>
      <a href="${asset('/plan-du-site/', ctx)}"${editorial ? ' data-editorial-link' : ''}>Plan du site</a>
      <span class="site-foot__sep" aria-hidden="true">·</span>
      <a href="${asset('/revue/', ctx)}"${editorial ? ' data-editorial-link' : ''}>Revue</a>
      <span class="site-foot__sep" aria-hidden="true">·</span>
      <a href="${asset('/recherche/', ctx)}"${editorial ? ' data-editorial-link' : ''}>Recherche</a>
    </nav>
    <div class="site-foot__credit">
      ${
        pub.governance.contact
          ? `<p class="site-foot__contact"><a href="mailto:${esc(pub.governance.contact)}">${esc(pub.governance.contact)}</a>${
              footSteward(pub) ? ` · ${esc(footSteward(pub))}` : ''
            }</p>`
          : footSteward(pub)
            ? `<p class="site-foot__contact">${esc(footSteward(pub))}</p>`
            : ''
      }
      <p class="site-foot__legal">${footCopyright(pub, ctx.buildYear)}</p>
      <p class="site-foot__built">${footBuiltHtml(ctx.redactionHref ?? asset('/redaction/', ctx), showDemoEditorialEntry(ctx))}</p>
    </div>
  </div>
</footer>
<!-- Outils bas de page : flèche « haut de page » juste à gauche de la loupe, en bas à droite. -->
<div class="page-tools" id="page-tools" data-page-tools>
  <button
    type="button"
    class="page-tools__fab page-tools__top"
    id="page-scroll-top"
    aria-label="Haut de page"
    title="Haut de page"
    hidden
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>
    </svg>
  </button>
  <div id="news-search" class="news-search">
    <div id="news-search-panel" class="news-search__panel" role="search" hidden aria-hidden="true">
      <label class="sr-only" for="news-search-input">Rechercher dans le journal</label>
      <div class="news-search__field">
        <svg class="news-search__field-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>
        </svg>
        <input
          id="news-search-input"
          class="news-search__input"
          type="search"
          enterkeyhint="search"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="Titre, auteur, rubrique…"
        />
        <button type="button" id="news-search-clear" class="news-search__clear hidden" aria-label="Effacer la recherche" title="Effacer">×</button>
      </div>
      <p id="news-search-hint" class="news-search__hint">Recherche locale : titres, auteurs, rubriques et extraits déjà sur la page.</p>
    </div>
    <button
      type="button"
      id="news-search-toggle"
      class="news-search__fab"
      aria-label="Rechercher dans le journal"
      aria-expanded="false"
      aria-controls="news-search-panel"
      title="Rechercher"
    >
      <svg class="news-search__fab-loupe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>
      </svg>
      <svg class="news-search__fab-close hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18"/>
      </svg>
    </button>
  </div>
</div>
<script src="${asset('/assets/bg-rotation-lib.js', ctx)}" defer></script>
<script src="${asset('/assets/sports-board-lib.js', ctx)}" defer></script>
<script src="${asset('/assets/kiosque.js', ctx)}" defer></script>
${ctx.editorial ? `<script>window.KIOSQUE_EDITORIAL=${JSON.stringify(ctx.editorial.mode === 'socle-vivant'
  // Paquet complet : le socle PHP de la même installation remet le sous-dossier dans ces chemins.
  ? { mode: 'socle-vivant', apiBase: ctx.basePath, publicBasePath: ctx.basePath, adminBasePath: `${ctx.basePath}/redaction`, assetsBase: ctx.editorial.assetsBase }
  : { mode: 'demo-local', publicBasePath: ctx.basePath, adminBasePath: (ctx.redactionHref ?? `${ctx.basePath}/admin`).replace(/\/+$/, ''), assetsBase: ctx.editorial.assetsBase, seedUrl: ctx.editorial.seedUrl, publicationSlug: pub.slug, databaseKey: ctx.editorial.databaseKey, demoEditorialEntry: showDemoEditorialEntry(ctx) }).replace(/</g, '\\u003c')};</script>
<script type="module" src="${ctx.editorial.assetsBase}/front.js"></script>` : ''}
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

/**
 * Fil magazine (LE-RADAR) : 1 une + vedettes (vignette à gauche) + En bref + suite.
 * Partagé par l’accueil, les sections et les catégories — une seule structure.
 */
export function magazineFeedHtml(
  articles: Article[],
  ctx: RenderContext,
  opts: { heroLabel: string; empty: string; rail?: string },
): string {
  if (!articles.length) return `<p class="empty">${esc(opts.empty)}</p>`;
  const featured = articles.find((item) => item.featured);
  const first = featured ?? articles[0];
  const rest = articles.filter((item) => item.id !== first.id);
  // 3 vedettes + jusqu’à 6 en bref (graine). Le JS peut encore trimmer
  // la dernière carte si En bref dépasse le hero (règle d’équité LE-RADAR).
  const features = rest.slice(0, 3);
  const briefs = rest.slice(3, 9);
  const tail = rest.slice(9);
  return `<div class="magazine-layout">
      <section class="news-hero" aria-label="${esc(opts.heroLabel)}">
        ${articleCard(first, ctx, 'lead')}
        <div class="news-features">${features.map((a) => articleCard(a, ctx, 'feature')).join('\n')}</div>
      </section>
      ${
        briefs.length
          ? `<aside class="brief-rail" aria-label="En bref"><h2>En bref</h2>${briefs.map((a) => articleCard(a, ctx, 'brief')).join('\n')}</aside>`
          : (opts.rail ?? '')
      }
      ${
        tail.length
          ? `<section class="news-tail" data-tail-visible="10">
        <h2 class="news-tail-title">Suite du fil</h2>
        <div class="news-tail-body news-tail-grid">${tail.map((a) => articleCard(a, ctx, 'tail')).join('\n')}</div>
      </section>`
          : ''
      }
    </div>`;
}

export function homePage(articles: Article[], ctx: RenderContext): string {
  const wireTitle = ctx.publication.labels?.wireTitle || 'Le fil étudiant';
  return page(
    `<div class="wrap wire">
      <div class="wire-head">
        <h1 class="wire-title">${esc(wireTitle)}</h1>
        ${articles.length ? `<span class="wire-status">${articles.length} article${articles.length > 1 ? 's' : ''}</span>` : ''}
      </div>
      ${magazineFeedHtml(articles, ctx, {
        heroLabel: wireTitle,
        empty: 'Aucun article publié pour le moment.',
        rail: homeRailHtml({ publication: ctx.publication, sections: ctx.taxonomies.sections, articles, base: ctx.basePath, linkAttributes: '' }),
      })}
    </div>`,
    {
      title: [ctx.publication.name, ctx.publication.tagline || ctx.publication.institution].filter(Boolean).join(' — '),
      canonical: `${ctx.publication.siteUrl}/`,
      current: asset('/', ctx),
    },
    ctx,
  );
}

/** Nombre d’articles dans le rail « En bref » des pages article (sans scroll). */
const ARTICLE_BRIEF_COUNT = 5;

/**
 * Page d’un article.
 * @param relatedArticles articles listés (déjà triés du plus récent), hors l’article courant —
 *        alimente le rail « En bref » (particularité Kiosque).
 */
export function articlePage(article: Article, ctx: RenderContext, relatedArticles: Article[] = []): string {
  const pub = ctx.publication;
  const section = sectionName(article.section, ctx);
  const date = article.publishedAt ?? article.updatedAt;
  const lead = article.lead;
  const briefs = relatedArticles
    .filter((item) => item.slug !== article.slug)
    .slice(0, ARTICLE_BRIEF_COUNT);

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    inLanguage: article.lang,
    mainEntityOfPage: article.canonicalUrl,
    image: lead ? `${pub.siteUrl}${lead.src}` : undefined,
    author: article.authors.map((s) => ({
      '@type': 'Person',
      name: ctx.authorsBySlug.get(s)?.name ?? s,
    })),
    publisher: { '@type': 'Organization', name: pub.name },
  }).replace(/</g, '\\u003c');

  const tags = article.tags
    .map((t) => ctx.taxonomies.tags.find((x) => x.slug === t))
    .filter(Boolean)
    .map((t) => `<span class="tag">${esc(t!.name)}</span>`)
    .join('\n      ');
  const categories = article.categories
    .map((slug) => ctx.taxonomies.categories.find((category) => category.slug === slug))
    .filter(Boolean)
    .map((category) => `<a class="tag" href="${asset(`/categories/${category!.slug}/`, ctx)}">${esc(category!.name)}</a>`)
    .join('\n      ');

  const caption = [lead?.caption, lead && photoCredit(lead)]
    .filter(Boolean)
    .map((x) => esc(x))
    .join(' — ');

  // Rubrique (section) en tête — repli sur la première catégorie colorée si
  // la section n’est pas renseignée (même priorité que les cartes d’accueil).
  const categoryFallback = article.categories
    .map((slug) => ctx.taxonomies.categories.find((c) => c.slug === slug))
    .find((c) => c?.name);
  const eyebrowName = section?.name || categoryFallback?.name;
  const eyebrowColor = section?.color || categoryFallback?.color;
  const eyebrowHref = section
    ? safeUrl(relative(sectionUrl(pub, section.slug), ctx))
    : categoryFallback
      ? asset(`/categories/${categoryFallback.slug}/`, ctx)
      : '';
  const eyebrow = eyebrowName
    ? eyebrowHref
      ? `<a class="post-eyebrow" href="${eyebrowHref}"${eyebrowColor ? ` style="--c:${esc(eyebrowColor)}"` : ''}>${esc(eyebrowName)}</a>`
      : `<span class="post-eyebrow"${eyebrowColor ? ` style="--c:${esc(eyebrowColor)}"` : ''}>${esc(eyebrowName)}</span>`
    : '';

  const post = `<article class="post post--in-magazine">
      ${eyebrow}
      <h1 class="post-title">${esc(article.title)}</h1>
      ${article.subtitle ? `<p class="post-subtitle">${esc(article.subtitle)}</p>` : ''}
      ${article.dek ? `<p class="post-dek">${esc(article.dek)}</p>` : ''}
      <div class="post-meta">
        ${
          article.authors.length
            ? `<span>Par ${article.authors
                .map(
                  (s) =>
                    `<a href="${safeUrl(relative(authorUrl(pub, s), ctx))}" target="_blank" rel="noopener noreferrer">${esc(ctx.authorsBySlug.get(s)?.name ?? s)}</a>`,
                )
                .join(', ')}</span>`
            : ''
        }
        <time datetime="${esc(date)}">${formatDateTime(date, pub.timeZone)}</time>
        ${
          article.updatedAt && article.publishedAt && article.updatedAt > article.publishedAt
            ? `<span>Mis à jour le ${formatDateTime(article.updatedAt, pub.timeZone)}</span>`
            : ''
        }
      </div>
      ${shareButtons(article.title, article.canonicalUrl || `${String(ctx.publication.siteUrl || '').replace(/\/+$/, '')}/articles/${article.slug}/`)}
      <div class="post-flow">
      ${
        lead
          ? (() => {
              const pos = `object-position:${clampPercent(lead.focalPoint?.x)}% ${clampPercent(lead.focalPoint?.y)}%`;
              /* Pas d’aspect-ratio forcé en HTML : l’impression doit pouvoir
                 compresser la lead sans min-height / ratio écran. */
              return `<figure class="post-lead">
        <img class="post-lead__img" ${srcsetHtml(responsiveAttrs(lead, ctx, SIZES_POST))} alt="${esc(lead.alt || '')}" decoding="async" fetchpriority="high"${lead.width ? ` width="${lead.width}"` : ''}${lead.height ? ` height="${lead.height}"` : ''} style="${pos}">
        ${caption ? `<figcaption class="post-lead__credit">${caption}</figcaption>` : ''}
      </figure>`;
            })()
          : ''
      }
      <div class="post-body">
${article.body.html ?? ''}
      </div>
      </div>
      ${categories || tags ? `<div class="post-tags">\n      ${categories}\n      ${tags}\n      </div>` : ''}
    </article>`;

  // Même grille que l’accueil : article à gauche, « En bref » à droite
  // (articles les plus récents sauf l’article affiché).
  const body = `<div class="wrap wire wire--article">
      <div class="magazine-layout magazine-layout--article">
        <div class="article-column">${post}</div>
        ${
          briefs.length
            ? `<aside class="brief-rail brief-rail--article" aria-label="En bref">
          <h2>En bref</h2>
          ${briefs.map((item) => articleCard(item, ctx, 'brief')).join('\n          ')}
        </aside>`
            : ''
        }
      </div>
    </div>`;

  return page(
    body,
    {
      title: `${article.title} — ${pub.name}`,
      description: article.excerpt,
      canonical: article.canonicalUrl,
      image: lead ? `${pub.siteUrl}${lead.src}` : undefined,
      type: 'article',
      bodyClass: 'is-article-page',
      jsonLd,
    },
    ctx,
  );
}

export function sectionPage(section: Section, articles: Article[], ctx: RenderContext): string {
  // Section Sports : même contenu que la puce mât (« Au tableau ») — scores
  // + articles, pas seulement le fil. Les deux routes restent valides.
  if (section.slug === 'sports') {
    const sports = ctx.publication.masthead?.sports;
    const teams = sports && sports.enabled !== false ? sportsTeamRoster(sports) : [];
    if (teams.length) return sportsResultsPage(ctx, articles);
  }
  return page(
    `<div class="wrap wire">
      <div class="wire-head">
        <h1 class="wire-title">${esc(section.name)}</h1>
        ${articles.length ? `<span class="wire-status">${articles.length} article${articles.length > 1 ? 's' : ''}</span>` : ''}
      </div>
      ${section.description ? `<p class="section-intro">${esc(section.description)}</p>` : ''}
      ${magazineFeedHtml(articles, ctx, {
        heroLabel: section.name,
        empty: 'Aucun article dans cette section.',
      })}
    </div>`,
    {
      title: `${section.name} — ${ctx.publication.name}`,
      description: section.description,
      canonical: sectionUrl(ctx.publication, section.slug),
      current: asset(`/sections/${section.slug}/`, ctx),
    },
    ctx,
  );
}

export function categoryPage(category: { slug: string; name: string; description?: string }, articles: Article[], ctx: RenderContext): string {
  const base = ctx.publication.siteUrl.replace(/\/+$/, '');
  return page(
    `<div class="wrap wire">
      <div class="wire-head">
        <h1 class="wire-title">${esc(category.name)}</h1>
        ${articles.length ? `<span class="wire-status">${articles.length} article${articles.length > 1 ? 's' : ''}</span>` : ''}
      </div>
      ${category.description ? `<p class="section-intro">${esc(category.description)}</p>` : ''}
      ${magazineFeedHtml(articles, ctx, {
        heroLabel: category.name,
        empty: 'Aucun article dans cette catégorie.',
      })}
    </div>`,
    {
      title: `${category.name} — ${ctx.publication.name}`,
      description: category.description,
      canonical: `${base}/categories/${category.slug}/`,
      current: asset(`/categories/${category.slug}/`, ctx),
    },
    ctx,
  );
}

function authorInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function authorAvatarHtml(author: Author, ctx: RenderContext, opts: { size?: number; link?: boolean } = {}): string {
  const size = opts.size ?? 88;
  const href = safeUrl(relative(authorUrl(ctx.publication, author.slug), ctx));
  const av = author.avatar;
  const initials = authorInitials(author.name);
  const fallback = `<span class="author-avatar__initials" aria-hidden="true">${esc(initials || '?')}</span>`;
  let media: string;
  if (av?.src) {
    const pos = av.focalPoint
      ? `object-position:${esc(String(av.focalPoint.x))}% ${esc(String(av.focalPoint.y))}%`
      : 'object-position:50% 35%';
    /* Fiche auteur : eager (évite flash initiales → photo). Liste : lazy. */
    const loading = opts.link === false ? 'eager' : 'lazy';
    const prio = opts.link === false ? ' fetchpriority="high"' : '';
    /* Initiales derrière la photo : si 404, le cercle reste lisible. */
    media = `${fallback}<img class="author-avatar__img" src="${safeUrl(asset(av.src, ctx))}" alt="${esc(av.alt || `Portrait de ${author.name}`)}" width="${size}" height="${size}" loading="${loading}" decoding="async"${prio} style="${pos}" onerror="this.remove()">`;
  } else {
    media = fallback;
  }
  const inner = `<span class="author-avatar" style="--author-avatar-size:${size}px">${media}</span>`;
  if (opts.link === false) return inner;
  return `<a class="author-avatar-link" href="${href}" aria-hidden="true" tabindex="-1">${inner}</a>`;
}

function briefRailHtml(articles: Article[], ctx: RenderContext, limit = 7): string {
  const briefs = articles.slice(0, limit);
  if (!briefs.length) return '';
  return `<aside class="brief-rail" aria-label="En bref"><h2>En bref</h2>${briefs.map((a) => articleCard(a, ctx, 'brief')).join('\n')}</aside>`;
}

export function authorPage(author: Author, articles: Article[], ctx: RenderContext): string {
  return page(
    `<div class="wrap wire">
      <header class="author-page-head">
        ${authorAvatarHtml(author, ctx, { size: 112, link: false })}
        <div class="author-page-head__text">
          <div class="wire-head" style="margin:0;border:0;padding:0">
            <h1 class="wire-title">${esc(author.name)}</h1>
            <span class="wire-status">${articles.length} signature${articles.length > 1 ? 's' : ''}${author.active === false ? ' · Alumni' : ''}</span>
          </div>
          ${author.role || author.cohort
            ? `<p class="author-role">${[
                author.role ? esc(author.role) : '',
                author.cohort ? `cohorte ${esc(author.cohort)}` : '',
              ]
                .filter(Boolean)
                .join(' · ')}</p>`
            : ''}
          ${author.bio ? `<p class="author-bio">${esc(author.bio)}</p>` : ''}
        </div>
      </header>
      ${
        articles.length
          ? magazineFeedHtml(articles, ctx, {
              heroLabel: `Articles de ${author.name}`,
              empty: 'Aucun article signé pour le moment.',
            })
          : '<p class="empty">Aucun article signé pour le moment.</p>'
      }
    </div>`,
    {
      title: `${author.name} — ${ctx.publication.name}`,
      description: author.bio,
      canonical: authorUrl(ctx.publication, author.slug),
      image: author.avatar?.src
        ? author.avatar.src.startsWith('http')
          ? author.avatar.src
          : `${ctx.publication.siteUrl.replace(/\/+$/, '')}${author.avatar.src.startsWith('/') ? '' : '/'}${author.avatar.src}`
        : undefined,
    },
    ctx,
  );
}

export function authorsIndexPage(
  authors: Author[],
  counts: Map<string, number>,
  ctx: RenderContext,
  recentArticles: Article[] = [],
): string {
  const render = (list: Author[], alumni = false) =>
    list
      .map(
        (a) => `
      <div class="author-card${alumni ? ' author-card--alumni' : ''}">
        ${authorAvatarHtml(a, ctx, { size: 88 })}
        <div class="author-card__body">
          <h2 class="author-name"><a href="${safeUrl(relative(authorUrl(ctx.publication, a.slug), ctx))}" style="text-decoration:none;color:inherit">${esc(a.name)}</a>${alumni ? ' <span class="author-badge">Alumni</span>' : ''}</h2>
          ${a.role ? `<p class="author-role">${esc(a.role)}</p>` : ''}
          ${a.cohort ? `<p class="author-cohort">Cohorte ${esc(a.cohort)}</p>` : ''}
          ${a.bio ? `<p class="author-bio">${esc(a.bio)}</p>` : ''}
          <p class="author-role">${counts.get(a.slug) ?? 0} article${(counts.get(a.slug) ?? 0) > 1 ? 's' : ''}</p>
        </div>
      </div>`,
      )
      .join('\n');

  const active = authors.filter((a) => a.active !== false);
  const past = authors.filter((a) => a.active === false);
  const brief = briefRailHtml(recentArticles, ctx, 7);

  return page(
    `<div class="wrap wire">
      <div class="wire-head">
        <h1 class="wire-title">L’équipe</h1>
        <span class="wire-status">${active.length} membre${active.length > 1 ? 's' : ''} · ${past.length} alumni</span>
      </div>
      <p class="section-intro">L’équipe en poste : rôle, cohorte et bio de chaque signature.</p>
      <div class="magazine-layout magazine-layout--team">
        <div class="article-column team-column">
          ${render(active, false)}
          ${
            past.length
              ? `<div class="wire-head team-alumni-head"><h2 class="wire-title">Alumni</h2></div>
          <p class="section-intro">Membres ayant gradué ou quitté la rédaction. Leurs signatures restent : une archive ne se réécrit pas quand quelqu’un part.</p>
          ${render(past, true)}`
              : ''
          }
        </div>
        ${brief}
      </div>
    </div>`,
    {
      title: `L’équipe — ${ctx.publication.name}`,
      canonical: `${ctx.publication.siteUrl}/auteurs/`,
      current: asset('/auteurs/', ctx),
    },
    ctx,
  );
}

// ---------------------------------------------------------------------------
// Archives (registre chronologique du journal)
// ---------------------------------------------------------------------------
//
// Différence volontaire avec LE-RADAR : ici le journal héberge *son* contenu
// sur *son* serveur. Les fiches d’archive gardent donc vignettes, extraits,
// crédits photo et liens internes vers /articles/<slug>/ — pas un simple
// renvoi vers un média tiers. Le fil d’accueil reste le « fil vivant » ;
// published + archived (jamais les brouillons). Lisible sans JavaScript.

function archiveYearOf(article: Article, timeZone: string): number {
  const iso = article.publishedAt ?? article.updatedAt;
  const parts = dateParts(iso, timeZone);
  if (parts?.year) return Number(parts.year);
  const d = iso ? new Date(iso) : new Date();
  return Number.isNaN(d.getTime()) ? new Date().getUTCFullYear() : d.getUTCFullYear();
}

/** Groupement année → articles (années desc., articles déjà triés). */

/** Boutons de partage sans pistage : copies, courriel, et liens d'intention. */
export function shareButtons(title: string, url: string): string {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  return `<aside class="share" aria-label="Partager">
    <p class="share__label">Partager</p>
    <div class="share__actions">
      <button type="button" class="share__btn" data-share="copy" data-share-url="${esc(url)}">Copier le lien</button>
      <a class="share__btn" href="mailto:?subject=${encodedTitle}&body=${encodedUrl}">Courriel</a>
      <a class="share__btn" href="https://bsky.app/intent/compose?text=${encodedTitle}%20${encodedUrl}" target="_blank" rel="noopener noreferrer">Bluesky</a>
      <button type="button" class="share__btn" data-share="mastodon" data-share-url="${esc(url)}" data-share-title="${esc(title)}">Mastodon</button>
      <a class="share__btn" href="https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}" target="_blank" rel="noopener noreferrer">Facebook</a>
      <a class="share__btn" href="https://x.com/intent/post?text=${encodedTitle}&url=${encodedUrl}" target="_blank" rel="noopener noreferrer">X</a>
    </div>
  </aside>`;
}

export function searchPage(articles: Article[], ctx: RenderContext): string {
  const index = articles.map((article) => ({
    title: article.title,
    excerpt: article.excerpt || '',
    href: asset(`/articles/${article.slug}/`, ctx),
    authors: article.authors.map((slug) => ctx.authorsBySlug.get(slug)?.name ?? slug).join(', '),
  }));
  return page(
    `<div class="wrap wire">
      <div class="wire-head"><h1 class="wire-title">Recherche</h1></div>
      <form class="search-form" method="get" action="${asset('/recherche/', ctx)}" role="search">
        <label>Chercher dans le journal<input type="search" name="q" value="" placeholder="Un titre, un nom, un mot" id="recherche-q"></label>
        <button type="submit" class="primary">Rechercher</button>
      </form>
      <div id="recherche-results"><p class="empty">Écrivez un mot, un titre ou un nom, puis lancez la recherche.</p></div>
      <script type="application/json" id="recherche-index">${JSON.stringify(index).replace(/</g, '\\u003c')}</script>
    </div>`,
    { title: `Recherche — ${ctx.publication.name}`, canonical: `${ctx.publication.siteUrl.replace(/\/+$/, '')}/recherche/` },
    ctx,
  );
}

export function revuePage(articles: Article[], ctx: RenderContext): string {
  const picks = articles.slice(0, 12);
  const pieces = picks.map((article) => {
    const names = article.authors.map((slug) => ctx.authorsBySlug.get(slug)?.name ?? slug).join(', ');
    const date = article.publishedAt || article.updatedAt;
    const body = article.body?.raw ? `<div class="post-body">${article.body.format === 'html' ? article.body.raw : ''}</div>` : (article.excerpt ? `<p>${esc(article.excerpt)}</p>` : '');
    return `<article class="revue-piece"><h2>${esc(article.title)}</h2><p class="post-meta">${esc(names)} · <time datetime="${esc(date)}">${esc(date)}</time></p>${body}<p class="revue-piece__link"><a href="${asset(`/articles/${article.slug}/`, ctx)}">Lire sur le site</a></p></article>`;
  }).join('');
  return page(
    `<div class="wrap wire wire--revue">
      <div class="wire-head"><h1 class="wire-title">Revue</h1>${picks.length ? `<span class="wire-status">${picks.length} article${picks.length > 1 ? 's' : ''}</span>` : ''}</div>
      <p class="section-intro">Une édition à imprimer : les articles récents, à la suite, sans le mât ni la radio. Utilisez « Imprimer » dans votre navigateur, ou le bouton ci-dessous.</p>
      <p class="revue-actions noprint"><button type="button" class="primary" data-revue-print>Imprimer la revue</button></p>
      ${picks.length ? pieces : '<p class="empty">Aucun article à mettre dans la revue pour le moment.</p>'}
    </div>`,
    { title: `Revue — ${ctx.publication.name}`, canonical: `${ctx.publication.siteUrl.replace(/\/+$/, '')}/revue/` },
    ctx,
  );
}

export function groupArticlesByYear(articles: Article[], timeZone: string): Array<{ year: number; articles: Article[] }> {
  const buckets = new Map<number, Article[]>();
  for (const article of articles) {
    const year = archiveYearOf(article, timeZone);
    const list = buckets.get(year);
    if (list) list.push(article);
    else buckets.set(year, [article]);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, list]) => ({ year, articles: list }));
}

/**
 * Fiche d’archive riche : même carte « vedette » que le fil (vignette à gauche
 * si photo, extrait, « Lire la suite »), car le multimédia est local.
 */
function archiveRecordHtml(article: Article, ctx: RenderContext): string {
  const offWire = article.status === 'archived';
  // feature = vignette + extrait long ; sans lead, la carte reste textuelle.
  const card = articleCard(article, ctx, 'feature');
  return `<div class="archive-entry${offWire ? ' archive-entry--off-wire' : ''}">
  ${offWire ? '<p class="archive-entry__badge"><span class="archive-record__badge">Hors fil</span></p>' : ''}
  ${card}
</div>`;
}

function archivesJsonLd(
  ctx: RenderContext,
  options: { name: string; url: string; description: string; articles: Article[] },
): string {
  const pub = ctx.publication;
  const base = pub.siteUrl.replace(/\/+$/, '');
  const items = options.articles.slice(0, 100).map((article, i) => {
    const url = articleUrl(pub, article);
    const authors = article.authors
      .map((slug) => ctx.authorsBySlug.get(slug)?.name ?? slug)
      .filter(Boolean);
    const imageSrc = article.lead?.src
      ? article.lead.src.startsWith('http')
        ? article.lead.src
        : `${base}${article.lead.src.startsWith('/') ? '' : '/'}${article.lead.src}`
      : undefined;
    return {
      '@type': 'ListItem',
      position: i + 1,
      url,
      item: {
        '@type': 'NewsArticle',
        headline: article.title,
        url,
        datePublished: article.publishedAt ?? article.updatedAt,
        dateModified: article.updatedAt,
        inLanguage: pub.lang || 'fr',
        ...(article.excerpt ? { description: article.excerpt } : {}),
        ...(imageSrc ? { image: imageSrc } : {}),
        ...(authors.length
          ? { author: authors.map((name) => ({ '@type': 'Person', name })) }
          : {}),
        publisher: {
          '@type': 'NewsMediaOrganization',
          name: pub.name,
          url: `${base}/`,
        },
      },
    };
  });
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: options.name,
    url: options.url,
    description: options.description,
    isPartOf: { '@type': 'WebSite', name: pub.name, url: `${base}/` },
    publisher: { '@type': 'NewsMediaOrganization', name: pub.name, url: `${base}/` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: options.articles.length,
      itemListElement: items,
    },
  }).replace(/</g, '\\u003c');
}

function archiveYearSectionHtml(year: number, articles: Article[], ctx: RenderContext, linkYear = true): string {
  const head = linkYear
    ? `<h2 class="archive-year__title" id="archive-y-${year}"><a href="${asset(`/archives/${year}/`, ctx)}">${year}</a></h2>`
    : `<h2 class="archive-year__title" id="archive-y-${year}">${year}</h2>`;
  return `<section class="archive-year" id="annee-${year}" aria-labelledby="archive-y-${year}">
  <div class="archive-year__head">
    ${head}
    <span class="archive-year__count">${articles.length} article${articles.length > 1 ? 's' : ''}</span>
  </div>
  <div class="archive-year__list">
  ${articles.map((a) => archiveRecordHtml(a, ctx)).join('\n  ')}
  </div>
</section>`;
}

/**
 * Catalogue chronologique du journal — tous les articles qui ont une page
 * publique (published + archived), regroupés par année de publication.
 */
export function archivesPage(articles: Article[], ctx: RenderContext): string {
  const pub = ctx.publication;
  const base = pub.siteUrl.replace(/\/+$/, '');
  const canonical = `${base}/archives/`;
  const groups = groupArticlesByYear(articles, pub.timeZone);
  const title = `Archives — ${pub.name}`;
  const description =
    `Archives de ${pub.name}` +
    (pub.institution ? `, journal étudiant de ${pub.institution}` : '') +
    `. ${articles.length} article${articles.length > 1 ? 's' : ''} classé${articles.length > 1 ? 's' : ''} par année — textes, photos et liens permanents hébergés ici.`;

  // Une seule année : pas de barre des années (elle répétait « 2026 » au-dessus du titre « 2026 »).
  const yearNav = groups.length > 1
    ? `<nav class="archive-year-nav" aria-label="Années d’archives">
      ${groups
        .map(
          (g) =>
            `<a href="${asset(`/archives/${g.year}/`, ctx)}">${g.year}<span class="archive-year-nav__count">${g.articles.length}</span></a>`,
        )
        .join('\n      ')}
    </nav>`
    : '';

  const body = groups.length
    ? groups.map((g) => archiveYearSectionHtml(g.year, g.articles, ctx, true)).join('\n')
    : '<p class="empty">Aucun article dans les archives pour le moment.</p>';

  return page(
    `<div class="wrap wire wire--archives">
  <nav class="archive-crumbs" aria-label="Fil d’Ariane"><a href="${asset('/', ctx)}">Accueil</a><span class="archive-crumbs__sep" aria-hidden="true">›</span><span aria-current="page">Archives</span></nav>
  <div class="wire-head">
    <h1 class="wire-title">Archives</h1>
    <span class="wire-status">${articles.length} article${articles.length > 1 ? 's' : ''}</span>
  </div>
  <p class="section-intro">${esc(description)}</p>
  <p class="archive-lead">Le fil d’accueil met en avant l’actualité récente. Les archives sont le registre complet du journal : chaque article garde sa page, sa photo et son adresse permanente — y compris les pièces retirées du fil (« hors fil »).</p>
  ${yearNav}
  ${body}
</div>`,
    {
      title,
      description,
      canonical,
      current: asset('/archives/', ctx),
      jsonLd: archivesJsonLd(ctx, { name: title, url: canonical, description, articles }),
    },
    ctx,
  );
}

/** Une année d’archives — page ciblée pour le référencement et la navigation. */
export function archivesYearPage(year: number, articles: Article[], ctx: RenderContext): string {
  const pub = ctx.publication;
  const base = pub.siteUrl.replace(/\/+$/, '');
  const canonical = `${base}/archives/${year}/`;
  const title = `Archives ${year} — ${pub.name}`;
  const description =
    `Articles de ${pub.name} publiés en ${year}` +
    (pub.institution ? ` (${pub.institution})` : '') +
    `. ${articles.length} article${articles.length > 1 ? 's' : ''} avec médias et liens hébergés sur ce site.`;

  const body = articles.length
    ? archiveYearSectionHtml(year, articles, ctx, false)
    : '<p class="empty">Aucun article pour cette année.</p>';

  return page(
    `<div class="wrap wire wire--archives">
  <nav class="archive-crumbs" aria-label="Fil d’Ariane"><a href="${asset('/', ctx)}">Accueil</a><span class="archive-crumbs__sep" aria-hidden="true">›</span><a href="${asset('/archives/', ctx)}">Archives</a><span class="archive-crumbs__sep" aria-hidden="true">›</span><span aria-current="page">${year}</span></nav>
  <div class="wire-head">
    <h1 class="wire-title">Archives ${year}</h1>
    <span class="wire-status">${articles.length} article${articles.length > 1 ? 's' : ''}</span>
  </div>
  <p class="section-intro">${esc(description)}</p>
  <p class="archive-back"><a href="${asset('/archives/', ctx)}">← Toutes les années</a></p>
  ${body}
</div>`,
    {
      title,
      description,
      canonical,
      current: asset('/archives/', ctx),
      jsonLd: archivesJsonLd(ctx, { name: title, url: canonical, description, articles }),
    },
    ctx,
  );
}

/**
 * Page de redirection pour une ancienne URL. GitHub Pages ne sait pas rediriger
 * côté serveur : on émet donc une page qui porte le `rel=canonical` (pour les
 * moteurs), un `meta refresh` (pour les navigateurs sans JS) et un lien visible
 * (pour tout le monde). Un lien partagé il y a cinq ans continue de fonctionner.
 */
export function redirectPage(target: string, ctx: RenderContext): string {
  return `<!doctype html>
<html lang="${esc(ctx.publication.lang)}">
<head>
<meta charset="utf-8">
<title>Page déplacée</title>
<link rel="canonical" href="${safeUrl(target)}">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="0; url=${safeUrl(target)}">
<style>body{font-family:system-ui,sans-serif;max-width:34rem;margin:18vh auto;padding:0 1.5rem;line-height:1.6}</style>
</head>
<body>
<h1>Cette page a été déplacée</h1>
<p>Elle se trouve désormais ici : <a href="${safeUrl(target)}">${esc(target)}</a></p>
<script>location.replace(${JSON.stringify(target)});</script>
</body>
</html>
`;
}
