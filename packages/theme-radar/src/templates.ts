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

function byline(article: Article, ctx: RenderContext, linked: boolean): string {
  if (!article.authors.length) return '';
  const names = article.authors.map((slug) => {
    const author = ctx.authorsBySlug.get(slug);
    const name = esc(author?.name ?? slug);
    if (!linked) return `<span class="article-author">${name}</span>`;
    return `<a class="article-author" href="${safeUrl(relative(authorUrl(ctx.publication, slug), ctx))}">${name}</a>`;
  });
  const joined = names.length > 1
    ? `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`
    : names[0];
  return `<p class="article-byline">Par${joined}</p>`;
}

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

function mediaFigure(article: Article, ctx: RenderContext): string {
  const lead = article.lead;
  if (!lead) return '';
  const credit = [lead.caption, lead.credit && `Photo : ${lead.credit}`]
    .filter(Boolean)
    .map((x) => esc(x))
    .join(' — ');
  return `
        <div class="article-media">
          <img src="${safeUrl(asset(lead.src, ctx))}" alt="${esc(lead.alt)}" loading="lazy" decoding="async" style="object-position:${clampPercent(lead.focalPoint?.x)}% ${clampPercent(lead.focalPoint?.y)}%"${
            lead.width ? ` width="${lead.width}"` : ''
          }${lead.height ? ` height="${lead.height}"` : ''}>
        </div>${credit ? `\n        <p class="article-media-credit">${credit}</p>` : ''}`;
}

function radioTuner(ctx: RenderContext): string {
  const radio = ctx.publication.radio;
  if (!radio || radio.enabled === false) return '';
  const params = new URLSearchParams();
  if (radio.station) params.set('station', radio.station);
  params.set('surface', 'kiosque-v1');
  const src = `https://le-radar.ca/tuner-embed.html?${params.toString()}`;
  return `<radar-tuner class="radar-tuner" data-src="${esc(src)}" data-surface="kiosque-v1" hidden>
  <a href="https://le-radar.ca/" rel="noopener">Écouter LE RADAR</a>
</radar-tuner>`;
}

