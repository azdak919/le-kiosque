const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ESCAPES[character]);

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('fr-CA', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(value));
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

function articleCard(article, bundle, base, lead = false) {
  const section = bundle.taxonomies.sections.find((item) => item.slug === article.section);
  return `<article class="article${lead ? ' article--lead' : ''}">
    ${lead ? '<span class="article-eyebrow">À la une</span>' : ''}
    <div class="article-meta"><span class="article-section">${esc(section?.name || '')}</span><time>${esc(formatDate(article.publishedAt || article.updatedAt))}</time></div>
    <h2 class="article-title"><a data-editorial-link href="${link(base, `/articles/${encodeURIComponent(article.slug)}/`)}">${esc(article.title)}</a></h2>
    ${byline(article, bundle)}<p class="article-brief">${esc(article.excerpt || '')}</p>
  </article>`;
}

export function renderRoute(bundle, base, pathname, markdownToHtml) {
  const route = pathname.slice(base.length).replace(/^\/+|\/+$/g, '');
  const parts = route ? route.split('/') : [];
  const published = bundle.articles.filter((article) => article.status === 'published');
  if (!parts.length) {
    const [first, ...rest] = published;
    return {
      title: `${bundle.publication.name} — ${bundle.publication.tagline || bundle.publication.institution}`,
      html: `<div class="wrap wire"><div class="wire-head"><h1 class="wire-title">Le fil</h1><span class="wire-status">${published.length} article${published.length > 1 ? 's' : ''}</span></div>${first ? articleCard(first, bundle, base, true) + `<div class="news-list">${rest.map((item) => articleCard(item, bundle, base)).join('')}</div>` : '<p class="empty">Aucun article publié pour le moment.</p>'}</div>`,
    };
  }
  if (parts[0] === 'articles' && parts[1]) {
    const article = published.find((item) => item.slug === decodeURIComponent(parts[1]));
    if (!article) return null;
    const authors = article.authors.map((slug) => bundle.authors.find((item) => item.slug === slug)?.name || slug);
    const categories = article.categories.map((slug) => bundle.taxonomies.categories.find((item) => item.slug === slug)).filter(Boolean);
    return {
      title: `${article.title} — ${bundle.publication.name}`,
      html: `<article class="wrap post"><h1 class="post-title">${esc(article.title)}</h1>${article.subtitle ? `<p class="post-subtitle">${esc(article.subtitle)}</p>` : ''}${article.dek ? `<p class="post-dek">${esc(article.dek)}</p>` : ''}<div class="post-meta"><span>Par ${authors.map(esc).join(', ')}</span><time>${esc(formatDate(article.publishedAt || article.updatedAt))}</time></div><div class="post-body">${markdownToHtml(article.body?.raw || '')}</div>${categories.length ? `<div class="post-tags">${categories.map((category) => `<a class="tag" data-editorial-link href="${link(base, `/categories/${encodeURIComponent(category.slug)}/`)}">${esc(category.name)}</a>`).join('')}</div>` : ''}</article>`,
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
  const nav = document.querySelector('.nav');
  if (nav) nav.innerHTML = [`<a data-editorial-link href="${base}/">Accueil</a>`, ...bundle.taxonomies.sections.map((section) => `<a data-editorial-link href="${link(base, `/sections/${encodeURIComponent(section.slug)}/`)}">${esc(section.name)}</a>`), `<a data-editorial-link href="${link(base, '/auteurs/')}">Équipe</a>`].join('');
  const currentRadio = document.querySelector('radar-tuner');
  if (publication.radio?.enabled === false) currentRadio?.remove();
  else if (!currentRadio && publication.radio) {
    const params = new URLSearchParams({ theme: publication.radio.theme || 'auto' });
    if (publication.radio.station) params.set('station', publication.radio.station);
    const tuner = document.createElement('radar-tuner');
    tuner.className = 'radar-tuner';
    tuner.dataset.src = `https://le-radar.ca/tuner-embed.html?${params}`;
    tuner.innerHTML = '<a href="https://le-radar.ca/" rel="noopener">Écouter LE RADAR</a>';
    if (publication.radio.position === 'bottom') document.querySelector('footer')?.before(tuner);
    else document.querySelector('header')?.before(tuner);
  }
}
