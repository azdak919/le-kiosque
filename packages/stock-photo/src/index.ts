/**
 * Algo de sélection de photo libre (port LE-RADAR stock-photo-lib).
 * Openverse + Wikimedia Commons, scoring thématique titre + contenu.
 *
 * Utilisation Node (pipeline, outils) via createRequire sur le vendor CJS.
 * Pour le navigateur, voir assets/stock-photo-match.js (scoring local).
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const vendorDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../vendor');
const stock = require(path.join(vendorDir, 'stock-photo-lib.cjs')) as StockPhotoLib;

export type StockArticleItem = {
  title?: string;
  excerpt?: string;
  leadExcerpt?: string;
  body?: string;
  institution?: string;
  region?: string;
  source?: string;
  stockImage?: string;
  imageTitle?: string;
  imageCredit?: string;
  imageCreator?: string;
  imageLicense?: string;
  imageProvider?: string;
};

export type StockPhotoHit = {
  stockImage: string;
  imageTitle: string;
  imageCredit: string;
  imageCreator: string;
  imageLicense: string;
  imageProvider: string;
  imageSourceUrl: string;
};

export type LocalMediaCandidate = {
  id?: string;
  src: string;
  alt?: string;
  caption?: string;
  credit?: string;
  license?: string;
  keywords?: string[];
  institution?: string;
  campus?: string;
  title?: string;
  width?: number;
  height?: number;
  usages?: string[];
};

type StockPhotoLib = {
  findStockPhoto: (item: StockArticleItem) => Promise<StockPhotoHit | null>;
  scoreCandidate: (hit: Record<string, unknown>, matchTokens: unknown, context?: unknown) => number;
  buildMatchTokens: (item: StockArticleItem) => unknown;
  detectEditorialContext: (item: StockArticleItem) => unknown;
  extractSearchQueries: (item: StockArticleItem, context?: unknown) => string[];
  scoreStockFit: (item: StockArticleItem, stockUrl?: string, meta?: Record<string, unknown>) => number;
  stockStillFits: (item: StockArticleItem, meta?: Record<string, unknown>) => boolean;
  STOCK_MIN_RETAIN_SCORE: number;
  formatAttribution: (hit: Record<string, unknown>) => string;
  cleanCreatorName: (raw?: string) => string;
};

export const STOCK_MIN_RETAIN_SCORE: number = stock.STOCK_MIN_RETAIN_SCORE;

export function buildMatchTokens(item: StockArticleItem) {
  return stock.buildMatchTokens(item);
}

export function detectEditorialContext(item: StockArticleItem) {
  return stock.detectEditorialContext(item);
}

export function extractSearchQueries(item: StockArticleItem) {
  return stock.extractSearchQueries(item, stock.detectEditorialContext(item));
}

export function scoreStockFit(
  item: StockArticleItem,
  stockUrl = '',
  meta: Record<string, unknown> = {},
): number {
  return stock.scoreStockFit(item, stockUrl, meta);
}

export function stockStillFits(item: StockArticleItem, meta: Record<string, unknown> = {}): boolean {
  return stock.stockStillFits(item, meta);
}

/** Recherche Openverse + Commons — meilleure photo libre pour l’article. */
export async function findStockPhoto(item: StockArticleItem): Promise<StockPhotoHit | null> {
  return stock.findStockPhoto(item);
}

/**
 * Classe une banque locale (manifest démo) selon le même scoring thématique
 * que LE-RADAR. Utile hors-ligne et pour l’admin « Suggérer ».
 */
export function rankLocalMedia(
  item: StockArticleItem,
  media: LocalMediaCandidate[],
  opts: { usage?: string; minScore?: number; limit?: number } = {},
): Array<LocalMediaCandidate & { score: number }> {
  const minScore = opts.minScore ?? 40;
  const limit = opts.limit ?? 12;
  const usage = opts.usage;
  const context = stock.detectEditorialContext(item);
  const matchTokens = stock.buildMatchTokens(item);

  const ranked: Array<LocalMediaCandidate & { score: number }> = [];
  for (const m of media) {
    if (usage && m.usages?.length && !m.usages.includes(usage)) continue;
    const hit = {
      url: m.src,
      width: m.width || 1280,
      height: m.height || 720,
      title: m.title || m.alt || m.caption || pathBasename(m.src),
      tags: [...(m.keywords || []), m.institution, m.campus, m.credit].filter(Boolean).join(' '),
      provider: 'local-bank',
      license: m.license || '',
      creator: m.credit || '',
    };
    const score = stock.scoreCandidate(hit, matchTokens, context);
    if (score >= minScore) ranked.push({ ...m, score });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}

function pathBasename(src: string): string {
  const part = String(src).split('/').pop() || src;
  return part.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
}

/** Construit un item article à scorer depuis les champs éditoriaux Kiosque. */
export function articleToStockItem(article: {
  title?: string;
  excerpt?: string;
  body?: { raw?: string } | string;
  institution?: string;
  region?: string;
}): StockArticleItem {
  const bodyRaw =
    typeof article.body === 'string'
      ? article.body
      : article.body?.raw || '';
  // Corps markdown/HTML tronqué pour le scoring (comme un extrait RSS).
  const plain = String(bodyRaw)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);
  return {
    title: article.title || '',
    excerpt: article.excerpt || '',
    leadExcerpt: plain.slice(0, 400),
    body: plain,
    institution: article.institution || '',
    region: article.region || 'Québec',
  };
}
