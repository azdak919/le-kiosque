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
  type MediaAsset,
  type Publication,
  type Section,
  type Taxonomies,
} from '../../core/src/model.ts';
import { renderSourceArticle } from './source-view.js';

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
  return `<radar-tuner class="radar-tuner" data-src="${esc(src)}" data-surface="kiosque-v1" hidden>
  <a href="https://le-radar.ca/" rel="noopener">Écouter LE-RADAR</a>
</radar-tuner>`;
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
    ${localities.length ? `<div class="masthead-weather" data-weather-localities="${esc(JSON.stringify(localities))}" data-meteocons-base="${esc(asset('/assets/meteocons/animated/', ctx))}" aria-label="Météo"></div>` : ''}
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

export function page(content: string, options: PageOptions, ctx: RenderContext): string {
  const pub = ctx.publication;
  const masthead = mastheadOptions(pub);
  const nav = [
    { href: asset('/', ctx), label: 'Accueil', color: undefined as string | undefined },
    ...ctx.taxonomies.sections.map((s) => ({
      href: relative(sectionUrl(pub, s.slug), ctx),
      label: s.name,
      color: s.color,
    })),
    { href: asset('/auteurs/', ctx), label: 'Équipe', color: undefined as string | undefined },
  ];

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
<nav class="nav-wrap" aria-label="Sections">
  <div class="wrap">
    <div class="nav">
      ${nav
        .map((n) => {
          const current = options.current === n.href ? ' aria-current="page"' : '';
          const color = n.color && /^#[0-9a-fA-F]{3,8}$/.test(n.color)
            ? ` class="nav-section" style="--nav-c:${esc(n.color)}"`
            : '';
          return `<a href="${safeUrl(n.href)}"${current}${color}>${esc(n.label)}</a>`;
        })
        .join('\n      ')}
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
    <nav class="site-foot__links" aria-label="Liens de pied de page">
      <a href="${asset('/feed.xml', ctx)}">Flux RSS</a>
      <span class="site-foot__sep" aria-hidden="true">·</span>
      <a href="${asset('/plan-du-site/', ctx)}">Plan du site</a>
      <span class="site-foot__sep" aria-hidden="true">·</span>
      <a href="${asset('/auteurs/', ctx)}">L’équipe</a>${
        pub.governance.repo
          ? `
      <span class="site-foot__sep" aria-hidden="true">·</span>
      <a href="${safeUrl(pub.governance.repo)}" rel="noopener">Code source</a>`
          : ''
      }
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

export function homePage(articles: Article[], ctx: RenderContext): string {
  const [first, ...rest] = articles;
  // Magazine type LE-RADAR : 1 une + plusieurs vedettes empilées (pas côte à côte),
  // puis rail « En bref » et suite. 3 vedettes équilibrent mieux une page de journal
  // unique qu’un agrégateur multi-sources.
  const features = rest.slice(0, 3);
  const briefs = rest.slice(3, 10);
  const tail = rest.slice(10);
  const wireTitle = ctx.publication.labels?.wireTitle || 'À la une';
  const body = !articles.length
    ? '<p class="empty">Aucun article publié pour le moment.</p>'
    : `<div class="magazine-layout">
      <section class="news-hero" aria-label="${esc(wireTitle)}">
        ${articleCard(first, ctx, 'lead')}
        <div class="news-features">${features.map((a) => articleCard(a, ctx, 'feature')).join('\n')}</div>
      </section>
      ${briefs.length ? `<aside class="brief-rail"><h2>En bref</h2>${briefs.map((a) => articleCard(a, ctx, 'brief')).join('\n')}</aside>` : ''}
      ${
        tail.length
          ? `<section class="news-tail" data-tail-visible="10">
        <h2 class="news-tail-title">Suite du fil</h2>
        <div class="news-tail-body news-tail-grid">${tail.map((a) => articleCard(a, ctx, 'tail')).join('\n')}</div>
      </section>`
          : ''
      }
    </div>`;

  return page(
    `<div class="wrap wire">
      <div class="wire-head">
        <h1 class="wire-title">${esc(wireTitle)}</h1>
        <span class="wire-status">${articles.length} article${articles.length > 1 ? 's' : ''}</span>
      </div>
      ${body}
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
                    `<a href="${safeUrl(relative(authorUrl(pub, s), ctx))}">${esc(ctx.authorsBySlug.get(s)?.name ?? s)}</a>`,
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
      ${
        lead
          ? (() => {
              const pos = `object-position:${clampPercent(lead.focalPoint?.x)}% ${clampPercent(lead.focalPoint?.y)}%`;
              const ratio =
                lead.width && lead.height ? `;aspect-ratio:${lead.width}/${lead.height}` : '';
              return `<figure class="post-lead">
        <img class="post-lead__img" src="${safeUrl(asset(lead.src, ctx))}" alt="${esc(lead.alt || '')}" decoding="async" fetchpriority="high"${lead.width ? ` width="${lead.width}"` : ''}${lead.height ? ` height="${lead.height}"` : ''} style="${pos}${ratio}">
        ${caption ? `<figcaption class="post-lead__credit">${caption}</figcaption>` : ''}
      </figure>`;
            })()
          : ''
      }
      <div class="post-body">
${article.body.html ?? ''}
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
  return page(
    `<div class="wrap wire">
      <div class="wire-head">
        <h1 class="wire-title">${esc(section.name)}</h1>
        <span class="wire-status">${articles.length} article${articles.length > 1 ? 's' : ''}</span>
      </div>
      ${section.description ? `<p class="section-intro">${esc(section.description)}</p>` : ''}
      ${
        articles.length
          ? `<div class="news-list">\n${articles.map((a) => articleCard(a, ctx)).join('\n')}\n      </div>`
          : '<p class="empty">Aucun article dans cette section.</p>'
      }
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

export function categoryPage(category: { slug: string; name: string }, articles: Article[], ctx: RenderContext): string {
  return page(
    `<div class="wrap wire"><div class="wire-head"><h1 class="wire-title">${esc(category.name)}</h1><span class="wire-status">${articles.length} article${articles.length > 1 ? 's' : ''}</span></div>${articles.length ? `<div class="news-list">${articles.map((article) => articleCard(article, ctx)).join('\n')}</div>` : '<p class="empty">Aucun article dans cette catégorie.</p>'}</div>`,
    { title: `${category.name} — ${ctx.publication.name}`, canonical: `${ctx.publication.siteUrl.replace(/\/+$/, '')}/categories/${category.slug}/` },
    ctx,
  );
}

export function authorPage(author: Author, articles: Article[], ctx: RenderContext): string {
  return page(
    `<div class="wrap wire">
      <div class="wire-head">
        <h1 class="wire-title">${esc(author.name)}</h1>
        <span class="wire-status">${articles.length} signature${articles.length > 1 ? 's' : ''}</span>
      </div>
      ${author.role ? `<p class="author-role">${esc(author.role)}${author.cohort ? ` · cohorte ${esc(author.cohort)}` : ''}${author.active === false ? ' · a quitté la rédaction' : ''}</p>` : ''}
      ${author.bio ? `<p class="author-bio">${esc(author.bio)}</p>` : ''}
      ${
        articles.length
          ? `<div class="news-list">\n${articles.map((a) => articleCard(a, ctx)).join('\n')}\n      </div>`
          : '<p class="empty">Aucun article signé pour le moment.</p>'
      }
    </div>`,
    {
      title: `${author.name} — ${ctx.publication.name}`,
      description: author.bio,
      canonical: authorUrl(ctx.publication, author.slug),
    },
    ctx,
  );
}

export function authorsIndexPage(authors: Author[], counts: Map<string, number>, ctx: RenderContext): string {
  const render = (list: Author[], alumni = false) =>
    list
      .map(
        (a) => `
      <div class="author-card${alumni ? ' author-card--alumni' : ''}">
        <div>
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

  return page(
    `<div class="wrap wire">
      <div class="wire-head">
        <h1 class="wire-title">L’équipe</h1>
        <span class="wire-status">${active.length} membre${active.length > 1 ? 's' : ''} · ${past.length} alumni</span>
      </div>
      <p class="section-intro">Rédaction en poste cette année — rôles et cohortes affichés pour chaque signature.</p>
      ${render(active, false)}
      ${
        past.length
          ? `<div class="wire-head" style="margin-top:34px"><h2 class="wire-title">Alumni</h2></div>
      <p class="section-intro">Membres ayant gradué ou quitté la rédaction. Leurs signatures restent : une archive ne se réécrit pas quand quelqu’un part.</p>
      ${render(past, true)}`
          : ''
      }
    </div>`,
    {
      title: `L’équipe — ${ctx.publication.name}`,
      canonical: `${ctx.publication.siteUrl}/auteurs/`,
      current: asset('/auteurs/', ctx),
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
