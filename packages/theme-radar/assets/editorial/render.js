import { renderSourceArticle } from './source-view.js';
import { pruneSportsPayload } from './sports-freshness.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ESCAPES[character]);

function formatDateTime(value, timeZone = 'America/Toronto') {
  if (!value) return '';
  return new Intl.DateTimeFormat('fr-CA', { dateStyle: 'long', timeStyle: 'short', timeZone }).format(new Date(value));
}

function link(base, path) {
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * URL de la page Au tableau pour la puce mât.
 * Le YAML stocke souvent « /sports/ » sans basePath : après applyBranding SPA
 * il faut préfixer (ex. /le-kiosque/demo/sports/), sinon clic → 404 racine.
 */
function sportsBoardHref(base, sports) {
  const raw = String(sports?.href || '/sports/').trim() || '/sports/';
  if (/^https?:\/\//i.test(raw)) return raw;
  let path = raw.startsWith('/') ? raw : `/${raw}`;
  const root = String(base || '').replace(/\/+$/, '');
  if (root && (path === root || path.startsWith(`${root}/`))) {
    return path.endsWith('/') ? path : `${path}/`;
  }
  if (/^\/?sports\/?$/i.test(path)) return link(base || '', '/sports/');
  return link(base || '', path);
}

function safeMediaUrl(value) {
  const raw = String(value || '');
  return /^(?:data:image\/(?:svg\+xml|png|webp|jpeg);base64,|https?:\/\/|\/)/i.test(raw) ? raw : '';
}

function authorHref(base, slug) {
  return link(base, `/auteurs/${encodeURIComponent(slug)}/`);
}

/** Byline carte : signatures cliquables → page auteur en nouvel onglet. */
function bylineAuthors(article, bundle, base) {
  return article.authors.map((slug) => {
    const name = bundle.authors.find((author) => author.slug === slug)?.name || slug;
    return {
      name,
      href: authorHref(base, slug),
    };
  });
}

function mediaFigure(article, base) {
  if (!article.lead) return '';
  const src = safeMediaUrl(article.lead.src);
  if (!src) return '';
  const resolved = src.startsWith('/') ? link(base, src) : src;
  const credit = [article.lead.caption, article.lead.credit && `Photo : ${article.lead.credit}`].filter(Boolean).map(esc).join(' — ');
  const x = Number(article.lead.focalPoint?.x ?? 50);
  const y = Number(article.lead.focalPoint?.y ?? 50);
  const w = article.lead.width ? ` width="${Number(article.lead.width)}"` : '';
  const h = article.lead.height ? ` height="${Number(article.lead.height)}"` : '';
  const ratio = article.lead.width && article.lead.height
    ? `;aspect-ratio:${Number(article.lead.width)}/${Number(article.lead.height)}`
    : '';
  // Même figure .post-lead que le build statique (photo + crédit, pas crédit seul).
  return `<figure class="post-lead"><img class="post-lead__img" src="${esc(resolved)}" alt="${esc(article.lead.alt || '')}" decoding="async" fetchpriority="high"${w}${h} style="object-position:${x}% ${y}%${ratio}">${credit ? `<figcaption class="post-lead__credit">${credit}</figcaption>` : ''}</figure>`;
}

function articleCard(article, bundle, base, variant = 'tail') {
  const role = variant === true ? 'lead' : variant;
  const section = bundle.taxonomies.sections.find((item) => item.slug === article.section);
  const categoryColor = (article.categories || [])
    .map((slug) => bundle.taxonomies.categories.find((item) => item.slug === slug)?.color)
    .find((value) => value && /^#/.test(value));
  const lead = article.lead;
  const src = safeMediaUrl(lead?.src);
  const labels = bundle.publication.labels || {};
  return renderSourceArticle({
    section: section?.name,
    color: section?.color || categoryColor,
    href: link(base, `/articles/${encodeURIComponent(article.slug)}/`),
    linkAttributes: 'data-editorial-link',
    title: article.title,
    excerpt: article.excerpt,
    readMore: true,
    leadEyebrow: labels.leadEyebrow || 'À la une',
    date: {
      iso: article.publishedAt || article.updatedAt,
      label: formatDateTime(article.publishedAt || article.updatedAt, bundle.publication.timeZone),
    },
    authors: bylineAuthors(article, bundle, base),
    image: src ? {
      src: src.startsWith('/') ? link(base, src) : src,
      alt: lead.alt || '',
      caption: lead.caption,
      credit: lead.credit,
      focalPoint: lead.focalPoint,
      width: lead.width,
      height: lead.height,
    } : undefined,
  }, role);
}

/** Fil magazine (accueil / section / catégorie) — même partition que le thème statique. */
function magazineFeedHtml(articles, bundle, base, heroLabel, empty) {
  if (!articles.length) return `<p class="empty">${esc(empty)}</p>`;
  const [first, ...rest] = articles;
  const features = rest.slice(0, 3);
  // Parité templates.ts : 3 vedettes + 6 en bref, suite dès l’index 9 (ne pas sauter d’article).
  const briefs = rest.slice(3, 9);
  const tail = rest.slice(9);
  return `<div class="magazine-layout"><section class="news-hero" aria-label="${esc(heroLabel)}">${articleCard(first, bundle, base, 'lead')}<div class="news-features">${features.map((item) => articleCard(item, bundle, base, 'feature')).join('')}</div></section>${briefs.length ? `<aside class="brief-rail" aria-label="En bref"><h2>En bref</h2>${briefs.map((item) => articleCard(item, bundle, base, 'brief')).join('')}</aside>` : ''}${tail.length ? `<section class="news-tail" data-tail-visible="10"><h2 class="news-tail-title">Suite du fil</h2><div class="news-tail-body news-tail-grid">${tail.map((item) => articleCard(item, bundle, base, 'tail')).join('')}</div></section>` : ''}</div>`;
}

export function renderRoute(bundle, base, pathname, renderBody) {
  const route = pathname.slice(base.length).replace(/^\/+|\/+$/g, '');
  const parts = route ? route.split('/') : [];
  const published = bundle.articles.filter((article) => article.status === 'published');
  if (!parts.length) {
    const wireTitle = bundle.publication.labels?.wireTitle || 'À la une';
    return {
      title: `${bundle.publication.name} — ${bundle.publication.tagline || bundle.publication.institution}`,
      html: `<div class="wrap wire"><div class="wire-head"><h1 class="wire-title">${esc(wireTitle)}</h1><span class="wire-status">${published.length} article${published.length > 1 ? 's' : ''}</span></div>${magazineFeedHtml(published, bundle, base, wireTitle, 'Aucun article publié pour le moment.')}</div>`,
    };
  }
  if (parts[0] === 'articles' && parts[1]) {
    const article = published.find((item) => item.slug === decodeURIComponent(parts[1]));
    if (!article) return null;
    const authorLinks = article.authors.map((slug) => {
      const name = bundle.authors.find((item) => item.slug === slug)?.name || slug;
      return `<a href="${esc(authorHref(base, slug))}" target="_blank" rel="noopener noreferrer">${esc(name)}</a>`;
    });
    const categories = article.categories.map((slug) => bundle.taxonomies.categories.find((item) => item.slug === slug)).filter(Boolean);
    const section = bundle.taxonomies.sections.find((item) => item.slug === article.section);
    const categoryFallback = categories[0];
    const eyebrowName = section?.name || categoryFallback?.name;
    const eyebrowColor = section?.color || categoryFallback?.color;
    const eyebrowHref = section
      ? link(base, `/sections/${encodeURIComponent(section.slug)}/`)
      : categoryFallback
        ? link(base, `/categories/${encodeURIComponent(categoryFallback.slug)}/`)
        : '';
    const eyebrow = eyebrowName
      ? `<a class="post-eyebrow" data-editorial-link href="${eyebrowHref}"${eyebrowColor ? ` style="--c:${esc(eyebrowColor)}"` : ''}>${esc(eyebrowName)}</a>`
      : '';
    const briefs = published.filter((item) => item.slug !== article.slug).slice(0, 5);
    const post = `<article class="post post--in-magazine">${eyebrow}<h1 class="post-title">${esc(article.title)}</h1>${article.subtitle ? `<p class="post-subtitle">${esc(article.subtitle)}</p>` : ''}${article.dek ? `<p class="post-dek">${esc(article.dek)}</p>` : ''}<div class="post-meta"><span>Par ${authorLinks.join(', ')}</span><time datetime="${esc(article.publishedAt || article.updatedAt)}">${esc(formatDateTime(article.publishedAt || article.updatedAt, bundle.publication.timeZone))}</time></div>${mediaFigure(article, base)}<div class="post-body">${renderBody(article)}</div>${categories.length ? `<div class="post-tags">${categories.map((category) => `<a class="tag" data-editorial-link href="${link(base, `/categories/${encodeURIComponent(category.slug)}/`)}">${esc(category.name)}</a>`).join('')}</div>` : ''}</article>`;
    const rail = briefs.length
      ? `<aside class="brief-rail brief-rail--article" aria-label="En bref"><h2>En bref</h2>${briefs.map((item) => articleCard(item, bundle, base, 'brief')).join('')}</aside>`
      : '';
    return {
      title: `${article.title} — ${bundle.publication.name}`,
      html: `<div class="wrap wire wire--article"><div class="magazine-layout magazine-layout--article"><div class="article-column">${post}</div>${rail}</div></div>`,
    };
  }
  /* Page résultats sportifs (puce mât → /sports/). */
  if (parts[0] === 'sports' && !parts[1]) {
    const sportsRaw = bundle.publication.masthead?.sports;
    const rawTeams = Array.isArray(sportsRaw?.teams) && sportsRaw.teams.length
      ? sportsRaw.teams
      : (sportsRaw?.team ? [sportsRaw.team] : []);
    const sports = sportsRaw && sportsRaw.enabled !== false
      ? pruneSportsPayload({
          teams: rawTeams,
          results: sportsRaw.results || [],
          nextGame: sportsRaw.nextGame || null,
          nextGames: sportsRaw.nextGames || [],
          demoAsOf: sportsRaw.demoAsOf,
        }, { demoAsOf: sportsRaw.demoAsOf })
      : null;
    const teams = sports?.teams || [];
    if (sports && teams.length) {
      const sportsArticles = published.filter((a) => a.section === 'sports');
      const glyph = (sport) => {
        const s = String(sport || '').toLowerCase();
        if (s.includes('basket')) return '🏀';
        if (s.includes('hockey')) return '🏒';
        if (s.includes('soccer') || (s.includes('foot') && !s.includes('flag'))) return '⚽';
        if (s.includes('volley')) return '🏐';
        return '🏅';
      };
      const fmt = (iso) => {
        try {
          return new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short', timeZone: bundle.publication.timeZone || 'America/Toronto' }).format(new Date(`${iso}T12:00:00`));
        } catch { return iso; }
      };
      const panels = teams.map((team) => {
        const nested = Array.isArray(team.results) ? team.results : [];
        const global = (sports.results || []).filter((g) => !g.teamId || g.teamId === team.id);
        const results = nested.concat(global).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6);
        let next = team.nextGame || null;
        if (!next && sports.nextGame && (!sports.nextGame.teamId || sports.nextGame.teamId === team.id)) next = sports.nextGame;
        const rows = results.map((g) => {
          const badge = g.result === 'W' ? 'V' : g.result === 'L' ? 'D' : 'N';
          const opp = g.opponentInstitution
            ? `${esc(g.opponent)} <span class="sports-result__inst">(${esc(g.opponentInstitution)})</span>`
            : esc(g.opponent);
          const prior = g.priorSeason
            ? '<span class="sports-result__season-meta">Saison précédente</span>'
            : '';
          return `<li class="sports-result sports-result--${esc(g.result)}${g.priorSeason ? ' sports-result--prior-season' : ''}"><time class="sports-result__time" datetime="${esc(g.date)}">${esc(fmt(g.date))}</time><span class="sports-result__score">${g.scoreFor}–${g.scoreAgainst}</span><span class="sports-result__title"><span class="sports-result__vs">vs</span> ${opp}</span><span class="sports-result__badge">${badge}</span>${prior}</li>`;
        });
        if (next) {
          const when = [fmt(next.date), next.time ? String(next.time).replace(':', ' h ') : ''].filter(Boolean).join(' · ');
          const nextOpp = next.opponentInstitution
            ? `${esc(next.opponent)} <span class="sports-result__inst">(${esc(next.opponentInstitution)})</span>`
            : esc(next.opponent);
          rows.push(`<li class="sports-result sports-result--next"><time class="sports-result__time" datetime="${esc(next.date)}">${esc(when)}</time><span class="sports-result__score sports-result__score--next">À venir</span><span class="sports-result__title"><span class="sports-result__vs">vs</span> ${nextOpp}</span><span class="sports-result__badge sports-result__badge--next">→</span></li>`);
        }
        const list = rows.length ? `<ul class="sports-panel__list">${rows.join('')}</ul>` : '<p class="sports-panel__empty">Aucun résultat.</p>';
        const color = team.colors?.primary || 'var(--accent)';
        return `<section class="sports-panel" style="--sports-panel-c:${esc(color)}"><header class="sports-panel__head"><span class="sports-panel__glyph" aria-hidden="true">${glyph(team.sport)}</span><div class="sports-panel__identity"><h2 class="sports-panel__name">${esc(team.name)} <span class="sports-panel__code">${esc(team.code)}</span></h2><p class="sports-panel__meta">${esc(team.sportLabel || team.sport)}${team.institution ? ` · ${esc(team.institution)}` : ''}</p></div></header>${list}</section>`;
      }).join('');
      const feed = sportsArticles.length
        ? `<div class="sports-articles"><div class="wire-head"><h2 class="wire-title">Dans le journal</h2><span class="wire-status">${sportsArticles.length} article${sportsArticles.length > 1 ? 's' : ''}</span></div>${magazineFeedHtml(sportsArticles, bundle, base, 'Sports', 'Aucun article.')}</div>`
        : `<p class="section-intro"><a data-editorial-link href="${link(base, '/sections/sports/')}">Section Sports</a></p>`;
      return {
        title: `Au tableau — ${bundle.publication.name}`,
        html: `<div class="wrap wire wire--sports"><div class="wire-head"><h1 class="wire-title">Au tableau</h1><span class="wire-status">${teams.length} formation${teams.length > 1 ? 's' : ''}</span></div><p class="section-intro">Scores et prochains matchs — le tableau d’affichage du campus.</p><div class="sports-board-scroll"><div class="sports-board">${panels}</div></div>${feed}</div>`,
      };
    }
  }
  /* Section Sports : même page que /sports/ (Au tableau + fil), pas le fil seul. */
  if (parts[0] === 'sections' && parts[1] === 'sports') {
    const sportsRaw = bundle.publication.masthead?.sports;
    const rawTeams = Array.isArray(sportsRaw?.teams) && sportsRaw.teams.length
      ? sportsRaw.teams
      : (sportsRaw?.team ? [sportsRaw.team] : []);
    if (sportsRaw && sportsRaw.enabled !== false && rawTeams.length) {
      // Réutilise le rendu /sports/ (même payload, même titres).
      const sportsPath = `${String(base || '').replace(/\/+$/, '')}/sports/`;
      return renderRoute(bundle, base, sportsPath, renderBody);
    }
  }
  const definitions = {
    sections: { values: bundle.taxonomies.sections, field: 'section', empty: 'Aucun article dans cette section.' },
    categories: { values: bundle.taxonomies.categories, field: 'categories', empty: 'Aucun article dans cette catégorie.' },
  };
  if (definitions[parts[0]] && parts[1]) {
    const definition = definitions[parts[0]];
    const entity = definition.values.find((item) => item.slug === decodeURIComponent(parts[1]));
    if (!entity) return null;
    const articles = published.filter((article) => Array.isArray(article[definition.field]) ? article[definition.field].includes(entity.slug) : article[definition.field] === entity.slug);
    return {
      title: `${entity.name} — ${bundle.publication.name}`,
      html: `<div class="wrap wire"><div class="wire-head"><h1 class="wire-title">${esc(entity.name)}</h1><span class="wire-status">${articles.length} article${articles.length > 1 ? 's' : ''}</span></div>${entity.description ? `<p class="section-intro">${esc(entity.description)}</p>` : ''}${magazineFeedHtml(articles, bundle, base, entity.name, definition.empty)}</div>`,
    };
  }
  if (parts[0] === 'auteurs') {
    const avatarHtml = (author, size = 88) => {
      const initials = String(author.name || '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || '')
        .join('');
      const fallback = `<span class="author-avatar__initials" aria-hidden="true">${esc(initials || '?')}</span>`;
      const av = author.avatar;
      if (av?.src) {
        const raw = safeMediaUrl(av.src) || av.src;
        const src = raw.startsWith('/') ? link(base, raw) : raw;
        const pos = av.focalPoint ? `object-position:${av.focalPoint.x}% ${av.focalPoint.y}%` : 'object-position:50% 35%';
        const loading = size >= 100 ? 'eager' : 'lazy';
        const prio = size >= 100 ? ' fetchpriority="high"' : '';
        return `<span class="author-avatar" style="--author-avatar-size:${size}px">${fallback}<img class="author-avatar__img" src="${esc(src)}" alt="${esc(av.alt || `Portrait de ${author.name}`)}" width="${size}" height="${size}" loading="${loading}" decoding="async"${prio} style="${pos}" onerror="this.remove()"></span>`;
      }
      return `<span class="author-avatar" style="--author-avatar-size:${size}px">${fallback}</span>`;
    };
    if (!parts[1]) {
      const active = bundle.authors.filter((a) => a.active !== false);
      const past = bundle.authors.filter((a) => a.active === false);
      const card = (author, alumni = false) => {
        const n = published.filter((article) => article.authors.includes(author.slug)).length;
        const href = link(base, `/auteurs/${encodeURIComponent(author.slug)}/`);
        return `<div class="author-card${alumni ? ' author-card--alumni' : ''}"><a class="author-avatar-link" data-editorial-link href="${href}" aria-hidden="true" tabindex="-1">${avatarHtml(author, 88)}</a><div class="author-card__body"><h2 class="author-name"><a data-editorial-link href="${href}">${esc(author.name)}</a>${alumni ? ' <span class="author-badge">Alumni</span>' : ''}</h2>${author.role ? `<p class="author-role">${esc(author.role)}</p>` : ''}${author.cohort ? `<p class="author-cohort">Cohorte ${esc(author.cohort)}</p>` : ''}${author.bio ? `<p class="author-bio">${esc(author.bio)}</p>` : ''}<p class="author-role">${n} article${n > 1 ? 's' : ''}</p></div></div>`;
      };
      const briefs = published.slice(0, 7);
      const brief = briefs.length
        ? `<aside class="brief-rail" aria-label="En bref"><h2>En bref</h2>${briefs.map((item) => articleCard(item, bundle, base, 'brief')).join('')}</aside>`
        : '';
      const alumniBlock = past.length
        ? `<div class="wire-head team-alumni-head"><h2 class="wire-title">Alumni</h2></div><p class="section-intro">Membres ayant gradué ou quitté la rédaction. Leurs signatures restent : une archive ne se réécrit pas quand quelqu’un part.</p>${past.map((a) => card(a, true)).join('')}`
        : '';
      return {
        title: `L’équipe — ${bundle.publication.name}`,
        html: `<div class="wrap wire"><div class="wire-head"><h1 class="wire-title">L’équipe</h1><span class="wire-status">${active.length} membre${active.length > 1 ? 's' : ''} · ${past.length} alumni</span></div><p class="section-intro">L’équipe en poste : rôle, cohorte et bio de chaque signature.</p><div class="magazine-layout magazine-layout--team"><div class="article-column team-column">${active.map((a) => card(a, false)).join('')}${alumniBlock}</div>${brief}</div></div>`,
      };
    }
    const author = bundle.authors.find((item) => item.slug === decodeURIComponent(parts[1]));
    if (!author) return null;
    const articles = published.filter((article) => article.authors.includes(author.slug));
    const roleBits = [author.role, author.cohort ? `cohorte ${author.cohort}` : ''].filter(Boolean);
    const roleLine = roleBits.length
      ? `<p class="author-role">${roleBits.map(esc).join(' · ')}</p>`
      : '';
    return {
      title: `${author.name} — ${bundle.publication.name}`,
      html: `<div class="wrap wire"><header class="author-page-head">${avatarHtml(author, 112)}<div class="author-page-head__text"><div class="wire-head" style="margin:0;border:0;padding:0"><h1 class="wire-title">${esc(author.name)}</h1><span class="wire-status">${articles.length} signature${articles.length > 1 ? 's' : ''}${author.active === false ? ' · Alumni' : ''}</span></div>${roleLine}${author.bio ? `<p class="author-bio">${esc(author.bio)}</p>` : ''}</div></header>${articles.length ? magazineFeedHtml(articles, bundle, base, `Articles de ${author.name}`, 'Aucun article signé pour le moment.') : '<p class="empty">Aucun article signé pour le moment.</p>'}</div>`,
    };
  }
  return null;
}

export function applyBranding(bundle, base) {
  const publication = bundle.publication;
  document.documentElement.style.setProperty('--accent', publication.theme?.accent || '#6c2163');
  document.documentElement.dataset.typography = publication.theme?.typography || 'modern-accessible';
  document.querySelectorAll('.wordmark a').forEach((node) => {
    node.href = `${base}/`;
    const logo = safeMediaUrl(publication.logo?.src);
    if (logo) node.innerHTML = `<img class="publication-logo" src="${esc(logo)}" alt="${esc(publication.logo.alt || publication.name)}">`;
    else node.textContent = publication.name;
  });
  document.querySelectorAll('.masthead-tagline').forEach((node) => { node.textContent = publication.tagline || ''; });
  document.querySelectorAll('.masthead-meta > span').forEach((node) => { node.textContent = publication.institution || ''; });
  const masthead = document.querySelector('.masthead');
  const backgrounds = publication.masthead?.backgrounds;
  const images = backgrounds?.enabled === false ? [] : (backgrounds?.images || []);
  const overlay = Number(publication.masthead?.overlayStrength);
  masthead?.style.setProperty('--masthead-overlay', String(Number.isFinite(overlay) ? Math.min(.9, Math.max(0, overlay)) : .55));
  if (masthead) masthead.dataset.textAlignment = publication.masthead?.textAlignment || 'left';
  masthead?.classList.toggle('masthead--illustrated', Boolean(images.length));
  masthead?.querySelectorAll('[data-masthead-background], .masthead-background-shade, [data-masthead-credit], #masthead-backgrounds').forEach((node) => node.remove());
  if (masthead && images.length) {
    const image = document.createElement('img'); image.className = 'masthead-background'; image.dataset.mastheadBackground = ''; image.alt = ''; image.src = safeMediaUrl(images[0].src.startsWith('/') ? link(base, images[0].src) : images[0].src); image.style.objectPosition = `${images[0].focalPoint?.x ?? 50}% ${images[0].focalPoint?.y ?? 50}%`;
    const shade = document.createElement('span'); shade.className = 'masthead-background-shade'; shade.setAttribute('aria-hidden', 'true');
    const credit = document.createElement('span'); credit.className = 'masthead-photo-credit'; credit.dataset.mastheadCredit = ''; if (images[0].credit) { const anchor = document.createElement('a'); anchor.href = images[0].creditUrl || images[0].sourceUrl || '#'; anchor.rel = 'noopener'; anchor.textContent = `Photo : ${images[0].credit}`; credit.append(anchor); }
    const manifest = document.createElement('script'); manifest.type = 'application/json'; manifest.id = 'masthead-backgrounds'; manifest.textContent = JSON.stringify(images.map((item) => ({ ...item, src: item.src.startsWith('/') ? link(base, item.src) : item.src, backgroundPosition: `${item.focalPoint?.x ?? 50}% ${item.focalPoint?.y ?? 50}%` })));
    masthead.prepend(image, shade); masthead.append(credit, manifest);
    /* Rebrancher le shuffle sur le nouvel <img> + manifeste (sinon nœud mort). */
    try {
      if (typeof window.KiosqueRefreshMastheadBackgrounds === 'function') {
        window.KiosqueRefreshMastheadBackgrounds();
      }
    } catch (_) { /* kiosque.js pas encore chargé */ }
  }
  const weather = publication.masthead?.weather;
  const sports = publication.masthead?.sports;
  let statusHost = document.querySelector('[data-masthead-status]');
  let weatherHost = document.querySelector('.masthead-weather');
  let sportsHost = document.querySelector('.masthead-sports');
  const needWeather = Boolean(weather?.enabled && weather.localities?.length);
  const sportsTeams = Array.isArray(sports?.teams) && sports.teams.length
    ? sports.teams
    : (sports?.team ? [sports.team] : []);
  const needSports = Boolean(sports?.enabled !== false && sportsTeams.length);
  if (needWeather || needSports) {
    if (!statusHost) {
      statusHost = document.createElement('div');
      statusHost.className = 'masthead-status';
      statusHost.dataset.mastheadStatus = '';
      document.querySelector('.masthead-tools')?.before(statusHost);
    }
    if (needWeather) {
      if (!weatherHost || !statusHost.contains(weatherHost)) {
        weatherHost = document.createElement('div');
        weatherHost.className = 'masthead-weather';
        statusHost.prepend(weatherHost);
      }
      weatherHost.dataset.weatherLocalities = JSON.stringify(weather.localities.slice(0, 4));
    } else weatherHost?.remove();
    if (needSports) {
      if (!sportsHost || !statusHost.contains(sportsHost)) {
        sportsHost = document.createElement('div');
        sportsHost.className = 'masthead-sports';
        statusHost.append(sportsHost);
      }
      const sportsHref = sportsBoardHref(base, sports);
      // setAttribute : évite les surprises dataset + garantit le re-parse kiosque.js
      sportsHost.setAttribute('data-sports-payload', JSON.stringify({
        teams: sportsTeams,
        team: sportsTeams[0],
        results: sports.results || [],
        nextGame: sports.nextGame || null,
        nextGames: sports.nextGames || [],
        href: sportsHref,
        demoAsOf: sports.demoAsOf || null,
      }));
      sportsHost.setAttribute('aria-label', 'Au tableau — scores et matchs');
    } else sportsHost?.remove();
  } else {
    statusHost?.remove();
    weatherHost?.remove();
    sportsHost?.remove();
  }
  /* Peint la puce sports (kiosque.js) après injection du payload — init DOM a déjà tourné. */
  try {
    if (typeof window.KiosqueRefreshMasthead === 'function') window.KiosqueRefreshMasthead();
  } catch (_) { /* kiosque.js pas encore chargé */ }
  document.querySelector('a[href="https://le-radar.ca/pomo/"]')?.toggleAttribute('hidden', publication.masthead?.tools?.pomodoro === false);
  document.querySelector('a[href="https://le-radar.ca/solitaire/"]')?.toggleAttribute('hidden', publication.masthead?.tools?.solitaire === false);
  const navItems = [
    { href: `${base}/`, label: 'Accueil' },
    ...bundle.taxonomies.sections.map((section) => ({
      href: link(base, `/sections/${encodeURIComponent(section.slug)}/`),
      label: section.name,
      color: section.color,
    })),
    { href: link(base, '/auteurs/'), label: 'Équipe' },
  ];
  const navLink = (item) => {
    const color = item.color && /^#[0-9a-fA-F]{3,8}$/.test(item.color)
      ? ` class="nav-section" style="--nav-c:${esc(item.color)}"`
      : '';
    return `<a data-editorial-link href="${esc(item.href)}"${color}>${esc(item.label)}</a>`;
  };
  const nav = document.querySelector('.nav');
  if (nav) {
    nav.innerHTML = navItems.map(navLink).join('');
  }
  /* Même menu en pied de page (parité en-tête). */
  const footNav = document.querySelector('.site-foot__nav');
  if (footNav) {
    const sep = '<span class="site-foot__sep" aria-hidden="true">·</span>';
    footNav.innerHTML = navItems.map(navLink).join(sep);
  }
  document.body.classList.toggle('with-radio', Boolean(publication.radio && publication.radio.enabled !== false));
  syncRadarTuner(publication.radio);
}

/**
 * URL d’embed radio — même ordre de paramètres que templates.ts
 * (station puis surface) pour ne pas détruire l’iframe au branding PGlite.
 */
function radioEmbedSrc(radio) {
  const params = new URLSearchParams();
  if (radio?.station) params.set('station', radio.station);
  params.set('surface', 'kiosque-v1');
  return `https://le-radar.ca/tuner-embed.html?${params}`;
}

/** Compare deux URLs d’embed en ignorant l’ordre des query params. */
function sameRadioEmbedSrc(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  try {
    const ua = new URL(a, 'https://le-radar.ca');
    const ub = new URL(b, 'https://le-radar.ca');
    if (ua.origin !== ub.origin || ua.pathname !== ub.pathname) return false;
    const keys = new Set([...ua.searchParams.keys(), ...ub.searchParams.keys()]);
    for (const key of keys) {
      if (ua.searchParams.get(key) !== ub.searchParams.get(key)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Préserve l’élément <radar-tuner> et son iframe (écoute en cours, volume)
 * tant que la station / surface est équivalente. Un simple écart d’ordre
 * de query (?station&surface vs ?surface&station) ne doit pas remonter.
 */
function syncRadarTuner(radio) {
  let current = document.querySelector('radar-tuner');
  if (!radio || radio.enabled === false) {
    current?.remove();
    return;
  }
  const src = radioEmbedSrc(radio);
  const currentSrc = current?.getAttribute('data-src') || current?.dataset?.src || '';
  if (current && sameRadioEmbedSrc(currentSrc, src)) {
    /* Garder l’iframe vivante ; normaliser data-src sans recharger. */
    if (currentSrc !== src) current.setAttribute('data-src', src);
    return;
  }
  current?.remove();
  const tuner = document.createElement('radar-tuner');
  tuner.className = 'radar-tuner';
  tuner.setAttribute('data-src', src);
  tuner.dataset.surface = 'kiosque-v1';
  tuner.dataset.state = 'loading';
  tuner.setAttribute('aria-busy', 'true');
  tuner.innerHTML = '<a href="https://le-radar.ca/" rel="noopener">Écouter LE-RADAR</a>';
  document.querySelector('header')?.after(tuner);
}