function icon(label: 'home' | 'rss' | 'pomo' | 'solitaire' | 'shuffle'): string {
  const paths = {
    home: '<path d="M3 11.2 12 4l9 7.2v8.3a.5.5 0 0 1-.5.5H15v-6H9v6H3.5a.5.5 0 0 1-.5-.5z"/>',
    rss: '<path d="M5 4a15 15 0 0 1 15 15h-3A12 12 0 0 0 5 7zm0 6a9 9 0 0 1 9 9h-3a6 6 0 0 0-6-6zm2 6.5A2.5 2.5 0 1 1 7 21a2.5 2.5 0 0 1 0-4.5z"/>',
    pomo: '<path d="M9 2h6v2H9zm2 3h2v2.1a7 7 0 1 1-2 0zm1 4a5 5 0 1 0 5 5 5 5 0 0 0-5-5z"/>',
    solitaire: '<path d="m12 2 5 5-5 5-5-5zm-6 9 5 5-5 5-5-5zm12 0 5 5-5 5-5-5zm-6 5 5 5-5 5-5-5z"/>',
    shuffle: '<path d="M16 3h5v5h-2V6.4l-3.8 3.8-1.4-1.4L17.6 5H16zM3 6h4.2l10.4 10.4V15H20v5h-5v-2h1.6L6.4 8H3zm0 10h4.2l2.6-2.6 1.4 1.4L8 18H3z"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[label]}</svg>`;
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

function mastheadTools(ctx: RenderContext): string {
  const masthead = ctx.publication.masthead;
  const weather = masthead?.weather;
  const backgrounds = masthead?.backgrounds;
  const tools = masthead?.tools;
  const localities = weather?.enabled === false ? [] : (weather?.localities ?? []);
  const button = (href: string, label: string, glyph: string) =>
    `<a class="masthead-tool" href="${safeUrl(href)}" aria-label="${esc(label)}" title="${esc(label)}">${glyph}</a>`;
  return `<div class="masthead-utility">
    <p class="masthead-clock"><span data-masthead-date></span><time data-masthead-time></time></p>
    ${localities.length ? `<div class="masthead-weather" data-weather-localities="${esc(JSON.stringify(localities))}" aria-label="Météo"></div>` : ''}
    <div class="masthead-tools">
      ${button(asset('/', ctx), 'Accueil', icon('home'))}
      ${button(asset('/feed.xml', ctx), 'Flux RSS', icon('rss'))}
      ${tools?.pomodoro !== false ? button('https://le-radar.ca/pomo/', 'Pomodoro', icon('pomo')) : ''}
      ${tools?.solitaire !== false ? button('https://le-radar.ca/solitaire/', 'Solitaire', icon('solitaire')) : ''}
      <button type="button" id="theme-toggle" class="masthead-tool" aria-label="Changer de thème" title="Changer de thème" aria-pressed="false" hidden><span aria-hidden="true">☼</span></button>
      ${backgrounds?.enabled !== false && (backgrounds?.images?.length ?? 0) > 1 ? `<button type="button" id="masthead-shuffle" class="masthead-tool" aria-label="Changer l’image de fond" title="Changer l’image de fond">${icon('shuffle')}</button>` : ''}
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Carte d'article
// ---------------------------------------------------------------------------

export function articleCard(article: Article, ctx: RenderContext, variant: boolean | 'lead' | 'feature' | 'brief' | 'tail' = false): string {
  const role = variant === true ? 'lead' : variant === false ? 'tail' : variant;
  const lead = role === 'lead';
  const showImage = role === 'lead' || role === 'feature' || role === 'tail';
  const section = sectionName(article.section, ctx);
  const href = relative(articleUrl(ctx.publication, article), ctx);
  const date = article.publishedAt ?? article.updatedAt;

  return `
      <article class="article article--${role}">
        ${lead ? '<span class="article-eyebrow">À la une</span>' : ''}
        <div class="article-meta">
          ${section ? `<span class="article-section">${esc(section.name)}</span>` : '<span></span>'}
          <time class="article-time" datetime="${esc(date)}">${formatDateTime(date, ctx.publication.timeZone)}</time>
        </div>
        <h2 class="article-title"><a href="${safeUrl(href)}" style="text-decoration:none;color:inherit">${esc(article.title)}</a></h2>
        ${byline(article, ctx, true)}
        ${showImage ? mediaFigure(article, ctx) : ''}
        <p class="article-brief">${esc(article.excerpt)}</p>
      </article>`;
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
    { href: asset('/', ctx), label: 'Accueil' },
    ...ctx.taxonomies.sections.map((s) => ({
      href: relative(sectionUrl(pub, s.slug), ctx),
      label: s.name,
    })),
    { href: asset('/auteurs/', ctx), label: 'Équipe' },
  ];

  const description = options.description ?? pub.tagline ?? pub.name;
  const radio = radioTuner(ctx);

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
<style>:root{--accent:${esc(pub.theme.accent)}}${
    pub.theme.accentDark ? `:root[data-theme="dark"]{--accent:${esc(pub.theme.accentDark)}}` : ''
  }</style>
${options.jsonLd ? `<script type="application/ld+json">${options.jsonLd}</script>\n` : ''}</head>
<body${options.bodyClass ? ` class="${esc(options.bodyClass)}"` : ''}>
<a class="skip-link" href="#contenu">Aller au contenu</a>
${ctx.demoNotice ? `<div class="demo-banner">${esc(ctx.demoNotice)}</div>` : ''}
<header class="masthead${masthead.image ? ' masthead--illustrated' : ''}" data-text-alignment="${masthead.textAlignment}" style="--masthead-overlay:${masthead.overlayStrength}">
  ${mastheadBackground(ctx, masthead)}
  <div class="wrap">
    ${mastheadTools(ctx)}
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
        .map(
          (n) =>
            `<a href="${safeUrl(n.href)}"${options.current === n.href ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`,
        )
        .join('\n      ')}
    </div>
  </div>
</nav>
<main id="contenu">
${content}
</main>
<footer class="footer">
  <div class="wrap">
    <p><strong>${esc(pub.name)}</strong>${pub.founded ? ` — depuis ${esc(pub.founded)}` : ''}. ${esc(pub.institution)}.</p>
    ${pub.governance.contact ? `<p>Contact : <a href="mailto:${esc(pub.governance.contact)}">${esc(pub.governance.contact)}</a></p>` : ''}
    <p><a href="${asset('/feed.xml', ctx)}">Flux RSS</a> · <a href="${asset('/plan-du-site/', ctx)}">Plan du site</a>${
      pub.governance.repo ? ` · <a href="${safeUrl(pub.governance.repo)}">Code source</a>` : ''
    }</p>
    ${pub.license ? `<p>Contenus sous licence ${esc(pub.license)}, sauf mention contraire.</p>` : ''}
    <p class="footer-built">Site statique produit par <a href="https://github.com/kiosque/kiosque">Le Kiosque</a> — socle libre pour les journaux étudiants. © ${ctx.buildYear}</p>
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
  const features = rest.slice(0, 2);
  const briefs = rest.slice(2, 9);
  const tail = rest.slice(9);
  const body = !articles.length
    ? '<p class="empty">Aucun article publié pour le moment.</p>'
    : `<div class="magazine-layout">
      <section class="news-hero" aria-label="À la une">
        ${articleCard(first, ctx, 'lead')}
        <div class="news-features">${features.map((a) => articleCard(a, ctx, 'feature')).join('\n')}</div>
      </section>
      ${briefs.length ? `<aside class="brief-rail"><h2>En bref</h2>${briefs.map((a) => articleCard(a, ctx, 'brief')).join('\n')}</aside>` : ''}
      ${tail.length ? `<section class="news-tail"><h2>Suite du fil</h2><div class="news-tail-grid">${tail.map((a) => articleCard(a, ctx, 'tail')).join('\n')}</div></section>` : ''}
    </div>`;

  return page(
    `<div class="wrap wire">
      <div class="wire-head">
        <h1 class="wire-title">À la une</h1>
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

export function articlePage(article: Article, ctx: RenderContext): string {
  const pub = ctx.publication;
  const section = sectionName(article.section, ctx);
  const date = article.publishedAt ?? article.updatedAt;
  const lead = article.lead;

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

  return page(
    `<article class="wrap post">
      ${section ? `<a class="post-eyebrow" href="${safeUrl(relative(sectionUrl(pub, section.slug), ctx))}">${esc(section.name)}</a>` : ''}
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
          ? `<figure class="post-lead">
        <img src="${safeUrl(asset(lead.src, ctx))}" alt="${esc(lead.alt)}" style="object-position:${clampPercent(lead.focalPoint?.x)}% ${clampPercent(lead.focalPoint?.y)}%"${lead.width ? ` width="${lead.width}"` : ''}${lead.height ? ` height="${lead.height}"` : ''}>
        ${caption ? `<figcaption>${caption}</figcaption>` : ''}
      </figure>`
          : ''
      }
      <div class="post-body">
${article.body.html ?? ''}
      </div>
      ${categories || tags ? `<div class="post-tags">\n      ${categories}\n      ${tags}\n      </div>` : ''}
    </article>`,
    {
      title: `${article.title} — ${pub.name}`,
      description: article.excerpt,
      canonical: article.canonicalUrl,
      image: lead ? `${pub.siteUrl}${lead.src}` : undefined,
      type: 'article',
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
  const render = (list: Author[]) =>
    list
      .map(
        (a) => `
      <div class="author-card">
        <div>
          <h2 class="author-name"><a href="${safeUrl(relative(authorUrl(ctx.publication, a.slug), ctx))}" style="text-decoration:none;color:inherit">${esc(a.name)}</a></h2>
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
      </div>
      ${render(active)}
      ${
        past.length
          ? `<div class="wire-head" style="margin-top:34px"><h2 class="wire-title">Anciennes et anciens</h2></div>
      <p class="section-intro">Leurs signatures restent : une archive ne se réécrit pas quand quelqu’un gradue.</p>
      ${render(past)}`
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
