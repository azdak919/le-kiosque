/**
 * Port contrôlé du bloc « source individuelle » de LE-RADAR.
 *
 * Ce module est volontairement sans dépendance de framework : il est appelé
 * par la génération statique TypeScript et par la démonstration PGlite dans
 * le navigateur. Une seule structure HTML pilote donc les deux rendus.
 *
 * Référence : LE-RADAR, app.js (createArticle / partitionSourceFeed) et
 * style.css (cartes éditoriales), révision a7f18d5. Les adaptations propres
 * à LE-KIOSQUE sont documentées dans LE-RADAR-SOURCE-VIEW.json.
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const escapeSourceViewHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ESCAPES[character]);

const EXCERPT_LIMITS = Object.freeze({ lead: 720, feature: 520, brief: 360, tail: 280 });

function normalizeRole(value) {
  return ['lead', 'feature', 'brief', 'tail'].includes(value) ? value : 'tail';
}

function truncateExcerpt(value, role) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  const limit = EXCERPT_LIMITS[role];
  if (!text || text.length <= limit) return { text, truncated: false };
  const boundary = text.lastIndexOf(' ', limit - 1);
  return { text: `${text.slice(0, boundary > 80 ? boundary : limit).trim()}…`, truncated: true };
}

function imageMarkup(image, role) {
  if (!image?.src) return '';
  const credit = [image.caption, image.credit && `Photo : ${image.credit}`].filter(Boolean).map(escapeSourceViewHtml).join(' — ');
  const loading = role === 'lead' ? 'eager' : 'lazy';
  const width = Number.isFinite(Number(image.width)) ? ` width="${Number(image.width)}"` : '';
  const height = Number.isFinite(Number(image.height)) ? ` height="${Number(image.height)}"` : '';
  const x = Math.max(0, Math.min(100, Number(image.focalPoint?.x ?? 50)));
  const y = Math.max(0, Math.min(100, Number(image.focalPoint?.y ?? 50)));
  return `<figure class="article-media"><img src="${escapeSourceViewHtml(image.src)}" alt="${escapeSourceViewHtml(image.alt || '')}" loading="${loading}" decoding="async" style="object-position:${x}% ${y}%"${width}${height}>${credit ? `<figcaption class="article-media-credit">${credit}</figcaption>` : ''}</figure>`;
}

function authorsMarkup(authors, linkAttributes) {
  if (!Array.isArray(authors) || !authors.length) return '';
  const names = authors.map((author) => {
    const name = escapeSourceViewHtml(author?.name || '');
    const attributes = linkAttributes ? `${linkAttributes} ` : '';
    return author?.href
      ? `<a class="article-author" ${attributes}href="${escapeSourceViewHtml(author.href)}">${name}</a>`
      : `<span class="article-author">${name}</span>`;
  }).filter(Boolean);
  if (!names.length) return '';
  // Libellé + séparateurs en spans : évite les blancs bizarres (margin sur chaque auteur).
  let joined = names[0];
  if (names.length === 2) {
    joined = `${names[0]}<span class="article-byline__sep"> et </span>${names[1]}`;
  } else if (names.length > 2) {
    joined = `${names.slice(0, -1).join('<span class="article-byline__sep">, </span>')}<span class="article-byline__sep"> et </span>${names[names.length - 1]}`;
  }
  return `<p class="article-byline"><span class="article-byline__label">Par</span> ${joined}</p>`;
}

/**
 * Rend une carte éditoriale. `href` pointe vers une page locale pour
 * LE-KIOSQUE; le même noyau peut aussi recevoir une URL originale externe.
 */
export function renderSourceArticle(view, requestedRole = 'tail') {
  const role = normalizeRole(requestedRole);
  const section = String(view?.section || '').trim();
  const href = String(view?.href || '').trim();
  const linkAttributes = String(view?.linkAttributes || '').trim();
  const linkAttributesPrefix = linkAttributes ? `${linkAttributes} ` : '';
  const title = escapeSourceViewHtml(view?.title || 'Article sans titre');
  const date = String(view?.date?.iso || '');
  const dateLabel = escapeSourceViewHtml(view?.date?.label || '');
  const excerpt = truncateExcerpt(view?.excerpt, role);
  const showImage = Boolean(view?.image?.src) && role !== 'tail';
  const roleClasses = [
    'article',
    `article--${role}`,
    showImage ? 'has-image' : '',
    showImage && (role === 'feature' || role === 'brief') ? 'article--thumb' : '',
    role === 'brief' ? 'article--compact' : '',
  ].filter(Boolean).join(' ');
  const articleLink = href ? `<a ${linkAttributesPrefix}href="${escapeSourceViewHtml(href)}">${title}</a>` : title;
  // Lien hors du span clampé (LE-RADAR) : sinon -webkit-line-clamp sur
  // .article-brief coupe « Lire la suite » en bas de la colonne En bref.
  const readMore = href && (view?.readMore || excerpt.truncated)
    ? ` <a class="article-more" ${linkAttributesPrefix}href="${escapeSourceViewHtml(href)}">Lire la suite <span aria-hidden="true">→</span><span class="sr-only"> : ${title}</span></a>`
    : '';
  const briefClass = `article-brief${excerpt.truncated ? ' is-truncated' : ''}`;
  // Couleur de rubrique (section) — optionnelle, distincte de la marque.
  const colorRaw = String(view?.color || '').trim();
  const color = /^#[0-9a-fA-F]{3,8}$/.test(colorRaw) ? colorRaw : '';
  const colorStyle = color ? ` style="--c:${escapeSourceViewHtml(color)}"` : '';

  return `<article class="${roleClasses}"${colorStyle}>
  ${role === 'lead' ? `<span class="article-eyebrow">${escapeSourceViewHtml(view?.leadEyebrow || 'À la une')}</span>` : ''}
  <div class="article-meta">
    ${section ? `<span class="article-section">${escapeSourceViewHtml(section)}</span>` : '<span class="article-section article-section--empty" aria-hidden="true"></span>'}
    ${dateLabel ? `<time class="article-time" datetime="${escapeSourceViewHtml(date)}">${dateLabel}</time>` : ''}
  </div>
  <h2 class="article-title">${articleLink}</h2>
  ${authorsMarkup(view?.authors, linkAttributes)}
  ${showImage ? imageMarkup(view.image, role) : ''}
  ${excerpt.text ? `<p class="${briefClass}"><span class="article-brief-text">${escapeSourceViewHtml(excerpt.text)}</span>${readMore}</p>` : ''}
</article>`;
}

export const sourceViewRules = Object.freeze({
  imageRoles: ['lead', 'feature', 'brief'],
  noImageRoles: ['tail'],
  excerptLimits: EXCERPT_LIMITS,
});
