#!/usr/bin/env node
/**
 * Portraits fictifs pour l’équipe de démonstration (randomuser.me).
 * Fichiers locaux versionnés ; métadonnées avatar dans content/auteurs/*.md.
 *
 * Usage: node tools/seed-author-portraits.mjs
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEMO = path.join(ROOT, 'examples/demo-journal');
const OUT = path.join(DEMO, 'media/demo-library/auteurs');
const AUTHORS = path.join(DEMO, 'content/auteurs');
const UA =
  'Le-Kiosque-DemoBot/1.0 (student media demo; https://github.com/azdak919/le-kiosque)';

/**
 * Portraits stables randomuser.me (personnages fictifs, usage démo).
 * Genre aligné sur le prénom pour un rendu crédible.
 */
const PORTRAITS = {
  'marie-tremblay': { gender: 'women', id: 44 },
  'amira-benali': { gender: 'women', id: 68 },
  'jade-morin': { gender: 'women', id: 21 },
  'leonie-gagnon': { gender: 'women', id: 33 },
  'camille-dufour': { gender: 'women', id: 12 },
  'thomas-chen': { gender: 'men', id: 32 },
  'samuel-okonkwo': { gender: 'men', id: 75 },
  'olivier-roy': { gender: 'men', id: 52 },
  'philippe-lavoie': { gender: 'men', id: 18 },
  'nicolas-petit': { gender: 'men', id: 41 },
};

function portraitUrl(gender, id) {
  return `https://randomuser.me/api/portraits/${gender}/${id}.jpg`;
}

async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return { width: 0, height: 0 };
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker === 0xc0 || marker === 0xc2) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2;
      continue;
    }
    const len = buf.readUInt16BE(i + 2);
    i += 2 + len;
  }
  return { width: 0, height: 0 };
}

async function patchAuthorMd(slug, avatarBlock) {
  const file = path.join(AUTHORS, `${slug}.md`);
  let text = await fs.readFile(file, 'utf8');
  if (!text.startsWith('---')) throw new Error(`pas de front-matter: ${slug}`);
  const end = text.indexOf('\n---', 3);
  if (end < 0) throw new Error(`front-matter non fermé: ${slug}`);
  let fm = text.slice(4, end);
  const body = text.slice(end + 4);
  // Retirer un ancien bloc avatar (simple ou multiligne indenté)
  fm = fm.replace(/\navatar:[\s\S]*?(?=\n[a-zA-Z]|\n*$)/, '');
  fm = fm.replace(/\navatar:\s*.+\n?/, '');
  if (!fm.endsWith('\n')) fm += '\n';
  fm += avatarBlock;
  if (!fm.endsWith('\n')) fm += '\n';
  await fs.writeFile(file, `---\n${fm}---${body.startsWith('\n') ? body : `\n${body}`}`);
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  for (const [slug, { gender, id }] of Object.entries(PORTRAITS)) {
    const dest = path.join(OUT, `${slug}.jpg`);
    const url = portraitUrl(gender, id);
    console.log(`  ${slug} ← ${url}`);
    let buf;
    try {
      const st = await fs.stat(dest);
      if (st.size > 5_000) {
        buf = await fs.readFile(dest);
        console.log(`    skip existant (${st.size} o)`);
      }
    } catch {
      /* missing */
    }
    if (!buf) {
      buf = await fetchBuffer(url);
      await fs.writeFile(dest, buf);
      await new Promise((r) => setTimeout(r, 400));
    }
    const size = jpegSize(buf);
    const checksum = crypto.createHash('sha256').update(buf).digest('hex');
    const nameMatch = (await fs.readFile(path.join(AUTHORS, `${slug}.md`), 'utf8')).match(
      /^name:\s*(.+)$/m,
    );
    const name = nameMatch?.[1]?.trim() || slug;
    const avatarBlock = [
      'avatar:',
      `  src: /media/demo-library/auteurs/${slug}.jpg`,
      `  alt: "Portrait fictif de ${name.replace(/"/g, '')}"`,
      '  credit: "randomuser.me (personnage fictif)"',
      '  creditUrl: "https://randomuser.me/"',
      '  license: "CC0"',
      '  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/"',
      `  sourceUrl: "${url}"`,
      `  width: ${size.width || 128}`,
      `  height: ${size.height || 128}`,
      '  focalPoint: { x: 50, y: 35 }',
      `  checksum: ${checksum}`,
    ].join('\n');
    await patchAuthorMd(slug, `${avatarBlock}\n`);
    console.log(`    → ${size.width}x${size.height}`);
  }
  console.log(`\nOK ${Object.keys(PORTRAITS).length} portraits`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
