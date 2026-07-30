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
import { pruneSportsPayload } from './sports-freshness.js';

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
  /** Année de génération, pour le pied de page. */
  buildYear: number;
  /** Active uniquement pour la démonstration éditoriale PGlite. */
  editorial?: {
    mode: 'demo-local';
    assetsBase: string;
    seedUrl: string;
    databaseKey: string;
  };
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
    logo: publication.logo,
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
  return `${ctx.basePath}${path}`;
}

function sectionName(slug: string | undefined, ctx: RenderContext): Section | undefined {
  return ctx.taxonomies.sections.find((s) => s.slug === slug);
}

function radioTuner(ctx: RenderContext): string {
  const radio = ctx.publication.radio;
  if (!radio || radio.enabled === false) return '';
  const params = new URLSearchParams();
  if (radio.station) params.set('station', radio.station);
  params.set('surface', 'kiosque-v1');
  const src = `https://le-radar.ca/tuner-embed.html?${params.toString()}`;
  /* data-state=loading : coque peinte dès le 1er paint (pas de [hidden] → pas de
   * saut de layout ni de « pop » à l’arrivée du postMessage ready). */
  return `<radar-tuner class="radar-tuner" data-src="${esc(src)}" data-surface="kiosque-v1" data-state="loading" aria-busy="true">
  <a href="https://le-radar.ca/" rel="noopener">Écouter LE-RADAR</a>
</radar-tuner>`;
}

