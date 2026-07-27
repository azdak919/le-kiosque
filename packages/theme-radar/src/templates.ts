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

/** « 12 septembre 2026 » — écrit à la main : `Intl` varie selon l'ICU installé. */
export function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${formatDate(iso)}, ${hh} h ${mm}`;
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
          <img src="${safeUrl(asset(lead.src, ctx))}" alt="${esc(lead.alt)}" loading="lazy" decoding="async"${
            lead.width ? ` width="${lead.width}"` : ''
          }${lead.height ? ` height="${lead.height}"` : ''}>
        </div>${credit ? `\n        <p class="article-media-credit">${credit}</p>` : ''}`;
}

// ---------------------------------------------------------------------------
// Carte d'article
// ---------------------------------------------------------------------------

export function articleCard(article: Article, ctx: RenderContext, lead = false): string {
  const section = sectionName(article.section, ctx);
  const href = relative(articleUrl(ctx.publication, article), ctx);
  const date = article.publishedAt ?? article.updatedAt;

  return `
      <article class="article${lead ? ' article--lead' : ''}">
        ${lead ? '<span class="article-eyebrow">À la une</span>' : ''}
        <div class="article-meta">
          ${section ? `<span class="article-section">${esc(section.name)}</span>` : '<span></span>'}
          <time class="article-time" datetime="${esc(date)}">${formatDate(date)}</time>
        </div>
        <h2 class="article-title"><a href="${safeUrl(href)}" style="text-decoration:none;color:inherit">${esc(article.title)}</a></h2>
        ${byline(article, ctx, true)}
        ${lead ? mediaFigure(article, ctx) : ''}
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
  const nav = [
    { href: asset('/', ctx), label: 'Accueil' },
    ...ctx.taxonomies.sections.map((s) => ({
      href: relative(sectionUrl(pub, s.slug), ctx),
      label: s.name,
    })),
    { href: asset('/auteurs/', ctx), label: 'Équipe' },
  ];

  const description = options.description ?? pub.tagline ?? pub.name;

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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${asset('/assets/tokens.css', ctx)}">
<link rel="stylesheet" href="${asset('/assets/theme.css', ctx)}">
<style>:root{--accent:${esc(pub.theme.accent)}}${
    pub.theme.accentDark ? `:root[data-theme="dark"]{--accent:${esc(pub.theme.accentDark)}}` : ''
  }</style>
${options.jsonLd ? `<script type="application/ld+json">${options.jsonLd}</script>\n` : ''}</head>
<body${options.bodyClass ? ` class="${esc(options.bodyClass)}"` : ''}>
<a class="skip-link" href="#contenu">Aller au contenu</a>
${ctx.demoNotice ? `<div class="demo-banner">${esc(ctx.demoNotice)}</div>` : ''}
<header class="masthead">
  <div class="wrap">
    <div class="masthead-top">
      <div>
        <p class="wordmark"><a href="${asset('/', ctx)}">${esc(pub.name)}</a></p>
        ${pub.tagline ? `<p class="masthead-tagline">${esc(pub.tagline)}</p>` : ''}
      </div>
      <div class="masthead-meta">
        <span>${esc(pub.institution)}</span>
        <button type="button" id="theme-toggle" class="theme-toggle" aria-pressed="false" hidden>Sombre</button>
      </div>
    </div>
  </div>
</header>
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
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export function homePage(articles: Article[], ctx: RenderContext): string {
  const [first, ...rest] = articles;
  const body = !articles.length
    ? '<p class="empty">Aucun article publié pour le moment.</p>'
    : `${articleCard(first, ctx, true)}
      <div class="news-list">
${rest.map((a) => articleCard(a, ctx)).join('\n')}
      </div>`;

  return page(
    `<div class="wrap wire">
      <div class="wire-head">
        <h1 class="wire-title">Le fil</h1>
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
        <time datetime="${esc(date)}">${formatDateTime(date)}</time>
        ${
          article.updatedAt && article.publishedAt && article.updatedAt > article.publishedAt
            ? `<span>Mis à jour le ${formatDate(article.updatedAt)}</span>`
            : ''
        }
      </div>
      ${
        lead
          ? `<figure class="post-lead">
        <img src="${safeUrl(asset(lead.src, ctx))}" alt="${esc(lead.alt)}"${lead.width ? ` width="${lead.width}"` : ''}${lead.height ? ` height="${lead.height}"` : ''}>
        ${caption ? `<figcaption>${caption}</figcaption>` : ''}
      </figure>`
          : ''
      }
      <div class="post-body">
${article.body.html ?? ''}
      </div>
      ${tags ? `<div class="post-tags">\n      ${tags}\n      </div>` : ''}
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
