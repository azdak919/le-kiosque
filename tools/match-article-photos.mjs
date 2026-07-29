#!/usr/bin/env node
/**
 * Teste l’algo LE-RADAR (stock-photo) sur les articles de la démo Quorum.
 *
 * Modes :
 *   node tools/match-article-photos.mjs              # banque locale seulement
 *   node tools/match-article-photos.mjs --live        # + Openverse/Commons
 *   node tools/match-article-photos.mjs --apply       # écrit les lead dans les .md
 *   node tools/match-article-photos.mjs --limit 5
 *
 * --apply n’écrit que si une suggestion locale (map/thème) ou un score local
 * ≥ 60 est trouvé ; --live n’applique pas d’URL distantes (télécharger d’abord
 * via seed-demo-photos).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  articleToStockItem,
  extractSearchQueries,
  findStockPhoto,
  rankLocalMedia,
  STOCK_MIN_RETAIN_SCORE,
} from '../packages/stock-photo/src/index.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEMO = path.join(ROOT, 'examples/demo-journal');
const ARTICLES = path.join(DEMO, 'content/articles');
const MANIFEST = path.join(DEMO, 'media/demo-library/manifest.json');
const PHOTO_MAP = path.join(DEMO, 'media/demo-library/article-photo-map.json');

const live = process.argv.includes('--live');
const apply = process.argv.includes('--apply');
const limitArg = process.argv.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Number(process.argv[process.argv.indexOf('--limit') + 1]) || Infinity;

function parseFrontMatter(text) {
  if (!text.startsWith('---')) return { data: {}, body: text };
  const end = text.indexOf('\n---', 3);
  if (end < 0) return { data: {}, body: text };
  const raw = text.slice(4, end);
  const body = text.slice(end + 4).replace(/^\n/, '');
  const data = {};
  // Champs simples (pas un parseur YAML complet — assez pour la démo).
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Za-z][\w]*):\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    data[m[1]] = val;
  }
  // Bloc lead indenté
  const leadMatch = raw.match(/^lead:\n((?:  .*\n?)*)/m);
  if (leadMatch) {
    data.lead = {};
    for (const line of leadMatch[1].split('\n')) {
      const lm = line.match(/^  (\w+):\s*(.+)$/);
      if (!lm) continue;
      let v = lm[2].trim().replace(/^["']|["']$/g, '');
      data.lead[lm[1]] = v;
    }
  }
  // Excerpt multi-ligne
  const ex = raw.match(/^excerpt:\s*>-?\n((?:  .*\n?)*)/m);
  if (ex) {
    data.excerpt = ex[1]
      .split('\n')
      .map((l) => l.replace(/^  /, ''))
      .join(' ')
      .trim();
  }
  return { data, body, rawFm: raw, full: text, end };
}

async function walkMd(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walkMd(full)));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function formatLeadBlock(asset) {
  const lines = [
    'lead:',
    `  src: ${asset.src}`,
    `  alt: ${JSON.stringify(asset.alt || '')}`,
    `  credit: ${JSON.stringify(asset.credit || '')}`,
  ];
  if (asset.license) lines.push(`  license: ${asset.license}`);
  if (asset.licenseUrl) lines.push(`  licenseUrl: ${asset.licenseUrl}`);
  if (asset.sourceUrl) lines.push(`  sourceUrl: ${asset.sourceUrl}`);
  if (asset.width) lines.push(`  width: ${asset.width}`);
  if (asset.height) lines.push(`  height: ${asset.height}`);
  const fx = asset.focalPoint?.x ?? 50;
  const fy = asset.focalPoint?.y ?? 48;
  lines.push(`  focalPoint: { x: ${fx}, y: ${fy} }`);
  return lines.join('\n');
}

function replaceLeadInFrontMatter(fullText, leadBlock) {
  if (/^lead:\n(?:  .*\n)*/m.test(fullText)) {
    return fullText.replace(/^lead:\n(?:  .*\n)*/m, `${leadBlock}\n`);
  }
  // Insérer avant excerpt ou avant --- de fin
  return fullText.replace(
    /\n(excerpt:|---\n)/,
    `\n${leadBlock}\n$1`,
  );
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
  const media = manifest.media || [];
  const photoMap = JSON.parse(await fs.readFile(PHOTO_MAP, 'utf8').catch(() => '{}'));
  const files = (await walkMd(ARTICLES)).sort();
  let n = 0;
  const report = [];

  console.log(`Banque locale : ${media.length} médias | Articles : ${files.length}`);
  console.log(`Mode : local${live ? ' + live Openverse/Commons' : ''}${apply ? ' + apply' : ''}\n`);

  for (const file of files) {
    if (n >= limit) break;
    const text = await fs.readFile(file, 'utf8');
    const { data, body } = parseFrontMatter(text);
    if (data.status === 'draft') continue;
    n += 1;
    const slug = data.slug || path.basename(file, '.md');
    const item = articleToStockItem({
      title: data.title,
      excerpt: data.excerpt,
      body,
      institution: 'Cégep de démonstration',
      region: 'Québec',
    });
    const queries = extractSearchQueries(item).slice(0, 4);
    const local = rankLocalMedia(item, media, { usage: 'article', minScore: 40, limit: 3 });
    const mapped = photoMap[slug];

    let liveHit = null;
    if (live) {
      process.stdout.write(`  live ${slug}… `);
      try {
        liveHit = await findStockPhoto(item);
        console.log(liveHit ? `OK score≥${STOCK_MIN_RETAIN_SCORE} ${liveHit.imageProvider}` : 'aucun');
      } catch (err) {
        console.log(`err ${err.message}`);
      }
    }

    const bestLocal = local[0];
    const row = {
      slug,
      title: data.title,
      status: data.status,
      queries,
      localTop: bestLocal
        ? { src: bestLocal.src, score: Math.round(bestLocal.score), alt: bestLocal.alt }
        : null,
      mapped: mapped?.src || null,
      live: liveHit
        ? { url: liveHit.stockImage, provider: liveHit.imageProvider, credit: liveHit.imageCredit }
        : null,
    };
    report.push(row);

    const mark = bestLocal ? `local=${Math.round(bestLocal.score)}` : 'local=—';
    const mapMark = mapped ? 'map=oui' : 'map=non';
    console.log(
      `• ${slug}\n  ${data.title?.slice(0, 70)}\n  ${mark} ${mapMark}` +
        (bestLocal ? `\n  → ${bestLocal.src} (${bestLocal.alt || ''})` : '') +
        (queries[0] ? `\n  q: ${queries.slice(0, 2).join(' | ')}` : ''),
    );

    if (apply && mapped) {
      const leadBlock = formatLeadBlock(mapped);
      const next = replaceLeadInFrontMatter(text, leadBlock);
      if (next !== text) {
        await fs.writeFile(file, next);
        console.log('  ✓ lead appliqué (article-photo-map)');
      }
    } else if (apply && bestLocal && bestLocal.score >= 60) {
      const leadBlock = formatLeadBlock(bestLocal);
      const next = replaceLeadInFrontMatter(text, leadBlock);
      if (next !== text) {
        await fs.writeFile(file, next);
        console.log(`  ✓ lead appliqué (score local ${Math.round(bestLocal.score)})`);
      }
    }
  }

  const withLocal = report.filter((r) => r.localTop).length;
  const withMap = report.filter((r) => r.mapped).length;
  const withLive = report.filter((r) => r.live).length;
  console.log(
    `\nRésumé : ${report.length} articles | map=${withMap} | suggestion locale=${withLocal}` +
      (live ? ` | live=${withLive}` : ''),
  );

  const outPath = path.join(DEMO, 'media/demo-library/match-report.json');
  await fs.writeFile(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), live, report }, null, 2) + '\n');
  console.log(`Rapport : ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
