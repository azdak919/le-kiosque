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

/*
 * Budgets d’extrait : assez longs pour remplir le float (vignette) sans
 * laisser une seule ligne orpheline à côté de la photo — surtout En bref.
 */
const EXCERPT_LIMITS = Object.freeze({ lead: 960, feature: 960, brief: 360, tail: 280 });
/**
 * Seuil de misère pour En bref : on masque seulement les bribes (1–2 mots /
 * un libellé). Un vrai chapô d’une phrase courte reste affiché.
 */
const BRIEF_MIN_WORDS = 6;
const BRIEF_MIN_CHARS = 40;

function normalizeRole(value) {
  return ['lead', 'feature', 'brief', 'tail'].includes(value) ? value : 'tail';
}

/** Retire crédits photo collés au chapô (le crédit vit sous la vignette). */
function sanitizeExcerptText(value = '') {
  let s = String(value ?? '');
  s = s.replace(/\s*\(\s*(?:Photo(?:\s*credit)?|Crédit(?:\s*photo)?|Credit|Image|Illustration)\s*:\s*[^)]+\)\.?\s*/gi, ' ');
  s = s.replace(/(?:^|[.\s])(?:Photo(?:\s*credit)?|Crédit(?:\s*photo)?|Credit|Image|Illustration)\s*:\s*[^.!?\n(]{2,80}\.?\s*/gi, ' ');
  /* Résidu type « . Doe » après un crédit coupé — pas un mot de phrase normal. */
  s = s.replace(/([.!?»"')\]])\s+[\p{L}'’]{1,18}\s*$/u, '$1');
  s = s.replace(/\.\s*\./g, '.');
  return s.replace(/\s+/g, ' ').trim();
}

function wordCount(text) {
  return String(text || '').split(/\s+/).filter(Boolean).length;
}

/**
 * Coupe à la limite en privilégiant une fin de phrase, sinon un espace.
 * Évite les extraits d’un seul mot ou d’une demi-ligne mutilée.
 */
function truncateExcerpt(value, role) {
  const text = sanitizeExcerptText(value);
  const limit = EXCERPT_LIMITS[role];
  if (!text) return { text: '', truncated: false };
  /* En bref : masquer un chapô trop maigre (mot isolé / libellé), pas une phrase. */
  if (role === 'brief' && wordCount(text) < BRIEF_MIN_WORDS && text.length < BRIEF_MIN_CHARS) {
    return { text: '', truncated: false };
  }
  if (text.length <= limit) return { text, truncated: false };

  const window = text.slice(0, limit);
  /* Préférer une fin de phrase dans le dernier tiers de la fenêtre. */
  const minSentence = Math.floor(limit * 0.55);
  let cut = -1;
  for (const re of [/[.!?]["»')\]]?\s/g, /[!?]\s/g]) {
    let match;
    while ((match = re.exec(window)) !== null) {
      const at = match.index + match[0].length;
      if (at >= minSentence && at <= limit) cut = at;
    }
    if (cut > 0) break;
  }
  if (cut < 0) {
    const boundary = window.lastIndexOf(' ');
    cut = boundary > 80 ? boundary : limit;
  }
  const sliced = text.slice(0, cut).trim().replace(/[,;:–—-]\s*$/, '').trim();
  return { text: `${sliced}…`, truncated: true };
}

function imageMarkup(image, role) {
  if (!image?.src) return '';
  const credit = [image.caption, image.credit && `Photo : ${image.credit}`].filter(Boolean).map(escapeSourceViewHtml).join(' — ');
  const loading = role === 'lead' ? 'eager' : 'lazy';
  /*
   * Attributs width/height : utiles pour la une (réserve CLS au 16:9).
   * Sur vignettes (feature/brief), on les omet — le ratio intrinsèque du
   * JPEG (souvent 3:2 / 16:9) gagnait sur le carré CSS 1:1.
   */
  const isThumb = role === 'feature' || role === 'brief';
  const width = !isThumb && Number.isFinite(Number(image.width)) ? ` width="${Number(image.width)}"` : '';
  const height = !isThumb && Number.isFinite(Number(image.height)) ? ` height="${Number(image.height)}"` : '';
  const x = Math.max(0, Math.min(100, Number(image.focalPoint?.x ?? 50)));
  const y = Math.max(0, Math.min(100, Number(image.focalPoint?.y ?? 50)));
  /* onerror : retire la figure si 404 (IDB périmée / chemin mort) pour ne pas
     afficher l’alt brut en place de la vignette En bref. */
  const onErr = `onerror="const f=this.closest('figure');const a=this.closest('article');if(f)f.remove();if(a){a.classList.remove('has-image','article--thumb');}"`;
  return `<figure class="article-media"><img src="${escapeSourceViewHtml(image.src)}" alt="${escapeSourceViewHtml(image.alt || '')}" loading="${loading}" decoding="async" style="object-position:${x}% ${y}%"${width}${height} ${onErr}>${credit ? `<figcaption class="article-media-credit">${credit}</figcaption>` : ''}</figure>`;
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
