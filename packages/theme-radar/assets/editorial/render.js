import { renderSourceArticle } from './source-view.js';
import { isInitialsMonogramCandidate, pixelsLookLikeInitialsMonogram, usablePublicationLogo } from './generated-logo.js';
import { radioSlotElement, radioStation } from './radio.js';
import { officialSportsUrl, pruneSportsPayload, sportsSexLabel } from './sports-freshness.js';
import { socialNavHtml } from './social.js';
import { homeRailHtml } from './home-rail.js';

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
 * il faut préfixer (ex. /demo/sports/), sinon clic → 404 racine.
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

const SIZES_CARD = '(max-width: 40rem) 100vw, (max-width: 70rem) 50vw, 22rem';
const SIZES_LEAD_CARD = '(max-width: 40rem) 100vw, 45rem';
const SIZES_POST = '(max-width: 40rem) 100vw, 70rem';
const SIZES_MASTHEAD = '100vw';

function resolveMedia(src, base) {
  const raw = safeMediaUrl(src);
  if (!raw) return '';
  return raw.startsWith('/') ? link(base, raw) : raw;
}

function responsiveAttrs(image, base, sizes) {
  const src = resolveMedia(image?.src, base);
  const variants = Array.isArray(image?.variants) ? image.variants : [];
  if (!src || !variants.length) return src ? { src } : {};
  const originalWidth = image.width || Math.max(2400, ...variants.map((item) => Number(item.width) || 0));
  const srcset = [
    ...variants.map((item) => `${resolveMedia(item.src, base)} ${item.width}w`).filter((part) => !part.startsWith(' ')),
    `${src} ${originalWidth}w`,
  ].join(', ');
  return { src, srcset, sizes };
}

function srcsetHtml(attrs) {
  if (!attrs?.src) return '';
  const srcset = attrs.srcset ? ` srcset="${esc(attrs.srcset)}"` : '';
  const sizes = attrs.sizes ? ` sizes="${esc(attrs.sizes)}"` : '';
  return `src="${esc(attrs.src)}"${srcset}${sizes}`;
}

function applyResponsive(img, attrs) {
  if (!img || !attrs?.src) return;
  if (attrs.srcset) img.setAttribute('srcset', attrs.srcset);
  else img.removeAttribute('srcset');
  if (attrs.sizes) img.setAttribute('sizes', attrs.sizes);
  else img.removeAttribute('sizes');
  img.src = attrs.src;
}



function shareBox(title, url) {
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

function groupByYear(articles, timeZone) {
  const groups = new Map();
  for (const article of articles) {
    const stamp = article.publishedAt || article.updatedAt;
    let year = 0;
    try {
      year = Number(new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || 'America/Toronto', year: 'numeric' }).format(new Date(stamp)));
    } catch {
      year = Number(String(stamp || '').slice(0, 4));
    }
    if (!year) continue;
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(article);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]).map(([year, items]) => ({ year, articles: items }));
}

const articleStamp = (article) => String(article.publishedAt || article.updatedAt || '');
/** Du plus récent au plus ancien (date de publication, sinon de mise à jour). */
export function byDateDesc(articles) {
  return [...articles].sort((a, b) => {
    const ta = Date.parse(articleStamp(a)) || 0;
    const tb = Date.parse(articleStamp(b)) || 0;
    return tb - ta || articleStamp(b).localeCompare(articleStamp(a));
  });
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
  const attrs = responsiveAttrs(article.lead, base, SIZES_POST);
  if (!attrs.src) return '';
  const credit = [article.lead.caption, article.lead.credit && `Photo : ${article.lead.credit}${article.lead.license ? ` (${article.lead.license})` : ''}`].filter(Boolean).map(esc).join(' — ');
  const x = Number(article.lead.focalPoint?.x ?? 50);
  const y = Number(article.lead.focalPoint?.y ?? 50);
  const w = article.lead.width ? ` width="${Number(article.lead.width)}"` : '';
  const h = article.lead.height ? ` height="${Number(article.lead.height)}"` : '';
  // Même figure .post-lead que le build statique (photo + crédit, pas crédit seul).
  // Sans aspect-ratio inline : l’impression doit pouvoir réduire la lead.
  return `<figure class="post-lead"><img class="post-lead__img" ${srcsetHtml(attrs)} alt="${esc(article.lead.alt || '')}" decoding="async" fetchpriority="high"${w}${h} style="object-position:${x}% ${y}%">${credit ? `<figcaption class="post-lead__credit">${credit}</figcaption>` : ''}</figure>`;
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
    leadEyebrow: role === 'lead' && article.featured ? (labels.leadEyebrow || 'À la une') : undefined,
    date: {
      iso: article.publishedAt || article.updatedAt,
      label: formatDateTime(article.publishedAt || article.updatedAt, bundle.publication.timeZone),
    },
    authors: bylineAuthors(article, bundle, base),
    image: src ? {
      ...responsiveAttrs(lead, base, role === 'lead' ? SIZES_LEAD_CARD : SIZES_CARD),
      alt: lead.alt || '',
      caption: lead.caption,
      credit: lead.credit,
      license: lead.license,
      focalPoint: lead.focalPoint,
      width: lead.width,
      height: lead.height,
    } : undefined,
  }, role);
}

