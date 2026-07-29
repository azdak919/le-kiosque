#!/usr/bin/env node
/**
 * Télécharge des photos libres (Wikimedia Commons) pour la démo Le Quorum.
 * - Pas d'API de recherche (évite les 429) : titres de fichiers connus.
 * - Stockage local versionné sous examples/demo-journal/media/demo-library/
 * - Met à jour manifest.json + article-photo-map.json
 *
 * Usage: node tools/seed-demo-photos.mjs
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DEMO = path.join(ROOT, 'examples/demo-journal');
const LIB = path.join(DEMO, 'media/demo-library');
const ART = path.join(LIB, 'articles');
const UA =
  'Le-Kiosque-DemoBot/1.0 (student media demo; https://github.com/azdak919/le-kiosque; contact: redaction@journal-exemple.invalid)';
const WIDTH = 1920;
const DELAY_MS = 1800;

/** Thèmes article : fichier Commons + métadonnées éditoriales. */
const ARTICLE_THEMES = {
  soccer: {
    file: 'Adidas soccer ball on a grass pitch (Unsplash).jpg',
    alt: 'Ballon de soccer sur un terrain en herbe',
    credit: 'Peter Glaser baraida',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
  },
  basketball: {
    file: '2016 Auburn at Alabama NCAAM Basketball Game.jpg',
    alt: 'Match de basketball en gymnase',
    credit: 'Bama in ATL',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  course: {
    file: '2018 Orizaba Running race 01.jpg',
    alt: 'Course à pied en nature',
    credit: 'Isaacvp',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  serre: {
    file: 'Estufa principal do Jardim Botânico de Curitiba 02.jpg',
    alt: 'Serre pédagogique avec des plants',
    credit: 'Rodrigo.Argenton',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  labo: {
    file: 'Chemistry laboratory.jpg',
    alt: 'Laboratoire de chimie moderne',
    credit: 'Horia Varlan',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
  },
  radio: {
    file: 'Broadcast Studio (53998133689).jpg',
    alt: 'Studio de radio avec microphones',
    credit: 'Ethan Long',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
  },
  'campus-vie': {
    file: 'Students enjoy springtime weather. (5554288570).jpg',
    alt: 'Étudiantes et étudiants sur un campus au printemps',
    credit: 'Tulane Public Relations',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
  },
  velo: {
    file: 'Bike repair station.jpg',
    alt: 'Station de réparation de vélos',
    credit: 'Wikimedia Commons',
    license: 'voir source',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Bike_repair_station.jpg',
  },
  compost: {
    file: 'Compost_bin.jpg',
    alt: 'Bac de compost et matières organiques',
    credit: 'Wikimedia Commons',
    license: 'voir source',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Compost_bin.jpg',
  },
  'biblio-pc': {
    file: 'Library computers.jpg',
    alt: 'Ordinateurs en bibliothèque',
    credit: 'Wikimedia Commons',
    license: 'voir source',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Library_computers.jpg',
  },
  amphi: {
    file: 'Lecture hall.jpg',
    alt: 'Amphithéâtre universitaire rempli',
    credit: 'Wikimedia Commons',
    license: 'voir source',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Lecture_hall.jpg',
  },
  caf: {
    file: 'Cafeteria.jpg',
    alt: 'Cafétéria ou salle à manger collective',
    credit: 'Wikimedia Commons',
    license: 'voir source',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Cafeteria.jpg',
  },
  cinema: {
    file: 'Movie theater.jpg',
    alt: 'Salle de cinéma vue depuis les sièges',
    credit: 'Wikimedia Commons',
    license: 'voir source',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Movie_theater.jpg',
  },
  livres: {
    file: 'Bookshelves.jpg',
    alt: 'Rayons de livres en bibliothèque',
    credit: 'Wikimedia Commons',
    license: 'voir source',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Bookshelves.jpg',
  },
  bus: {
    file: 'Bus.jpg',
    alt: 'Autobus de transport collectif',
    credit: 'Wikimedia Commons',
    license: 'voir source',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Bus.jpg',
  },
  calme: {
    file: 'Students_studying.jpg',
    alt: 'Étudiantes et étudiants en zone d’étude calme',
    credit: 'Wikimedia Commons',
    license: 'voir source',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Students_studying.jpg',
  },
  arts: {
    file: 'Art_exhibition.jpg',
    alt: 'Exposition d’art dans une galerie',
    credit: 'Wikimedia Commons',
    license: 'voir source',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Art_exhibition.jpg',
  },
  parking: {
    file: 'Bicycle_parking.jpg',
    alt: 'Stationnement pour vélos sur un campus',
    credit: 'Wikimedia Commons',
    license: 'voir source',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Bicycle_parking.jpg',
  },
};

/** Slug article → thème */
const ARTICLE_MAP = {
  'tournoi-soccer-interprogramme': 'soccer',
  'basketball-equipe-recrues': 'basketball',
  'course-cross-country': 'course',
  'serre-pedagogique-campus': 'serre',
  'laboratoire-sciences-ouvert': 'labo',
  'radio-campus-cinquante-ans': 'radio',
  'balado-histoire-campus': 'radio',
  'veille-sante-mentale': 'campus-vie',
  'atelier-reparation-velos': 'velo',
  'brigade-compost-campus': 'compost',
  'pret-ordinateurs-bibliotheque': 'biblio-pc',
  'sondage-horaires-bibliotheque': 'livres',
  'assemblee-generale-reconduction': 'amphi',
  'cafeteria-menu-vegetal': 'caf',
  'chronique-cinema-midi': 'cinema',
  'club-lecture-rentree': 'livres',
  'editorial-espaces-calmes': 'calme',
  'exposition-finissants-arts': 'arts',
  'transport-collectif-editorial': 'bus',
  'debat-frais-stationnement': 'parking',
};

/** Masthead : photos campus QC (banque LE-RADAR + cégeps déjà en place). */
const MASTHEAD = [
  {
    id: 'mast-sainte-foy',
    local: 'campus-sainte-foy.jpg',
    file: 'Campus du Cégep de Sainte-Foy01.JPG',
    alt: 'Vue extérieure du campus du Cégep de Sainte-Foy à Québec',
    caption: 'Campus du Cégep de Sainte-Foy, à Québec.',
    credit: 'Khayman',
    creditUrl: 'https://commons.wikimedia.org/wiki/User:Khayman',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    institution: 'Cégep de Sainte-Foy',
    campus: 'Sainte-Foy, Québec',
    keywords: ['campus', 'architecture', 'extérieur', 'Québec'],
    focalPoint: { x: 52, y: 48 },
  },
  {
    id: 'mast-interieur-sf',
    local: 'interieur-sainte-foy.jpg',
    file: 'Cégep de Sainte-Foy (intérieur).JPG',
    alt: 'Espace intérieur du Cégep de Sainte-Foy à Québec',
    caption: 'Intérieur du Cégep de Sainte-Foy, à Québec.',
    credit: 'Khayman',
    creditUrl: 'https://commons.wikimedia.org/wiki/User:Khayman',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    institution: 'Cégep de Sainte-Foy',
    campus: 'Sainte-Foy, Québec',
    keywords: ['campus', 'intérieur', 'aire commune', 'Québec'],
    focalPoint: { x: 50, y: 45 },
  },
  {
    id: 'mast-jonquiere',
    local: 'batiment-jonquiere.jpg',
    file: 'Bâtiment du Cégep de Jonquière.JPG',
    alt: 'Bâtiment du Cégep de Jonquière vu de l’extérieur',
    caption: 'Bâtiment du Cégep de Jonquière.',
    credit: 'Khayman',
    creditUrl: 'https://commons.wikimedia.org/wiki/User:Khayman',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    institution: 'Cégep de Jonquière',
    campus: 'Jonquière',
    keywords: ['campus', 'bâtiment', 'extérieur', 'Saguenay'],
    focalPoint: { x: 50, y: 51 },
  },
  {
    id: 'mast-football-jonq',
    local: 'football-jonquiere.jpg',
    file: 'Terrain de football du Cégep de Jonquière.JPG',
    alt: 'Terrain de football du Cégep de Jonquière',
    caption: 'Terrain de football du Cégep de Jonquière.',
    credit: 'Khayman',
    creditUrl: 'https://commons.wikimedia.org/wiki/User:Khayman',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    institution: 'Cégep de Jonquière',
    campus: 'Jonquière',
    keywords: ['sport', 'terrain', 'extérieur'],
    focalPoint: { x: 48, y: 59 },
  },
  {
    id: 'mast-limoilou',
    local: 'campus-limoilou.jpg',
    file: 'Campus de Québec.jpg',
    alt: 'Campus collégial à Québec',
    caption: 'Campus collégial à Québec — illustration de démonstration uniquement.',
    credit: 'Pierre-Paul Beaumont',
    license: 'CC BY 2.0 ca',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/ca/',
    institution: 'Cégep Limoilou',
    campus: 'Québec',
    keywords: ['campus', 'extérieur'],
    focalPoint: { x: 50, y: 48 },
  },
  {
    id: 'mast-mcgill-gates',
    local: 'mcgill-roddick.jpg',
    file: 'Roddick Gates (McGill University) 2005-09-02.jpg',
    alt: 'Portails Roddick de l’Université McGill à Montréal',
    caption: 'Campus McGill (Montréal) — illustration de démonstration uniquement.',
    credit: 'Gene.arboit',
    creditUrl: 'https://commons.wikimedia.org/wiki/User:Gene.arboit',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    institution: 'Université McGill',
    campus: 'Montréal',
    keywords: ['campus', 'architecture', 'Montréal'],
    focalPoint: { x: 50, y: 45 },
  },
  {
    id: 'mast-uqam',
    local: 'uqam-jasmin.jpg',
    file: 'Pavillon Judith-Jasmin UQAM 1.jpg',
    alt: 'Pavillon Judith-Jasmin de l’UQAM à Montréal',
    caption: 'UQAM (Montréal) — illustration de démonstration uniquement.',
    credit: 'Great11',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    institution: 'UQAM',
    campus: 'Montréal',
    keywords: ['campus', 'architecture', 'Montréal'],
    focalPoint: { x: 50, y: 40 },
  },
  {
    id: 'mast-laval',
    local: 'ulaval-campus.jpg',
    file: 'Université Laval, Quebec, Canada 02.jpg',
    alt: 'Campus de l’Université Laval à Québec',
    caption: 'Université Laval (Québec) — illustration de démonstration uniquement.',
    credit: 'Wilfredor',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    institution: 'Université Laval',
    campus: 'Québec',
    keywords: ['campus', 'extérieur', 'Québec'],
    focalPoint: { x: 50, y: 52 },
  },
  {
    id: 'mast-laval-park',
    local: 'ulaval-parc.jpg',
    file: 'Park in Université Laval.jpg',
    alt: 'Parc sur le campus de l’Université Laval',
    caption: 'Université Laval (Québec) — illustration de démonstration uniquement.',
    credit: 'Wilfredor',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    institution: 'Université Laval',
    campus: 'Québec',
    keywords: ['campus', 'parc', 'extérieur'],
    focalPoint: { x: 50, y: 48 },
  },
  {
    id: 'mast-concordia',
    local: 'concordia-hall.jpg',
    file: 'Henry F. Hall Building 07.JPG',
    alt: 'Édifice Henry F. Hall de l’Université Concordia',
    caption: 'Concordia (Montréal) — illustration de démonstration uniquement.',
    credit: 'Jeangagnon',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    institution: 'Université Concordia',
    campus: 'Montréal',
    keywords: ['campus', 'architecture', 'Montréal'],
    focalPoint: { x: 50, y: 42 },
  },
  {
    id: 'mast-udem',
    local: 'udem-gaudry.jpg',
    file: 'Pavillon Roger-Gaudry II.jpg',
    alt: 'Pavillon Roger-Gaudry de l’Université de Montréal',
    caption: 'Université de Montréal — illustration de démonstration uniquement.',
    credit: 'Funke',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    institution: 'Université de Montréal',
    campus: 'Montréal',
    keywords: ['campus', 'architecture', 'Montréal'],
    focalPoint: { x: 50, y: 40 },
  },
  {
    id: 'mast-bishops',
    local: 'bishops-campus.jpg',
    file: "Bishop's University campus 2011.jpg",
    alt: 'Campus de Bishop’s University',
    caption: 'Bishop’s University — illustration de démonstration uniquement.',
    credit: 'Balcer',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
    institution: "Bishop's University",
    campus: 'Sherbrooke',
    keywords: ['campus', 'extérieur'],
    focalPoint: { x: 50, y: 48 },
  },
  {
    id: 'mast-mcgill-campus',
    local: 'mcgill-campus.jpg',
    file: 'McGill University downtown campus 31.JPG',
    alt: 'Campus centre-ville de l’Université McGill',
    caption: 'McGill (Montréal) — illustration de démonstration uniquement.',
    credit: 'Jeangagnon',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    institution: 'Université McGill',
    campus: 'Montréal',
    keywords: ['campus', 'extérieur', 'Montréal'],
    focalPoint: { x: 50, y: 45 },
  },
  {
    id: 'mast-sherbrooke-longueuil',
    local: 'sherbrooke-longueuil.jpg',
    file: 'Campus de Longueuil - Universite de Sherbrooke 09.jpg',
    alt: 'Campus de Longueuil de l’Université de Sherbrooke',
    caption: 'Université de Sherbrooke (Longueuil) — illustration de démonstration uniquement.',
    credit: 'Jeangagnon',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    institution: 'Université de Sherbrooke',
    campus: 'Longueuil',
    keywords: ['campus', 'architecture'],
    focalPoint: { x: 50, y: 48 },
  },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function filePathUrl(fileName, width = WIDTH) {
  const enc = encodeURIComponent(fileName.replace(/ /g, '_'));
  // Special:FilePath accepts spaces as underscores
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${enc}?width=${width}`;
}

function sourcePage(fileName) {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fileName.replace(/ /g, '_'))}`;
}

async function fetchBuffer(url, retries = 4) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'image/*,*/*' },
        redirect: 'follow',
      });
      if (res.status === 429) {
        const wait = 15000 * (i + 1);
        console.warn(`  429 rate limit, attente ${wait}ms…`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const ctype = res.headers.get('content-type') || '';
      if (!ctype.includes('image')) throw new Error(`not an image: ${ctype} ${url}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      lastErr = err;
      console.warn(`  essai ${i + 1}/${retries} échoué: ${err.message}`);
      await sleep(3000 * (i + 1));
    }
  }
  throw lastErr;
}

/** JPEG dimensions without full decode (SOF0/SOF2). */
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

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function downloadIfNeeded(dest, fileName, force = false, minWidth = 1600) {
  try {
    if (!force) {
      const st = await fs.stat(dest);
      if (st.size > 20_000) {
        const buf = await fs.readFile(dest);
        const size = jpegSize(buf);
        if (size.width >= minWidth) {
          console.log(`  skip existant ${path.basename(dest)} (${size.width}x${size.height})`);
          return { buf, size, skipped: true };
        }
        console.log(`  re-téléchargement basse résolution ${path.basename(dest)} (${size.width}px < ${minWidth})`);
      }
    }
  } catch {
    /* missing */
  }
  const url = filePathUrl(fileName, WIDTH);
  console.log(`  fetch ${fileName}`);
  const buf = await fetchBuffer(url);
  await fs.writeFile(dest, buf);
  const size = jpegSize(buf);
  console.log(`  → ${path.basename(dest)} ${size.width}x${size.height} (${buf.length} o)`);
  await sleep(DELAY_MS);
  return { buf, size, skipped: false };
}

function uuidFrom(src) {
  const h = crypto.createHash('sha1').update(src).digest('hex');
  // UUID v5-shaped (not a full RFC implementation — stable local ids only)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function enrichLicenseFromCommons(fileName, meta) {
  // Best-effort: leave as-is; credits already set. Optional MediaWiki API later.
  if (meta.credit !== 'Wikimedia Commons') return meta;
  try {
    const api = `https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata|size|url&titles=File:${encodeURIComponent(fileName)}&format=json`;
    const res = await fetch(api, { headers: { 'User-Agent': UA } });
    if (!res.ok) return meta;
    const data = await res.json();
    const page = Object.values(data?.query?.pages || {})[0];
    const ii = page?.imageinfo?.[0];
    if (!ii) return meta;
    const em = ii.extmetadata || {};
    const artist = (em.Artist?.value || '').replace(/<[^>]+>/g, '').trim();
    const license = (em.LicenseShortName?.value || meta.license || '').trim();
    const licenseUrl = em.LicenseUrl?.value || meta.licenseUrl;
    return {
      ...meta,
      credit: artist || meta.credit,
      license: license || meta.license,
      licenseUrl: licenseUrl || meta.licenseUrl,
      width: ii.width,
      height: ii.height,
    };
  } catch {
    return meta;
  }
}

async function main() {
  await ensureDir(ART);
  const forceLabo = process.argv.includes('--force-labo');

  // --- Article themes ---
  const themeAssets = {};
  for (const [theme, meta0] of Object.entries(ARTICLE_THEMES)) {
    const dest = path.join(ART, `${theme}.jpg`);
    const force = forceLabo && theme === 'labo';
    try {
      let meta = await enrichLicenseFromCommons(meta0.file, meta0);
      await sleep(400);
      const { buf, size } = await downloadIfNeeded(dest, meta0.file, force);
      const checksum = crypto.createHash('sha256').update(buf).digest('hex');
      themeAssets[theme] = {
        id: uuidFrom(`article:${theme}`),
        kind: 'image',
        src: `/media/demo-library/articles/${theme}.jpg`,
        remoteSrc: filePathUrl(meta0.file, WIDTH),
        sourceUrl: sourcePage(meta0.file),
        alt: meta.alt,
        caption: meta.alt,
        credit: meta.credit,
        license: meta.license,
        licenseUrl: meta.licenseUrl,
        width: size.width || meta.width || WIDTH,
        height: size.height || meta.height || Math.round(WIDTH * 0.66),
        mime: 'image/jpeg',
        checksum,
        focalPoint: { x: 50, y: 48 },
        keywords: [theme],
        usages: ['article'],
        source: {
          backend: 'wikimedia-commons',
          backendId: `File:${meta0.file}`,
          backendUrl: sourcePage(meta0.file),
          fetchedAt: new Date().toISOString(),
          revision: `${WIDTH}px`,
          license: meta.license,
          originalPublisher: 'Wikimedia Commons',
        },
      };
    } catch (err) {
      console.error(`ÉCHEC thème ${theme}:`, err.message);
    }
  }

  // --- Masthead ---
  const mastAssets = [];
  for (const m of MASTHEAD) {
    const dest = path.join(LIB, m.local);
    try {
      const { buf, size } = await downloadIfNeeded(dest, m.file, false);
      // Skip ultra-wide panoramic (bad for hero crop)
      if (size.width && size.height && size.width / size.height > 2.8) {
        console.warn(`  skip panorama ${m.local}`);
        continue;
      }
      const checksum = crypto.createHash('sha256').update(buf).digest('hex');
      mastAssets.push({
        id: uuidFrom(`mast:${m.local}`),
        kind: 'image',
        src: `/media/demo-library/${m.local}`,
        remoteSrc: filePathUrl(m.file, WIDTH),
        sourceUrl: sourcePage(m.file),
        alt: m.alt,
        caption: m.caption,
        credit: m.credit,
        creditUrl: m.creditUrl,
        license: m.license,
        licenseUrl: m.licenseUrl,
        width: size.width || WIDTH,
        height: size.height || Math.round(WIDTH * 0.66),
        mime: 'image/jpeg',
        checksum,
        focalPoint: m.focalPoint,
        institution: m.institution,
        campus: m.campus,
        keywords: m.keywords,
        usages: ['exterior', 'masthead', 'article'],
        source: {
          backend: 'wikimedia-commons',
          backendId: `File:${m.file}`,
          backendUrl: sourcePage(m.file),
          fetchedAt: new Date().toISOString(),
          revision: `${WIDTH}px`,
          license: m.license,
          originalPublisher: 'Wikimedia Commons',
        },
      });
    } catch (err) {
      console.error(`ÉCHEC masthead ${m.local}:`, err.message);
    }
  }

  // Remove obsolete low-quality rimouski if present (panoramic)
  try {
    await fs.unlink(path.join(LIB, 'cegep-rimouski.jpg'));
  } catch {
    /* ok */
  }

  const media = [...mastAssets, ...Object.values(themeAssets)];
  const manifest = {
    format: 'kiosque-shared-media',
    version: 1,
    notice:
      'Ces campus et scènes réels illustrent uniquement la démonstration. Ils ne représentent pas le Cégep de démonstration fictif ni le journal fictif Le Quorum.',
    media,
  };
  await fs.writeFile(path.join(LIB, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  const articlePhotoMap = {};
  for (const [slug, theme] of Object.entries(ARTICLE_MAP)) {
    const asset = themeAssets[theme];
    if (!asset) {
      console.warn(`pas d'asset pour ${slug} (${theme})`);
      continue;
    }
    articlePhotoMap[slug] = {
      src: asset.src,
      alt: asset.alt,
      credit: asset.credit,
      license: asset.license,
      licenseUrl: asset.licenseUrl,
      sourceUrl: asset.sourceUrl,
      width: asset.width,
      height: asset.height,
      focalPoint: asset.focalPoint,
      theme,
    };
  }
  await fs.writeFile(
    path.join(LIB, 'article-photo-map.json'),
    JSON.stringify(articlePhotoMap, null, 2) + '\n',
  );

  console.log(
    `\nOK assets=${media.length} masthead=${mastAssets.length} themes=${Object.keys(themeAssets).length} articles-map=${Object.keys(articlePhotoMap).length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