/** Emplacement sous le tuner pour dock météo + sports mobile (rempli en JS). */
function weatherDockHtml(): string {
  return `<div class="masthead-weather-dock" id="masthead-weather-dock" hidden aria-label="Météo et sports"></div>`;
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
      ? `<a href="${safeUrl(image.creditUrl)}" rel="noopener">Photo : ${esc(image.credit)}</a>`
      : `Photo : ${esc(image.credit)}`
    : '';
  const manifest = settings.images.map((item) => ({
    src: asset(item.src, ctx), alt: item.alt, credit: item.credit ?? '', creditUrl: item.creditUrl ?? '',
    backgroundPosition: `${clampPercent(item.focalPoint?.x)}% ${clampPercent(item.focalPoint?.y)}%`,
  }));
  return `<img class="masthead-background" src="${safeUrl(asset(image.src, ctx))}" alt="" data-masthead-background style="object-position:${esc(options.backgroundPosition)}">
  <span class="masthead-background-shade" aria-hidden="true"></span>
  <span class="masthead-photo-credit" data-masthead-credit>${credit}</span>
  <script type="application/json" id="masthead-backgrounds">${JSON.stringify(manifest).replace(/</g, '\\u003c')}</script>`;
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
  /* Focus-group B : prune sessions (demoAsOf en démo, sinon now). */
  const pruned = pruneSportsPayload(
    {
      teams,
      results: sports.results ?? [],
      nextGame: sports.nextGame ?? null,
      nextGames: sports.nextGames ?? [],
      demoAsOf: sports.demoAsOf,
    },
    { demoAsOf: sports.demoAsOf },
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
    demoAsOf: sports.demoAsOf,
  };
  return `<div class="masthead-sports" data-sports-payload="${esc(JSON.stringify(payload))}" aria-label="Au tableau — scores et matchs" aria-live="polite"></div>`;
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

function formatSportsDate(iso: string, timeZone: string): string {
  if (!iso) return '';
  try {
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
  if (!sex) return '';
  const s = sex.toLowerCase();
  if (s === 'f' || s.startsWith('fémin') || s.startsWith('femin')) {
    return `<span class="sports-panel__sex sports-panel__sex--f" title="Féminin">F</span>`;
  }
  if (s === 'm' || s.startsWith('mascul')) {
    return `<span class="sports-panel__sex sports-panel__sex--m" title="Masculin">M</span>`;
  }
  if (s.includes('mix')) {
    return `<span class="sports-panel__sex sports-panel__sex--x" title="Mixte">Mixte</span>`;
  }
  return `<span class="sports-panel__sex sports-panel__sex--x">${esc(sex)}</span>`;
}

function sportsResultRows(
  team: SportsTeam,
  sports: MastheadSports,
  timeZone: string,
): string {
  const global = (sports.results ?? []).filter((g) => !g.teamId || g.teamId === team.id);
  const nested = team.results ?? [];
  const results = [...nested, ...global]
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 6);

  let next: SportsNextGame | undefined = team.nextGame;
  if (!next && sports.nextGame && (!sports.nextGame.teamId || sports.nextGame.teamId === team.id)) {
    next = sports.nextGame;
  }
  if (!next && sports.nextGames?.length) {
    next = sports.nextGames.find((n) => !n.teamId || n.teamId === team.id);
  }

  // Ordre carte : 1) prochain match (à venir) 2) passés du plus récent au plus ancien.
  const rows: string[] = [];
  if (next) {
    const day = formatSportsDate(next.date, timeZone) || next.date;
    const clock = next.time ? next.time.replace(':', ' h ') : '';
    const timeInner = clock
      ? `<span class="sports-result__day">${esc(day)}</span><span class="sports-result__clock">${esc(clock)}</span>`
      : esc(day);
    const opp = sportsOppHtml(next.opponent, next.opponentInstitution);
    const venue = sportsVenueHtml(next.home);
    const homeAttr = next.home === true ? ' data-home="1"' : next.home === false ? ' data-home="0"' : '';
    rows.push(`<li class="sports-result sports-result--next"${homeAttr}>
  <time class="sports-result__time" datetime="${esc(next.date)}">${timeInner}</time>
  <span class="sports-result__score sports-result__score--next" aria-label="Prochain match">À venir</span>
  <span class="sports-result__title"><span class="sports-result__vs">vs</span> ${opp}${venue}</span>
  <span class="sports-result__badge sports-result__badge--next" title="Prochain match">→</span>
</li>`);
  }
  for (const g of results) {
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
    rows.push(`<li class="sports-result sports-result--${esc(g.result)}${priorClass}" data-result="${esc(g.result)}"${prior ? ' data-prior-season="1"' : ''}${homeAttr}>
  <time class="sports-result__time" datetime="${esc(g.date)}">${esc(formatSportsDate(g.date, timeZone))}</time>
  <span class="sports-result__score" aria-label="${esc(label)}${homeAria}">${g.scoreFor}–${g.scoreAgainst}</span>
  <span class="sports-result__title"><span class="sports-result__vs">vs</span> ${opp}${venue}</span>
  <span class="sports-result__badge" title="${esc(label)}">${badge}</span>${priorMeta}
</li>`);
  }
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
        },
        { demoAsOf: sports.demoAsOf },
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
        <span class="wire-status">${teams.length} formation${teams.length > 1 ? 's' : ''}</span>
      </div>
      <p class="section-intro">Scores et prochains matchs des formations du ${esc(ctx.publication.institution)} — le tableau d’affichage du campus.</p>
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
      description: `Au tableau : scores et prochains matchs des formations du ${ctx.publication.institution}.`,
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
  const sportsHtml = sportsPayload(ctx);
  const button = (href: string, label: string, glyph: string, extraClass = '', currentPage = false) =>
    `<a class="masthead-tool${extraClass ? ` ${extraClass}` : ''}" href="${safeUrl(href)}" aria-label="${esc(label)}" title="${esc(label)}"${currentPage ? ' aria-current="page"' : ''}>${glyph}</a>`;
  return `<div class="masthead-utility">
    <p class="masthead-clock"><span data-masthead-date></span><time data-masthead-time></time></p>
    ${localities.length || sportsHtml
      ? `<div class="masthead-status" data-masthead-status>
    ${localities.length ? `<div class="masthead-weather" data-weather-localities="${esc(JSON.stringify(localities))}" data-meteocons-base="${esc(asset('/assets/meteocons/animated/', ctx))}" aria-label="Météo"></div>` : ''}
    ${sportsHtml}
  </div>`
      : ''}
    <div class="masthead-tools">
      ${button(homeHref, 'Accueil', icon('home', assetsBase), 'masthead-home', current === homeHref)}
      ${button(asset('/feed.xml', ctx), 'Flux RSS', icon('rss', assetsBase), 'masthead-rss')}
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
    /* SPA démo PGlite : ne pas recharger le bandeau ni l’iframe radio. */
    linkAttributes: ctx.editorial ? 'data-editorial-link' : '',
    title: article.title,
    excerpt: article.excerpt,
    readMore: true,
    // Eyebrow manchette ≠ titre du fil (défaut « À la une », pas wireTitle).
    leadEyebrow: labels?.leadEyebrow || 'À la une',
    date: { iso: date, label: formatDateTime(date, ctx.publication.timeZone) },
    authors: article.authors.map((slug) => ({
      name: ctx.authorsBySlug.get(slug)?.name ?? slug,
      href: safeUrl(relative(authorUrl(ctx.publication, slug), ctx)),
    })),
    image: article.lead ? {
      src: safeUrl(asset(article.lead.src, ctx)),
      alt: article.lead.alt,
      caption: article.lead.caption,
      credit: article.lead.credit,
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

<link rel="alternate" type="application/atom+xml" title="${esc(pub.name)}" href="${asset('/feed.xml', ctx)}">
<link rel="stylesheet" href="${asset('/assets/tokens.css', ctx)}">
<link rel="stylesheet" href="${asset('/assets/theme.css', ctx)}">
<link rel="stylesheet" href="${asset('/assets/source-view.css', ctx)}">
<style>:root{--accent:${esc(pub.theme.accent)}}${
    pub.theme.accentDark ? `:root[data-theme="dark"]{--accent:${esc(pub.theme.accentDark)}}` : ''
  }</style>
${options.jsonLd ? `<script type="application/ld+json">${options.jsonLd}</script>\n` : ''}</head>
<body${bodyClasses ? ` class="${esc(bodyClasses)}"` : ''}>
<a class="skip-link" href="#contenu">Aller au contenu</a>
${ctx.demoNotice ? `<div class="demo-banner">${esc(ctx.demoNotice)}</div>` : ''}
<header class="masthead${masthead.image ? ' masthead--illustrated' : ''}" data-text-alignment="${masthead.textAlignment}" style="--masthead-overlay:${masthead.overlayStrength}">
  ${mastheadBackground(ctx, masthead)}
  <div class="wrap">
    ${mastheadTools(ctx, options.current)}
    <div class="masthead-top">
      <div>
        <p class="wordmark"><a href="${asset('/', ctx)}">${masthead.logo ? `<img class="publication-logo" src="${safeUrl(asset(masthead.logo.src, ctx))}" alt="${esc(masthead.logo.alt || masthead.name)}">` : esc(masthead.name)}</a></p>
        ${masthead.signature ? `<p class="masthead-tagline">${esc(masthead.signature)}</p>` : ''}
      </div>
      <div class="masthead-meta">
        <span>${esc(masthead.institution)}</span>
      </div>
    </div>
  </div>
</header>
${radio}
${weatherDockHtml()}
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
      <p class="site-foot__signature">${esc(pub.institution)}${pub.founded ? ` · depuis ${esc(pub.founded)}` : ''}${pub.tagline ? ` — ${esc(pub.tagline)}` : ''}</p>
    </div>
    <nav class="site-foot__nav" aria-label="Sections">
      ${footerNavHtml(nav, { current: options.current, editorial })}
    </nav>
    <nav class="site-foot__links" aria-label="Liens de pied de page">
      <a href="${asset('/feed.xml', ctx)}">Flux RSS</a>
      <span class="site-foot__sep" aria-hidden="true">·</span>
      <a href="${asset('/archives/', ctx)}"${editorial ? ' data-editorial-link' : ''}>Archives</a>
      <span class="site-foot__sep" aria-hidden="true">·</span>
      <a href="${asset('/plan-du-site/', ctx)}"${editorial ? ' data-editorial-link' : ''}>Plan du site</a>
    </nav>
    <div class="site-foot__credit">
      ${
        pub.governance.contact
          ? `<p class="site-foot__contact"><a href="mailto:${esc(pub.governance.contact)}">${esc(pub.governance.contact)}</a>${
              pub.governance.stewardEntity ? ` · ${esc(pub.governance.stewardEntity)}` : ''
            }</p>`
          : pub.governance.stewardEntity
            ? `<p class="site-foot__contact">${esc(pub.governance.stewardEntity)}</p>`
            : ''
      }
      ${pub.license ? `<p class="site-foot__legal">Contenus sous licence ${esc(pub.license)}, sauf mention contraire.</p>` : ''}
      <p class="site-foot__built">Site statique produit par <a href="https://github.com/azdak919/le-kiosque" rel="noopener">Le Kiosque</a> — socle libre pour les journaux étudiants. © ${ctx.buildYear}</p>
    </div>
  </div>
</footer>
<!-- Outils bas de page : haut (gauche) + loupe (droite) — parité LE-RADAR. -->
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
<script src="${asset('/assets/kiosque.js', ctx)}" defer></script>
${ctx.editorial ? `<script>window.KIOSQUE_EDITORIAL=${JSON.stringify({ mode: 'demo-local', publicBasePath: ctx.basePath, adminBasePath: `${ctx.basePath}/admin`, assetsBase: ctx.editorial.assetsBase, seedUrl: ctx.editorial.seedUrl, publicationSlug: pub.slug, databaseKey: ctx.editorial.databaseKey }).replace(/</g, '\\u003c')};</script>
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
  opts: { heroLabel: string; empty: string },
): string {
  if (!articles.length) return `<p class="empty">${esc(opts.empty)}</p>`;
  const [first, ...rest] = articles;
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
          : ''
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
  const wireTitle = ctx.publication.labels?.wireTitle || 'À la une';
  return page(
    `<div class="wrap wire">
      <div class="wire-head">
        <h1 class="wire-title">${esc(wireTitle)}</h1>
        <span class="wire-status">${articles.length} article${articles.length > 1 ? 's' : ''}</span>
      </div>
      ${magazineFeedHtml(articles, ctx, {
        heroLabel: wireTitle,
        empty: 'Aucun article publié pour le moment.',
      })}
    </div>`,
    {
      title: `${ctx.publication.name} — ${ctx.publication.tagline ?? ctx.publication.institution}`,
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

  const caption = [lead?.caption, lead?.credit && `Photo : ${lead.credit}`]
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
      <div class="post-flow">
      ${
        lead
          ? (() => {
              const pos = `object-position:${clampPercent(lead.focalPoint?.x)}% ${clampPercent(lead.focalPoint?.y)}%`;
              /* Pas d’aspect-ratio forcé en HTML : l’impression doit pouvoir
                 compresser la lead sans min-height / ratio écran. */
              return `<figure class="post-lead">
        <img class="post-lead__img" src="${safeUrl(asset(lead.src, ctx))}" alt="${esc(lead.alt || '')}" decoding="async" fetchpriority="high"${lead.width ? ` width="${lead.width}"` : ''}${lead.height ? ` height="${lead.height}"` : ''} style="${pos}">
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
        <span class="wire-status">${articles.length} article${articles.length > 1 ? 's' : ''}</span>
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
        <span class="wire-status">${articles.length} article${articles.length > 1 ? 's' : ''}</span>
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

  const yearNav = groups.length
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