/** Fil magazine (accueil / section / catégorie) — même partition que le thème statique. */
function magazineFeedHtml(articles, bundle, base, heroLabel, empty, options = {}) {
  if (!articles.length) return `<p class="empty">${esc(empty)}</p>`;
  const featured = articles.find((item) => item.featured);
  const first = featured || articles[0];
  const rest = articles.filter((item) => item.id !== first.id);
  const features = rest.slice(0, 3);
  // Parité templates.ts : 3 vedettes + 6 en bref, suite dès l’index 9 (ne pas sauter d’article).
  const briefs = rest.slice(3, 9);
  const tail = rest.slice(9);
  return `<div class="magazine-layout"><section class="news-hero" aria-label="${esc(heroLabel)}">${articleCard(first, bundle, base, 'lead')}<div class="news-features">${features.map((item) => articleCard(item, bundle, base, 'feature')).join('')}</div></section>${briefs.length ? `<aside class="brief-rail" aria-label="En bref"><h2>En bref</h2>${briefs.map((item) => articleCard(item, bundle, base, 'brief')).join('')}</aside>` : (options.rail || '')}${tail.length ? `<section class="news-tail" data-tail-visible="10"><h2 class="news-tail-title">Suite du fil</h2><div class="news-tail-body news-tail-grid">${tail.map((item) => articleCard(item, bundle, base, 'tail')).join('')}</div></section>` : ''}</div>`;
}

