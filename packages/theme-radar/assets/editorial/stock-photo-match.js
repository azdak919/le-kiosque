/**
 * Scoring photo libre côté navigateur (parité LE-RADAR scoreCandidate allégée).
 * Classe la banque locale du journal selon titre + extrait + corps de l’article.
 */

const STOP = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'l', 'a', 'au', 'aux', 'en', 'et', 'ou',
  'pour', 'par', 'sur', 'dans', 'son', 'sa', 'ses', 'leur', 'leurs', 'ce', 'cette', 'ces', 'qui',
  'que', 'quoi', 'dont', 'est', 'sont', 'avec', 'sans', 'plus', 'moins', 'tout', 'tous', 'toute',
  'comment', 'pourquoi', 'quand', 'vers', 'chez', 'entre', 'apres', 'avant', 'depuis', 'the', 'and',
  'for', 'with', 'from', 'that', 'this', 'are', 'was', 'were', 'has', 'have', 'into', 'about',
  'lire', 'suite', 'photo', 'credit', 'credits', 'journal', 'campus', 'etudiant', 'etudiante',
]);

const ABSTRACT = new Set([
  'relation', 'relations', 'societe', 'societes', 'monde', 'avenir', 'futur', 'question',
  'questions', 'enjeu', 'enjeux', 'debat', 'impact', 'impacts', 'realite', 'idee', 'idees',
  'choix', 'sujet', 'sujets', 'propos', 'chose', 'choses', 'gens',
]);

const GEO = new Set([
  'quebec', 'montreal', 'canada', 'canadien', 'canadienne', 'laval', 'sherbrooke', 'gatineau',
  'ville', 'ouest', 'est', 'nord', 'sud',
]);

function normalize(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text) {
  return normalize(text)
    .split(/[\s-]+/)
    .filter((w) => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w));
}

function isTopic(tok) {
  return tok.length >= 3 && !STOP.has(tok) && !GEO.has(tok);
}

function hayHas(hay, tok) {
  if (!tok || tok.length < 3) return false;
  if (hay.includes(tok)) return true;
  if (tok.length >= 5 && hay.includes(tok.slice(0, -1))) return true;
  return false;
}

export function buildTokens(item) {
  const title = item.title || '';
  const content = [item.excerpt, item.leadExcerpt, item.body].filter(Boolean).join(' ');
  const titleToks = tokenize(title);
  const contentToks = tokenize(content).filter((t) => !GEO.has(t) || t.length >= 6);
  const important = [];
  const seen = new Set();
  for (const t of [...titleToks, ...contentToks]) {
    if (t.length >= 4 && isTopic(t) && !seen.has(t)) {
      seen.add(t);
      important.push(t);
    }
  }
  return {
    title: titleToks,
    content: contentToks.slice(0, 40),
    important: important.slice(0, 18),
  };
}

export function scoreLocal(hit, tokens) {
  const w = hit.width || 1280;
  const h = hit.height || 720;
  if (w < 400 || h < 250) return -1;
  let score = 0;
  if (w >= 720 && h >= 405) score += 70;
  else if (w >= 560) score += 40;
  else score += 18;
  const ratio = w / Math.max(h, 1);
  if (ratio >= 1.1 && ratio <= 2.2) score += 18;

  const hay = normalize(
    [hit.title, hit.alt, hit.caption, hit.tags, (hit.keywords || []).join(' '), hit.institution, hit.campus, hit.src]
      .filter(Boolean)
      .join(' '),
  );

  let titleMatched = 0;
  let importantMatched = 0;
  let contentMatched = 0;
  let concrete = 0;

  for (const tok of tokens.title || []) {
    if (!isTopic(tok) || tok.length < 3) continue;
    if (hayHas(hay, tok)) {
      titleMatched += 1;
      score += tok.length >= 5 ? 36 : 26;
      if (!ABSTRACT.has(tok)) concrete += 1;
    }
  }
  for (const tok of tokens.important || []) {
    if (!isTopic(tok)) continue;
    if (hayHas(hay, tok)) {
      importantMatched += 1;
      score += 18;
      if (!ABSTRACT.has(tok)) concrete += 1;
    }
  }
  for (const tok of tokens.content || []) {
    if (!isTopic(tok)) continue;
    if (hayHas(hay, tok)) {
      contentMatched += 1;
      score += tok.length >= 5 ? 14 : 8;
      if (!ABSTRACT.has(tok)) concrete += 1;
    }
  }

  const topic = titleMatched + importantMatched + contentMatched;
  if (topic === 0) return -1;
  if (concrete === 0) return -1;

  const titleTopicCount = (tokens.title || []).filter((t) => isTopic(t) && t.length >= 3).length;
  if (titleTopicCount >= 2 && titleMatched === 0 && importantMatched < 2) return -1;

  return score > 0 ? score : -1;
}

/**
 * Classe la banque locale selon le contenu de l’article.
 * @param {{ title?: string, excerpt?: string, body?: string }} article
 * @param {Array<object>} media
 * @param {{ usage?: string, minScore?: number, limit?: number }} [opts]
 */
export function rankLocalMedia(article, media, opts = {}) {
  const minScore = opts.minScore ?? 40;
  const limit = opts.limit ?? 12;
  const usage = opts.usage;
  const tokens = buildTokens(article || {});
  const ranked = [];
  for (const m of media || []) {
    if (usage && m.usages?.length && !m.usages.includes(usage)) continue;
    const hit = {
      src: m.src,
      width: m.width,
      height: m.height,
      title: m.title || m.alt || m.caption || '',
      alt: m.alt,
      caption: m.caption,
      tags: (m.keywords || []).join(' '),
      keywords: m.keywords,
      institution: m.institution,
      campus: m.campus,
    };
    const score = scoreLocal(hit, tokens);
    if (score >= minScore) ranked.push({ ...m, score });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}
