import { renderSourceArticle } from './source-view.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ESCAPES[character]);

function formatDateTime(value, timeZone = 'America/Toronto') {
  if (!value) return '';
  return new Intl.DateTimeFormat('fr-CA', { dateStyle: 'long', timeStyle: 'short', timeZone }).format(new Date(value));
}

function link(base, path) {
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function safeMediaUrl(value) {
  const raw = String(value || '');
  return /^(?:data:image\/(?:svg\+xml|png|webp|jpeg);base64,|https?:\/\/|\/)/i.test(raw) ? raw : '';
}

function byline(article, bundle) {
  const names = article.authors.map((slug) => bundle.authors.find((author) => author.slug === slug)?.name || slug);
  return names.length ? `<p class="article-byline">Par ${names.map(esc).join(' et ')}</p>` : '';
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
    leadEyebrow: labels.leadEyebrow || labels.wireTitle || 'À la une',
    date: {
      iso: article.publishedAt || article.updatedAt,
      label: formatDateTime(article.publishedAt || article.updatedAt, bundle.publication.timeZone),
    },
    authors: article.authors.map((slug) => ({ name: bundle.authors.find((author) => author.slug === slug)?.name || slug })),
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

export function renderRoute(bundle, base, pathname, renderBody) {
  const route = pathname.slice(base.length).replace(/^\/+|\/+$/g, '');
  const parts = route ? route.split('/') : [];
  const published = bundle.articles.filter((article) => article.status === 'published');
  if (!parts.length) {
    const [first, ...rest] = published;
    const features = rest.slice(0, 3);
    const briefs = rest.slice(3, 10);
    const tail = rest.slice(10);
    return {
      title: `${bundle.publication.name} — ${bundle.publication.tagline || bundle.publication.institution}`,
      html: (() => {
        const wireTitle = bundle.publication.labels?.wireTitle || 'À la une';
        return `<div class="wrap wire"><div class="wire-head"><h1 class="wire-title">${esc(wireTitle)}</h1><span class="wire-status">${published.length} article${published.length > 1 ? 's' : ''}</span></div>${first ? `<div class="magazine-layout"><section class="news-hero" aria-label="${esc(wireTitle)}">${articleCard(first, bundle, base, 'lead')}<div class="news-features">${features.map((item) => articleCard(item, bundle, base, 'feature')).join('')}</div></section>${briefs.length ? `<aside class="brief-rail"><h2>En bref</h2>${briefs.map((item) => articleCard(item, bundle, base, 'brief')).join('')}</aside>` : ''}${tail.length ? `<section class="news-tail"><h2>Suite du fil</h2><div class="news-tail-grid">${tail.map((item) => articleCard(item, bundle, base, 'tail')).join('')}</div></section>` : ''}</div>` : '<p class="empty">Aucun article publié pour le moment.</p>'}</div>`;
      })(),
    };
  }
  if (parts[0] === 'articles' && parts[1]) {
    const article = published.find((item) => item.slug === decodeURIComponent(parts[1]));
    if (!article) return null;
    const authors = article.authors.map((slug) => bundle.authors.find((item) => item.slug === slug)?.name || slug);
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
    const briefs = published.filter((item) => item.slug !== article.slug).slice(0, 7);
    const post = `<article class="post post--in-magazine">${eyebrow}<h1 class="post-title">${esc(article.title)}</h1>${article.subtitle ? `<p class="post-subtitle">${esc(article.subtitle)}</p>` : ''}${article.dek ? `<p class="post-dek">${esc(article.dek)}</p>` : ''}<div class="post-meta"><span>Par ${authors.map(esc).join(', ')}</span><time datetime="${esc(article.publishedAt || article.updatedAt)}">${esc(formatDateTime(article.publishedAt || article.updatedAt, bundle.publication.timeZone))}</time></div>${mediaFigure(article, base)}<div class="post-body">${renderBody(article)}</div>${categories.length ? `<div class="post-tags">${categories.map((category) => `<a class="tag" data-editorial-link href="${link(base, `/categories/${encodeURIComponent(category.slug)}/`)}">${esc(category.name)}</a>`).join('')}</div>` : ''}</article>`;
    const rail = briefs.length
      ? `<aside class="brief-rail brief-rail--article" aria-label="En bref"><h2>En bref</h2>${briefs.map((item) => articleCard(item, bundle, base, 'brief')).join('')}</aside>`
      : '';
    return {
      title: `${article.title} — ${bundle.publication.name}`,
      html: `<div class="wrap wire wire--article"><div class="magazine-layout magazine-layout--article"><div class="article-column">${post}</div>${rail}</div></div>`,
    };
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
    return { title: `${entity.name} — ${bundle.publication.name}`, html: `<div class="wrap wire"><div class="wire-head"><h1 class="wire-title">${esc(entity.name)}</h1><span class="wire-status">${articles.length} article${articles.length > 1 ? 's' : ''}</span></div>${entity.description ? `<p class="section-intro">${esc(entity.description)}</p>` : ''}${articles.length ? articles.map((item) => articleCard(item, bundle, base)).join('') : `<p class="empty">${definition.empty}</p>`}</div>` };
  }
  if (parts[0] === 'auteurs') {
    if (!parts[1]) {
      return { title: `L’équipe — ${bundle.publication.name}`, html: `<div class="wrap wire"><div class="wire-head"><h1 class="wire-title">L’équipe</h1></div>${bundle.authors.map((author) => `<article class="author-card"><h2><a data-editorial-link href="${link(base, `/auteurs/${encodeURIComponent(author.slug)}/`)}">${esc(author.name)}</a></h2><p>${esc(author.role || '')}</p></article>`).join('')}</div>` };
    }
    const author = bundle.authors.find((item) => item.slug === decodeURIComponent(parts[1]));
    if (!author) return null;
    const articles = published.filter((article) => article.authors.includes(author.slug));
    return { title: `${author.name} — ${bundle.publication.name}`, html: `<div class="wrap wire"><div class="wire-head"><h1 class="wire-title">${esc(author.name)}</h1></div><p class="author-role">${esc(author.role || '')}</p><p class="author-bio">${esc(author.bio || '')}</p>${articles.map((item) => articleCard(item, bundle, base)).join('')}</div>` };
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
  }
  const weather = publication.masthead?.weather;
  let weatherHost = document.querySelector('.masthead-weather');
  if (weather?.enabled && weather.localities?.length) {
    if (!weatherHost) { weatherHost = document.createElement('div'); weatherHost.className = 'masthead-weather'; document.querySelector('.masthead-tools')?.before(weatherHost); }
    weatherHost.dataset.weatherLocalities = JSON.stringify(weather.localities.slice(0, 4));
  } else weatherHost?.remove();
  document.querySelector('a[href="https://le-radar.ca/pomo/"]')?.toggleAttribute('hidden', publication.masthead?.tools?.pomodoro === false);
  document.querySelector('a[href="https://le-radar.ca/solitaire/"]')?.toggleAttribute('hidden', publication.masthead?.tools?.solitaire === false);
  const nav = document.querySelector('.nav');
  if (nav) {
    nav.innerHTML = [
      `<a data-editorial-link href="${base}/">Accueil</a>`,
      ...bundle.taxonomies.sections.map((section) => {
        const color = section.color && /^#[0-9a-fA-F]{3,8}$/.test(section.color)
          ? ` class="nav-section" style="--nav-c:${esc(section.color)}"`
          : '';
        return `<a data-editorial-link href="${link(base, `/sections/${encodeURIComponent(section.slug)}/`)}"${color}>${esc(section.name)}</a>`;
      }),
      `<a data-editorial-link href="${link(base, '/auteurs/')}">Équipe</a>`,
    ].join('');
  }
  document.body.classList.toggle('with-radio', Boolean(publication.radio && publication.radio.enabled !== false));
  let currentRadio = document.querySelector('radar-tuner');
  if (publication.radio?.enabled === false) currentRadio?.remove();
  else if (publication.radio) {
    const params = new URLSearchParams({ surface: 'kiosque-v1' });
    if (publication.radio.station) params.set('station', publication.radio.station);
    const src = `https://le-radar.ca/tuner-embed.html?${params}`;
    if (currentRadio?.dataset.src !== src) { currentRadio?.remove(); currentRadio = null; }
    if (currentRadio) return;
    const tuner = document.createElement('radar-tuner');
    tuner.className = 'radar-tuner';
    tuner.dataset.src = src;
    tuner.hidden = true;
    tuner.innerHTML = '<a href="https://le-radar.ca/" rel="noopener">Écouter LE-RADAR</a>';
    document.querySelector('header')?.after(tuner);
  }
}