export function renderRoute(bundle, base, pathname, renderBody, search = '') {
  const route = pathname.slice(base.length).replace(/^\/+|\/+$/g, '');
  const parts = route ? route.split('/') : [];
  // Du plus récent au plus ancien, comme le build statique (byDateDesc) : le
  // Socle livre les articles dans un autre ordre (par adresse).
  const published = byDateDesc(bundle.articles.filter((article) => article.status === 'published'));
  const paged = byDateDesc(bundle.articles.filter((article) => article.status === 'published' || article.status === 'archived'));
  if (!parts.length) {
    const wireTitle = bundle.publication.labels?.wireTitle || 'Le fil étudiant';
    return {
      title: [bundle.publication.name, bundle.publication.tagline || bundle.publication.institution].filter(Boolean).join(' — '),
      html: `<div class="wrap wire"><div class="wire-head"><h1 class="wire-title">${esc(wireTitle)}</h1>${published.length ? `<span class="wire-status">${published.length} article${published.length > 1 ? 's' : ''}</span>` : ''}</div>${magazineFeedHtml(published, bundle, base, wireTitle, 'Aucun article publié pour le moment.', { rail: homeRailHtml({ publication: bundle.publication, sections: bundle.taxonomies.sections, articles: published, base }) })}</div>`,
    };
  }
  if (parts[0] === 'articles' && parts[1]) {
    const article = paged.find((item) => item.slug === decodeURIComponent(parts[1]));
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
    const post = `<article class="post post--in-magazine">${eyebrow}<h1 class="post-title">${esc(article.title)}</h1>${article.subtitle ? `<p class="post-subtitle">${esc(article.subtitle)}</p>` : ''}${article.dek ? `<p class="post-dek">${esc(article.dek)}</p>` : ''}<div class="post-meta"><span>Par ${authorLinks.join(', ')}</span><time datetime="${esc(article.publishedAt || article.updatedAt)}">${esc(formatDateTime(article.publishedAt || article.updatedAt, bundle.publication.timeZone))}</time></div>${shareBox(article.title, `${typeof location !== 'undefined' ? location.origin : ''}${link(base, `/articles/${encodeURIComponent(article.slug)}/`)}`)}<div class="post-flow">${mediaFigure(article, base)}<div class="post-body">${renderBody(article)}</div></div>${categories.length ? `<div class="post-tags">${categories.map((category) => `<a class="tag" data-editorial-link href="${link(base, `/categories/${encodeURIComponent(category.slug)}/`)}">${esc(category.name)}</a>`).join('')}</div>` : ''}</article>`;
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
          demoLive: sportsRaw.demoLive,
        }, { demoAsOf: sportsRaw.demoAsOf, demoLive: sportsRaw.demoLive })
      : null;
    const teamsRaw = sports?.teams || [];
    if (sports && teamsRaw.length) {
      const sportsArticles = published.filter((a) => a.section === 'sports');
      const glyph = (sport) => {
        const s = String(sport || '').toLowerCase();
        if (s.includes('basket')) return '🏀';
        if (s.includes('hockey')) return '🏒';
        if (s.includes('soccer') || (s.includes('foot') && !s.includes('flag'))) return '⚽';
        if (s.includes('flag') || s.includes('football')) return '🏈';
        if (s.includes('volley')) return '🏐';
        return '🏅';
      };
      const fmt = (iso) => {
        try {
          const tz = bundle.publication.timeZone || 'America/Toronto';
          const day = String(iso || '').slice(0, 10);
          const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
          }).formatToParts(new Date());
          const y = parts.find((p) => p.type === 'year')?.value;
          const m = parts.find((p) => p.type === 'month')?.value;
          const d = parts.find((p) => p.type === 'day')?.value;
          const todayKey = y && m && d ? `${y}-${m}-${d}` : '';
          if (todayKey && day === todayKey) return 'Aujourd’hui';
          if (todayKey) {
            const tomorrow = new Date(`${todayKey}T12:00:00`);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
            if (day === tKey) return 'Demain';
            const yesterday = new Date(`${todayKey}T12:00:00`);
            yesterday.setDate(yesterday.getDate() - 1);
            const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
            if (day === yKey) return 'Hier';
          }
          return new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'short', timeZone: tz }).format(new Date(`${iso}T12:00:00`));
        } catch { return iso; }
      };
      const shortInst = (inst) => {
        let s = String(inst || '')
          .replace(/^Cégep\s+(de\s+|du\s+|d’|d')?/i, '')
          .replace(/^Collège\s+/i, '')
          .replace(/^Champlain\s+College\s+/i, 'Champlain ')
          .replace(/^Université\s+(de\s+|du\s+|d’|d')?/i, '')
          .trim();
        const aliases = [
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
        for (const [re, short] of aliases) if (re.test(s)) return short;
        return s;
      };
      const venueHtml = (home) => {
        if (home === true) return '<span class="sports-result__venue sports-result__venue--home" title="Match à domicile">Domicile</span>';
        if (home === false) return '<span class="sports-result__venue sports-result__venue--away" title="Match à l’extérieur">Extérieur</span>';
        return '';
      };
      const oppHtml = (opponent, institution) => {
        const nick = `<span class="sports-result__opp">${esc(opponent)}</span>`;
        const short = shortInst(institution);
        if (!short || short === opponent) return nick;
        return `${nick}<span class="sports-result__opp-school">${esc(short)}</span>`;
      };
      const sexBadge = (sex) => {
        const label = sportsSexLabel(sex);
        if (!label) return '';
        const key = label === 'Féminin' ? 'f' : label === 'Masculin' ? 'm' : 'x';
        const title = key === 'x' ? ' title="Ouvert / mixte"' : '';
        return ` <span class="sports-panel__sex sports-panel__sex--${key}"${title}>${esc(label)}</span>`;
      };
      const officialLink = (team) => {
        const href = officialSportsUrl(team.officialUrl);
        if (!href) return '';
        return `<p class="sports-panel__official"><a class="sports-panel__results-source" href="${esc(href)}" rel="noopener noreferrer" target="_blank">Résultats officiels</a></p>`;
      };
      const activityDate = (team) => {
        let next = team.nextGame || null;
        if (!next && sports.nextGame && (!sports.nextGame.teamId || sports.nextGame.teamId === team.id)) next = sports.nextGame;
        if (next?.date) return next.date;
        const nested = Array.isArray(team.results) ? team.results : [];
        const global = (sports.results || []).filter((g) => !g.teamId || g.teamId === team.id);
        const dates = nested.concat(global).map((g) => g.date).filter(Boolean).sort((a, b) => String(b).localeCompare(String(a)));
        return dates[0] || '';
      };
      const teams = teamsRaw.slice().sort((a, b) => {
        const aNext = Boolean(a.nextGame || (sports.nextGame && (!sports.nextGame.teamId || sports.nextGame.teamId === a.id)));
        const bNext = Boolean(b.nextGame || (sports.nextGame && (!sports.nextGame.teamId || sports.nextGame.teamId === b.id)));
        if (aNext !== bNext) return aNext ? -1 : 1;
        const da = activityDate(a);
        const db = activityDate(b);
        if (aNext && bNext) return String(da).localeCompare(String(db));
        return String(db).localeCompare(String(da));
      });
      const panels = teams.map((team) => {
        const nested = Array.isArray(team.results) ? team.results : [];
        const global = (sports.results || []).filter((g) => !g.teamId || g.teamId === team.id);
        const results = nested.concat(global).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 6);
        let next = team.nextGame || null;
        if (!next && sports.nextGame && (!sports.nextGame.teamId || sports.nextGame.teamId === team.id)) next = sports.nextGame;
        // Un seul à venir ; jour de ref (demoAsOf) pour scores du jour au-dessus.
        let refDay = (sports.demoAsOf && String(sports.demoAsOf).slice(0, 10)) || '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(refDay)) {
          try {
            refDay = new Intl.DateTimeFormat('en-CA', {
              timeZone: bundle.publication.timeZone || 'America/Toronto',
              year: 'numeric', month: '2-digit', day: '2-digit',
            }).format(new Date());
          } catch { refDay = new Date().toISOString().slice(0, 10); }
        }
        const nextDay = next?.date ? String(next.date).slice(0, 10) : '';
        if (next && nextDay && nextDay < refDay) next = null;
        const todayResults = results.filter((g) => String(g.date).slice(0, 10) === refDay);
        const olderResults = results.filter((g) => String(g.date).slice(0, 10) !== refDay);
        const rows = [];
        const pushPast = (g) => {
          const badge = g.result === 'W' ? 'V' : g.result === 'L' ? 'D' : 'N';
          const prior = g.priorSeason
            ? '<span class="sports-result__season-meta">Saison précédente</span>'
            : '';
          const homeAttr = g.home === true ? ' data-home="1"' : g.home === false ? ' data-home="0"' : '';
          rows.push(`<li class="sports-result sports-result--${esc(g.result)}${g.priorSeason ? ' sports-result--prior-season' : ''}"${homeAttr}><time class="sports-result__time" datetime="${esc(g.date)}">${esc(fmt(g.date))}</time><span class="sports-result__score">${g.scoreFor}–${g.scoreAgainst}</span><span class="sports-result__title"><span class="sports-result__vs">vs</span> ${oppHtml(g.opponent, g.opponentInstitution)}${venueHtml(g.home)}</span><span class="sports-result__badge">${badge}</span>${prior}</li>`);
        };
        todayResults.forEach(pushPast);
        if (next) {
          const day = fmt(next.date);
          const clock = next.time ? String(next.time).replace(':', ' h ') : '';
          const timeInner = clock
            ? `<span class="sports-result__day">${esc(day)}</span><span class="sports-result__clock">${esc(clock)}</span>`
            : esc(day);
          const homeAttr = next.home === true ? ' data-home="1"' : next.home === false ? ' data-home="0"' : '';
          const isLive = next.live === true;
          const nextLabel = isLive ? 'En cours' : 'À venir';
          rows.push(`<li class="sports-result sports-result--next${isLive ? ' sports-result--live' : ''}"${homeAttr}><time class="sports-result__time" datetime="${esc(next.date)}">${timeInner}</time><span class="sports-result__score sports-result__score--next">${esc(nextLabel)}</span><span class="sports-result__title"><span class="sports-result__vs">vs</span> ${oppHtml(next.opponent, next.opponentInstitution)}${venueHtml(next.home)}</span><span class="sports-result__badge sports-result__badge--next">${isLive ? '●' : '→'}</span></li>`);
        }
        olderResults.forEach(pushPast);
        const list = rows.length ? `<ul class="sports-panel__list">${rows.join('')}</ul>` : '<p class="sports-panel__empty">Aucun résultat.</p>';
        const color = team.colors?.primary || 'var(--accent)';
        const code = team.code ? ` <span class="sports-panel__code">${esc(team.code)}</span>` : '';
        return `<section class="sports-panel" data-sport="${esc(team.sport || '')}" data-team="${esc(team.id || '')}" style="--sports-panel-c:${esc(color)}"><header class="sports-panel__head"><span class="sports-panel__glyph" aria-hidden="true">${glyph(team.sport)}</span><div class="sports-panel__identity"><h2 class="sports-panel__name sports-panel__name--branded"><span class="sports-panel__brand">${esc(team.name)}</span>${code}${sexBadge(team.sex)}</h2><p class="sports-panel__meta">${esc(team.sportLabel || team.sport)}${team.institution ? ` · ${esc(team.institution)}` : ''}</p>${officialLink(team)}</div></header>${list}</section>`;
      }).join('');
      const feed = sportsArticles.length
        ? `<div class="sports-articles"><div class="wire-head"><h2 class="wire-title">Dans le journal</h2><span class="wire-status">${sportsArticles.length} article${sportsArticles.length > 1 ? 's' : ''}</span></div>${magazineFeedHtml(sportsArticles, bundle, base, 'Sports', 'Aucun article.')}</div>`
        : `<p class="section-intro"><a data-editorial-link href="${link(base, '/sections/sports/')}">Section Sports</a></p>`;
      return {
        title: `Au tableau — ${bundle.publication.name}`,
        html: `<div class="wrap wire wire--sports"><div class="wire-head"><h1 class="wire-title">Au tableau</h1><span class="wire-status">${teams.length} équipe${teams.length > 1 ? 's' : ''}</span></div><p class="section-intro">Scores et prochains matchs — le tableau d’affichage du campus.</p><div class="sports-board-wrap" data-sports-board-wrap><div class="sports-board-scroll"><div class="sports-board">${panels}</div></div><button type="button" class="sports-board-toggle" data-sports-board-toggle hidden aria-expanded="false"><span class="sports-board-toggle__label">Plus de matchs</span></button></div>${feed}</div>`,
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
      html: `<div class="wrap wire"><div class="wire-head"><h1 class="wire-title">${esc(entity.name)}</h1>${articles.length ? `<span class="wire-status">${articles.length} article${articles.length > 1 ? 's' : ''}</span>` : ''}</div>${entity.description ? `<p class="section-intro">${esc(entity.description)}</p>` : ''}${magazineFeedHtml(articles, bundle, base, entity.name, definition.empty)}</div>`,
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
  if (parts[0] === 'archives' && !parts[1]) {
    const groups = groupByYear(paged, bundle.publication.timeZone);
    const years = groups.length < 2 ? '' : groups.map((g) => `<a data-editorial-link href="${link(base, `/archives/${g.year}/`)}">${g.year}<span class="archive-year-nav__count">${g.articles.length}</span></a>`).join('');
    const blocks = groups.length
      ? groups.map((g) => `<section class="archive-year"><h2 class="archive-year__title" id="archive-y-${g.year}"><a data-editorial-link href="${link(base, `/archives/${g.year}/`)}">${g.year}</a></h2><ul class="archive-list">${g.articles.map((article) => `<li><time datetime="${esc(article.publishedAt || article.updatedAt)}">${esc(formatDateTime(article.publishedAt || article.updatedAt, bundle.publication.timeZone))}</time> <a data-editorial-link href="${link(base, `/articles/${encodeURIComponent(article.slug)}/`)}">${esc(article.title)}</a></li>`).join('')}</ul></section>`).join('')
      : '<p class="empty">Aucun article dans les archives pour le moment.</p>';
    return {
      title: `Archives — ${bundle.publication.name}`,
      html: `<div class="wrap wire wire--archives"><div class="wire-head"><h1 class="wire-title">Archives</h1>${paged.length ? `<span class="wire-status">${paged.length} article${paged.length > 1 ? 's' : ''}</span>` : ''}</div><p class="archive-lead">Le fil d’accueil met en avant l’actualité récente. Les archives sont le registre complet du journal : chaque article garde sa page, sa photo et son adresse permanente — y compris les pièces retirées du fil (« hors fil »).</p>${years ? `<nav class="archive-year-nav" aria-label="Années d’archives">${years}</nav>` : ''}${blocks}</div>`,
    };
  }
  if (parts[0] === 'archives' && parts[1]) {
    const year = Number(parts[1]);
    const groups = groupByYear(paged, bundle.publication.timeZone);
    const group = groups.find((item) => item.year === year);
    const articles = group?.articles || [];
    return {
      title: `Archives ${year} — ${bundle.publication.name}`,
      html: `<div class="wrap wire wire--archives"><nav class="archive-crumbs" aria-label="Fil d’Ariane"><a data-editorial-link href="${link(base, '/')}">Accueil</a><span class="archive-crumbs__sep" aria-hidden="true">›</span><a data-editorial-link href="${link(base, '/archives/')}">Archives</a><span class="archive-crumbs__sep" aria-hidden="true">›</span><span aria-current="page">${year}</span></nav><div class="wire-head"><h1 class="wire-title">${year}</h1>${articles.length ? `<span class="wire-status">${articles.length} article${articles.length > 1 ? 's' : ''}</span>` : ''}</div>${articles.length ? `<ul class="archive-list">${articles.map((article) => `<li><time datetime="${esc(article.publishedAt || article.updatedAt)}">${esc(formatDateTime(article.publishedAt || article.updatedAt, bundle.publication.timeZone))}</time> <a data-editorial-link href="${link(base, `/articles/${encodeURIComponent(article.slug)}/`)}">${esc(article.title)}</a></li>`).join('')}</ul>` : '<p class="empty">Aucun article pour cette année.</p>'}<p class="archive-back"><a data-editorial-link href="${link(base, '/archives/')}">← Toutes les années</a></p></div>`,
    };
  }
  if (parts[0] === 'recherche') {
    const query = String(search || '').replace(/^\?/, '').split('&').map((part) => part.split('=')).reduce((acc, [key, value]) => { if (decodeURIComponent((key || '').replace(/\+/g, ' ')) === 'q') acc = decodeURIComponent((value || '').replace(/\+/g, ' ')); return acc; }, '');
    const haystack = (article) => [article.title, article.excerpt, article.body?.raw, article.slug, ...(article.authors || []).map((slug) => bundle.authors.find((author) => author.slug === slug)?.name || slug)].join(' ').toLowerCase();
    const matches = query.trim() ? published.filter((article) => haystack(article).includes(query.trim().toLowerCase())) : [];
    const list = !query.trim()
      ? '<p class="empty">Écrivez un mot, un titre ou un nom, puis lancez la recherche.</p>'
      : (matches.length ? `<div class="news-tail-body news-tail-grid search-results search-results--cards">${matches.map((article) => articleCard(article, bundle, base, 'tail')).join('')}</div>` : `<p class="empty">Aucun article ne correspond à « ${esc(query)} ».</p>`);
    return {
      title: query.trim() ? `Recherche : ${query} — ${bundle.publication.name}` : `Recherche — ${bundle.publication.name}`,
      html: `<div class="wrap wire"><div class="wire-head"><h1 class="wire-title">Recherche</h1>${query.trim() && matches.length ? `<span class="wire-status">${matches.length} résultat${matches.length > 1 ? 's' : ''}</span>` : ''}</div><form class="search-form" method="get" action="${link(base, '/recherche/')}" role="search"><label>Chercher dans le journal<input type="search" name="q" value="${esc(query)}" placeholder="Un titre, un nom, un mot"></label><button type="submit" class="primary">Rechercher</button></form>${list}</div>`,
    };
  }
  if (parts[0] === 'revue') {
    const picks = published.slice(0, 12);
    const pieces = picks.map((article) => `<article class="revue-piece"><h2>${esc(article.title)}</h2><p class="post-meta">${esc((article.authors || []).map((slug) => bundle.authors.find((author) => author.slug === slug)?.name || slug).join(', '))} · <time datetime="${esc(article.publishedAt || article.updatedAt)}">${esc(formatDateTime(article.publishedAt || article.updatedAt, bundle.publication.timeZone))}</time></p>${mediaFigure(article, base)}<div class="post-body">${renderBody(article)}</div><p class="revue-piece__link"><a data-editorial-link href="${link(base, `/articles/${encodeURIComponent(article.slug)}/`)}">Lire sur le site</a></p></article>`).join('');
    return {
      title: `Revue — ${bundle.publication.name}`,
      html: `<div class="wrap wire wire--revue"><div class="wire-head"><h1 class="wire-title">Revue</h1>${picks.length ? `<span class="wire-status">${picks.length} article${picks.length > 1 ? 's' : ''}</span>` : ''}</div><p class="section-intro">Une édition à imprimer : les articles récents, à la suite, sans le mât ni la radio. Utilisez « Imprimer » dans votre navigateur, ou le bouton ci-dessous.</p><p class="revue-actions noprint"><button type="button" class="primary" data-revue-print>Imprimer la revue</button></p>${picks.length ? pieces : '<p class="empty">Aucun article à mettre dans la revue pour le moment.</p>'}</div>`,
    };
  }
  if (parts[0] === 'plan-du-site') {
    const sportsOn = (bundle.publication.masthead?.sports?.enabled !== false) && (Array.isArray(bundle.publication.masthead?.sports?.teams) ? bundle.publication.masthead.sports.teams.length : bundle.publication.masthead?.sports?.team);
    return {
      title: `Plan du site — ${bundle.publication.name}`,
      html: `<div class="wrap wire"><div class="wire-head"><h1 class="wire-title">Plan du site</h1></div><p class="section-intro">${published.length} article${published.length > 1 ? 's' : ''} sur le fil, ${paged.length} dans les <a data-editorial-link href="${link(base, '/archives/')}">archives</a>, ${bundle.taxonomies.sections.length} sections, ${bundle.authors.length} signatures.</p><ul><li><a data-editorial-link href="${link(base, '/archives/')}">Archives</a> — registre chronologique complet</li>${sportsOn ? `<li><a data-editorial-link href="${link(base, '/sports/')}">Au tableau</a> — scores et prochains matchs</li>` : ''}<li><a data-editorial-link href="${link(base, '/recherche/')}">Recherche</a></li><li><a data-editorial-link href="${link(base, '/revue/')}">Revue</a> — édition à imprimer</li>${published.map((article) => `<li><a data-editorial-link href="${link(base, `/articles/${encodeURIComponent(article.slug)}/`)}">${esc(article.title)}</a></li>`).join('')}</ul></div>`,
    };
  }
  return {
    title: `Page introuvable — ${bundle.publication.name}`,
    html: '<div class="wrap wire"><h1>Page introuvable</h1><p>Cette adresse ne correspond à aucune page du journal.</p></div>',
    notFound: true,
  };
}

/** Années du droit d'auteur : l'année courante, ou « fondation–année courante » (comme templates.ts). */
export function footYears(founded, year) {
  const start = Number(/\d{4}/.exec(String(founded ?? ''))?.[0]);
  return start && start < year ? `${start}–${year}` : String(year);
}

/** Licence des contenus : « Tous droits réservés. » par défaut, CC BY-NC-ND 4.0 avec son lien. */
export function footRights(license) {
  const value = String(license ?? '').trim();
  if (!value || /^tous droits réservés\.?$/i.test(value)) return 'Tous droits réservés.';
  if (/by-nc-nd/i.test(value)) return 'Contenus sous licence <a href="https://creativecommons.org/licenses/by-nc-nd/4.0/deed.fr" rel="license noopener">CC BY-NC-ND 4.0</a>.';
  return `Contenus sous licence ${esc(value)}.`;
}

export function footCopyright(publication, year) {
  const name = String(publication.name ?? '').trim();
  return `© ${footYears(publication.founded, year)}${name ? ` ${esc(name)}` : ''}. ${footRights(publication.license)}`;
}

const KIOSQUE_SITE_URL = 'https://kiosque.le-radar.ca/';
const POWERED_BY = `Propulsé par <a href="${KIOSQUE_SITE_URL}" rel="noopener">Le Kiosque</a>, plateforme libre sous licence GNU AGPLv3 pour les journaux étudiants.`;

const DEMO_EDITORIAL_FULL = 'Essayer l’espace de rédaction (démo)';
const DEMO_EDITORIAL_SHORT = 'Espace de rédaction (démo)';

function demoEditorialEntryOn(editorial) {
  return editorial?.mode === 'demo-local' && editorial.demoEditorialEntry === true;
}

function footRedactionLabel(demoEntry = false) {
  return demoEntry
    ? `<span class="site-foot__redaction-full">${DEMO_EDITORIAL_FULL}</span><span class="site-foot__redaction-short">${DEMO_EDITORIAL_SHORT}</span>`
    : 'Espace de rédaction';
}

/** Ligne du bas : mention Propulsé par, puis un lien vers l’espace de rédaction. */
export function footBuiltHtml(redactionHref, demoEntry = false) {
  const attrs = demoEntry ? ` aria-label="${DEMO_EDITORIAL_FULL}"` : '';
  return `<span class="site-foot__powered">${POWERED_BY}</span> <span class="site-foot__sep" aria-hidden="true">·</span> <a class="site-foot__redaction" href="${esc(redactionHref)}"${attrs}>${footRedactionLabel(demoEntry)}</a>`;
}


function wordmarkLogoHtml(publication, src) {
  return `<img class="publication-logo" src="${esc(src)}" alt="${esc(publication.logo.alt || publication.name)}">`;
}

function confirmInitialsMonogram(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) { resolve(null); return; }
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        resolve(pixelsLookLikeInitialsMonogram(pixels.width, pixels.height, pixels.data));
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function paintWordmark(node, publication) {
  const src = safeMediaUrl(publication.logo?.src);
  const usable = usablePublicationLogo(publication.logo);
  // Le logo remplace le nom écrit ; sans logo, ou si c'est un monogramme d'initiales généré, le nom en grand.
  if (usable && src) {
    node.innerHTML = wordmarkLogoHtml(publication, src);
    return;
  }
  node.innerHTML = `<span class="wordmark-name">${esc(publication.name)}</span>`;
  // Candidat data PNG : on montre le nom, puis on rétablit l'image si ce n'est pas un monogramme.
  if (src && isInitialsMonogramCandidate(publication.logo)) {
    confirmInitialsMonogram(src).then((isMono) => {
      if (isMono === false && node.isConnected) node.innerHTML = wordmarkLogoHtml(publication, src);
    });
  }
}

export function applyBranding(bundle, base) {
  const publication = bundle.publication;
  document.documentElement.style.setProperty('--accent', publication.theme?.accent || '#6c2163');
  document.documentElement.dataset.typography = publication.theme?.typography || 'modern-accessible';
  document.querySelectorAll('.wordmark a').forEach((node) => {
    node.href = `${base}/`;
    paintWordmark(node, publication);
  });
  document.querySelectorAll('.masthead-tagline').forEach((node) => { node.textContent = publication.tagline || ''; });
  // Pied de page : le site vivant du paquet complet part d'une coquille sans nom.
  document.querySelectorAll('.site-foot__wordmark').forEach((node) => { node.textContent = publication.name || ''; });
  document.querySelectorAll('.site-foot__signature').forEach((node) => {
    const where = [publication.institution, publication.founded ? `depuis ${publication.founded}` : ''].filter(Boolean).join(' · ');
    node.textContent = [where, publication.tagline].filter(Boolean).join(' — ');
    node.hidden = !node.textContent;
  });
  document.querySelectorAll('.site-foot__credit').forEach((credit) => {
    credit.querySelectorAll('.site-foot__contact, .site-foot__legal').forEach((node) => node.remove());
    const contact = publication.governance?.contact;
    // L'organisme responsable n'est pas répété s'il porte le nom du journal (déjà en tête du pied de page).
    const rawSteward = publication.governance?.stewardEntity;
    const steward = rawSteward && ![String(publication.name || '').trim(), String(publication.institution || '').trim()].includes(rawSteward.trim()) ? rawSteward : '';
    const lines = [];
    if (contact) lines.push(`<p class="site-foot__contact"><a href="mailto:${esc(contact)}">${esc(contact)}</a>${steward ? ` · ${esc(steward)}` : ''}</p>`);
    else if (steward) lines.push(`<p class="site-foot__contact">${esc(steward)}</p>`);
    lines.push(`<p class="site-foot__legal">${footCopyright(publication, new Date().getFullYear())}</p>`);
    credit.insertAdjacentHTML('afterbegin', lines.join(''));
    const built = credit.querySelector('.site-foot__built') || document.createElement('p');
    built.className = 'site-foot__built';
    const editorial = typeof window !== 'undefined' ? window.KIOSQUE_EDITORIAL : undefined;
    // Démo locale : /admin/. Journal installé (socle-vivant) : /redaction/.
    const redactionHref = editorial?.mode === 'demo-local' && editorial.adminBasePath
      ? `${String(editorial.adminBasePath).replace(/\/+$/, '')}/`
      : link(base, '/redaction/');
    built.innerHTML = footBuiltHtml(redactionHref, demoEditorialEntryOn(editorial));
    credit.append(built);
  });
  document.querySelectorAll('.masthead-meta > span').forEach((node) => { node.textContent = publication.institution || ''; });
  // Réseaux sociaux : au mât et au pied de page, un réseau vide n'est pas affiché.
  document.querySelectorAll('.masthead-meta, .site-foot__brand').forEach((host) => {
    host.querySelectorAll(':scope > .social-links').forEach((node) => node.remove());
    host.insertAdjacentHTML('beforeend', socialNavHtml(publication.social, publication.name, host.classList.contains('masthead-meta') ? 'masthead-social' : 'site-foot__social'));
  });
  const masthead = document.querySelector('.masthead');
  const backgrounds = publication.masthead?.backgrounds;
  const images = backgrounds?.enabled === false ? [] : (backgrounds?.images || []);
  const overlay = Number(publication.masthead?.overlayStrength);
  masthead?.style.setProperty('--masthead-overlay', String(Number.isFinite(overlay) ? Math.min(.9, Math.max(0, overlay)) : .55));
  if (masthead) masthead.dataset.textAlignment = publication.masthead?.textAlignment || 'left';
  masthead?.classList.toggle('masthead--illustrated', Boolean(images.length));
  masthead?.querySelectorAll('[data-masthead-background], .masthead-background-shade, [data-masthead-credit], #masthead-backgrounds').forEach((node) => node.remove());
  if (masthead && images.length) {
    const image = document.createElement('img'); image.className = 'masthead-background'; image.dataset.mastheadBackground = ''; image.alt = ''; applyResponsive(image, responsiveAttrs(images[0], base, SIZES_MASTHEAD)); image.style.objectPosition = `${images[0].focalPoint?.x ?? 50}% ${images[0].focalPoint?.y ?? 50}%`;
    const shade = document.createElement('span'); shade.className = 'masthead-background-shade'; shade.setAttribute('aria-hidden', 'true');
    const credit = document.createElement('span'); credit.className = 'masthead-photo-credit'; credit.dataset.mastheadCredit = ''; if (images[0].credit) { /* Même libellé que kiosque.js (rotation) : crédit et licence ; lien seulement s'il existe. */ const label = `Photo : ${images[0].credit}${images[0].license ? ` (${images[0].license})` : ''}`; const href = images[0].creditUrl || images[0].sourceUrl || ''; if (/^https:\/\//i.test(href)) { const anchor = document.createElement('a'); anchor.href = href; anchor.rel = 'noopener'; anchor.textContent = label; credit.append(anchor); } else credit.textContent = label; }
    const manifest = document.createElement('script'); manifest.type = 'application/json'; manifest.id = 'masthead-backgrounds'; manifest.textContent = JSON.stringify({ randomOrder: backgrounds?.randomOrder !== false, images: images.map((item) => { const attrs = responsiveAttrs(item, base, SIZES_MASTHEAD); return { ...item, src: attrs.src, srcset: attrs.srcset, sizes: attrs.sizes, backgroundPosition: `${item.focalPoint?.x ?? 50}% ${item.focalPoint?.y ?? 50}%` }; }) });
    if (backgrounds?.randomOrder !== false && images.length > 1) {
      let i = 0;
      try { i = (window.BgRotation && typeof window.BgRotation.randInt === 'function') ? window.BgRotation.randInt(images.length) : Math.floor(Math.random() * images.length); } catch (_) { i = Math.floor(Math.random() * images.length); }
      const chosen = images[i];
      if (chosen) {
        applyResponsive(image, responsiveAttrs(chosen, base, SIZES_MASTHEAD));
        image.style.objectPosition = `${chosen.focalPoint?.x ?? 50}% ${chosen.focalPoint?.y ?? 50}%`;
        image.setAttribute('data-masthead-start', String(i));
        if (chosen.credit) {
          const label = `Photo : ${chosen.credit}${chosen.license ? ` (${chosen.license})` : ''}`;
          const href = chosen.creditUrl || chosen.sourceUrl || '';
          credit.replaceChildren();
          if (/^https:\/\//i.test(href)) { const anchor = document.createElement('a'); anchor.href = href; anchor.rel = 'noopener'; anchor.textContent = label; credit.append(anchor); } else credit.textContent = label;
        }
      }
    }
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
  let sportsHost = document.querySelector('#masthead-sports-strip, .masthead-sports-strip, .masthead-sports');
  const needWeather = Boolean(weather?.enabled && weather.localities?.length);
  const sportsTeams = Array.isArray(sports?.teams) && sports.teams.length
    ? sports.teams
    : (sports?.team ? [sports.team] : []);
  const needSports = Boolean(sports?.enabled !== false && sportsTeams.length);
  if (needWeather) {
    if (!statusHost) {
      statusHost = document.createElement('div');
      statusHost.className = 'masthead-status';
      statusHost.dataset.mastheadStatus = '';
      document.querySelector('.masthead-tools')?.before(statusHost);
    }
    if (!weatherHost || !statusHost.contains(weatherHost)) {
      weatherHost = document.createElement('div');
      weatherHost.className = 'masthead-weather';
      statusHost.prepend(weatherHost);
    }
    weatherHost.dataset.weatherLocalities = JSON.stringify(weather.localities.slice(0, 4));
  } else {
    weatherHost?.remove();
    if (statusHost && !statusHost.querySelector('.masthead-weather')) statusHost.remove();
  }
  if (needSports) {
    const inMast = Boolean(sportsHost && sportsHost.closest('header.masthead, .masthead-status'));
    if (!sportsHost || inMast) {
      const strip = document.createElement('div');
      strip.className = 'masthead-sports-strip masthead-sports';
      strip.id = 'masthead-sports-strip';
      strip.hidden = true;
      strip.setAttribute('aria-live', 'polite');
      const dock = document.getElementById('masthead-weather-dock');
      const nav = document.querySelector('.nav-wrap');
      if (dock) dock.after(strip);
      else if (nav) nav.before(strip);
      else document.querySelector('.masthead')?.after(strip);
      if (sportsHost && sportsHost !== strip) sportsHost.remove();
      sportsHost = strip;
    }
    sportsHost.classList.add('masthead-sports-strip', 'masthead-sports');
    if (!sportsHost.id) sportsHost.id = 'masthead-sports-strip';
    const sportsHref = sportsBoardHref(base, sports);
    // setAttribute : évite les surprises dataset + garantit le re-parse kiosque.js
    const sportsPayload = pruneSportsPayload({
      teams: sportsTeams,
      results: sports.results || [],
      nextGame: sports.nextGame || null,
      nextGames: sports.nextGames || [],
      demoAsOf: sports.demoAsOf || null,
      demoLive: sports.demoLive,
    }, { demoAsOf: sports.demoAsOf, demoLive: sports.demoLive });
    const prunedTeams = Array.isArray(sportsPayload.teams) && sportsPayload.teams.length
      ? sportsPayload.teams
      : sportsTeams;
    sportsHost.setAttribute('data-sports-payload', JSON.stringify({
      teams: prunedTeams,
      team: prunedTeams[0],
      results: sportsPayload.results || [],
      nextGame: sportsPayload.nextGame || null,
      nextGames: sportsPayload.nextGames || [],
      href: sportsHref,
      demoAsOf: sportsPayload.demoAsOf || sports.demoAsOf || null,
      demoLive: sports.demoLive || null,
      timeZone: bundle.publication.timeZone || 'America/Toronto',
    }));
    sportsHost.setAttribute('aria-label', 'Au tableau — scores et matchs');
  } else sportsHost?.remove();
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
    ...(needSports ? [{ href: link(base, '/sports/'), label: 'Au tableau' }] : []),
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
  const hideRss = Boolean(publication.noindex);
  document.querySelectorAll('.masthead-rss, link[rel="alternate"][type="application/atom+xml"]').forEach((node) => {
    node.toggleAttribute('hidden', hideRss);
    if (node instanceof HTMLLinkElement) node.disabled = hideRss;
  });
  let util = document.querySelector('.site-foot__links');
  if (!util) {
    util = document.createElement('nav');
    util.className = 'site-foot__links';
    util.setAttribute('aria-label', 'Liens de pied de page');
    document.querySelector('.site-foot__nav')?.after(util);
  }
  const footParts = [];
  if (!hideRss) footParts.push(`<a href="${link(base, '/feed.xml')}">Flux RSS</a>`);
  footParts.push(`<a data-editorial-link href="${link(base, '/archives/')}">Archives</a>`);
  footParts.push(`<a data-editorial-link href="${link(base, '/plan-du-site/')}">Plan du site</a>`);
  footParts.push(`<a data-editorial-link href="${link(base, '/revue/')}">Revue</a>`);
  footParts.push(`<a data-editorial-link href="${link(base, '/recherche/')}">Recherche</a>`);
  const sep = '<span class="site-foot__sep" aria-hidden="true">·</span>';
  util.innerHTML = footParts.join(sep);
  document.body.classList.toggle('with-radio', Boolean(radioStation(publication.radio)));
  syncRadarTuner(publication.radio);
}

/**
 * Garde la barre radio de LE-RADAR (écoute en cours) tant que la station ne
 * change pas ; sinon, pose un nouvel emplacement avec l'appel au module.
 * Radio éteinte : l'emplacement disparaît et le module n'est pas chargé.
 */
function syncRadarTuner(radio) {
  const current = document.querySelector('.radar-radio-slot');
  const station = radioStation(radio);
  if (!station) {
    current?.remove();
    return;
  }
  if (current && current.dataset.station === station) return;
  const next = radioSlotElement(radio);
  if (current) current.replaceWith(next);
  else document.querySelector('header')?.after(next);
}
