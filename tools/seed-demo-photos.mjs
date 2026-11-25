#!/usr/bin/env node
/**
 * Télécharge des photos libres (Wikimedia Commons) pour la démo Le Quorum.
 * - Pas d'API de recherche (évite les 429) : titres de fichiers connus.
 * - Pertinence éditoriale d’abord (sujet de l’article, adultes cégep/uni, contemporain).
 * - Préférer le Québec quand l’image est bonne (RTC, cégep, campus, BAnQ…).
 * - Éviter : écoliers, archives historiques hors sujet, cérémonies militaires.
 * - Stockage local versionné sous examples/demo-journal/media/demo-library/
 * - Met à jour manifest.json + article-photo-map.json
 *
 * Usage:
 *   node tools/seed-demo-photos.mjs
 *   node tools/seed-demo-photos.mjs --force
 *   node tools/seed-demo-photos.mjs --force-themes=bus,calme
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
    // Match universitaire (pas un gros plan de ballon de marque).
    file: "Stoney Brook vs. Penn State Women's Soccer.jpg",
    alt: 'Joueuses de soccer universitaire pendant un match',
    credit: 'Noah Riffe',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
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
    // Console réelle, cadrage horizontal, sans affiche.
    file: 'Kol Israel Heleni Hamalka DSC0094.jpg',
    alt: 'Console et micro d’un studio de radio',
    credit: 'Arielinson',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  'campus-vie': {
    // Portrait étudiant contemporain (adultes sur campus). Pas d’archives historiques.
    // Mieux qu’un cliché d’ouverture de session UdeM d’époque (B&W, hors sujet santé mentale).
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
    file: '2012 - studying in Howard-Tilton Library New Orleans.jpg',
    alt: 'Étudiantes au travail dans une bibliothèque universitaire',
    credit: 'Tulane Public Relations',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
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
    // Petite salle de projection (sièges + projecteur) — pas une façade abandonnée.
    // L’ancien File:Movie_theater.jpg était en réalité le CineLandia en ruines.
    file: 'Kinolino-Kellerkino 02.jpg',
    alt: 'Petite salle de cinéma avec rangées de sièges rouges et projecteur',
    credit: 'Mr N',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  livres: {
    file: 'Bookshelves.jpg',
    alt: 'Rayons de livres en bibliothèque',
    credit: 'Wikimedia Commons',
    license: 'voir source',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Bookshelves.jpg',
  },
  bus: {
    // Autobus RTC Québec (Nova Bus LFS) — pas un bus hors QC.
    file: 'Québec RTC - Nova Bus LFS.jpg',
    alt: 'Autobus RTC de la Ville de Québec (Nova Bus LFS)',
    credit: 'Wikimedia Commons',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Qu%C3%A9bec_RTC_-_Nova_Bus_LFS.jpg',
  },
  calme: {
    // Grande Bibliothèque (BAnQ, Montréal) — lieu d’étude adulte, Québec.
    file: 'Grande Bibliotheque Quebec Interieur.JPG',
    alt: 'Salle de lecture calme à la Grande Bibliothèque de Montréal',
    credit: 'Wikimedia Commons',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Grande_Bibliotheque_Quebec_Interieur.JPG',
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
  // ── Extension banque (titres Commons vérifiés via API search) ──
  hockey: {
    file: 'Shot on goal during youth hockey tournament at West Edmonton Mall Ice Palace.jpg',
    alt: 'Match de hockey sur glace en aréna',
    credit: 'Wikimedia Commons',
    license: 'voir source',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Shot_on_goal_during_youth_hockey_tournament_at_West_Edmonton_Mall_Ice_Palace.jpg',
  },
  // Corps d’article seulement — distinct du lead hockey.jpg (glace / aréna).
  'hockey-interieur': {
    file: 'Championship floor hockey game 150303-N-GT589-067.jpg',
    alt: 'Match de hockey intérieur (floor hockey) en gymnase',
    credit: 'U.S. Navy photo by Mass Communication Specialist 2nd Class Joshua Scott',
    license: 'Public domain',
    licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/',
  },
  volleyball: {
    file: 'Volleyball match - shakehands before the match.jpg',
    alt: 'Match de volleyball en gymnase',
    credit: 'Wikimedia Commons',
    license: 'voir source',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Volleyball_match_-_shakehands_before_the_match.jpg',
  },
  chess: {
    file: 'Chess game Staunton No. 6 perfil view 8.jpg',
    alt: 'Pièces d’échecs sur un échiquier',
    credit: 'Wikimedia Commons',
    license: 'voir source',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Chess_game_Staunton_No._6_perfil_view_8.jpg',
  },
  blood: {
    // Don de sang clinique (pas une cérémonie militaire).
    file: 'Patient gets blood drawn to be screened as a blood donor.jpg',
    alt: 'Prélèvement sanguin lors d’une collecte de sang',
    credit: 'Wikimedia Commons',
    license: 'Public domain',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Patient_gets_blood_drawn_to_be_screened_as_a_blood_donor.jpg',
  },
  mural: {
    file: 'Montreal Street Art Graffiti (29241125286).jpg',
    alt: 'Street art et murale à Montréal',
    credit: 'Wikimedia Commons',
    license: 'voir source',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Montreal_Street_Art_Graffiti_(29241125286).jpg',
  },
  tutoring: {
    // Atelier / cours au Cégep du Vieux Montréal (cohortes collégiales).
    file: 'Formation condensée à Wikipédia lors du cours IPMSH du Cégep du Vieux Montréal.jpg',
    alt: 'Étudiantes et étudiants en atelier de tutorat au cégep',
    credit: 'Wikimedia Commons',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Formation_condens%C3%A9e_%C3%A0_Wikip%C3%A9dia_lors_du_cours_IPMSH_du_C%C3%A9gep_du_Vieux_Montr%C3%A9al.jpg',
  },
  resume: {
    file: 'What to Expect at a Job Interview at a Teaching School.jpg',
    alt: 'Entretien d’embauche ou atelier candidature',
    credit: 'Wikimedia Commons',
    license: 'voir source',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:What_to_Expect_at_a_Job_Interview_at_a_Teaching_School.jpg',
  },
  nursing: {
    file: 'Checking blood pressure.jpg',
    alt: 'Prise de tension artérielle en clinique-école',
    credit: 'Wikimedia Commons',
    license: 'voir source',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Checking_blood_pressure.jpg',
  },
  career: {
    file: 'Exhibitors at the Career Fair (30983205220).jpg',
    alt: 'Salon de l’emploi ou forum d’orientation',
    credit: 'Wikimedia Commons',
    license: 'voir source',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Exhibitors_at_the_Career_Fair_(30983205220).jpg',
  },
  stage: {
    // Événement culturel étudiant — Cégep du Vieux Montréal.
    file: 'Le chant des cageux, Cégép du Vieux Montréal, 2020. (49623021442).jpg',
    alt: 'Scène et public lors d’un spectacle étudiant au cégep',
    credit: 'Wikimedia Commons',
    license: 'CC BY 2.0',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Le_chant_des_cageux,_C%C3%A9g%C3%A9p_du_Vieux_Montr%C3%A9al,_2020._(49623021442).jpg',
  },
  trail: {
    // Nature / orientation — parc du Mont-Royal (Montréal).
    file: 'Parc du Mont-Royal 015.jpg',
    alt: 'Sentier et sous-bois du parc du Mont-Royal à Montréal',
    credit: 'Wikimedia Commons',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Parc_du_Mont-Royal_015.jpg',
  },
  graduation: {
    // Finissants contemporains en toge (pas d’archives B&W des années 70).
    file: 'Imperial College London graduation gowns.jpg',
    alt: 'Finissantes et finissants en toge lors d’une cérémonie de diplomation',
    credit: 'Wikimedia Commons',
    license: 'CC BY 4.0',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Imperial_College_London_graduation_gowns.jpg',
  },
  participatory: {
    // Amphithéâtre / assemblée — Cégep Sainte-Foy (intérieur campus collégial).
    file: 'Cégep de Sainte-Foy (intérieur).JPG',
    alt: 'Hall et espaces communs d’un campus collégial québécois',
    credit: 'Wikimedia Commons',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:C%C3%A9gep_de_Sainte-Foy_(int%C3%A9rieur).JPG',
  },
  'photo-club': {
    // Street art montréalais (expo / culture visuelle étudiante).
    file: 'Montreal Street Art Graffiti (29241125286).jpg',
    alt: 'Murale et art urbain à Montréal',
    credit: 'Wikimedia Commons',
    license: 'voir source',
    licenseUrl: 'https://commons.wikimedia.org/wiki/File:Montreal_Street_Art_Graffiti_(29241125286).jpg',
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
  // Nouveaux / auparavant sans photo dédiée
  'entrainement-hockey-interieur': 'hockey',
  'match-intercegep-volley': 'volleyball',
  'tournoi-echecs-campus': 'chess',
  'collecte-sang-campus': 'blood',
  'projet-murales-corridor': 'mural',
  'aide-devoirs-pair': 'tutoring',
  'atelier-cv-emploi': 'resume',
  'clinic-soins-infirmiers': 'nursing',
  'forum-orientation-programmes': 'career',
  'scene-libre-vendredi': 'stage',
  'course-orientation-bois': 'trail',
  'rencontre-alumni-redaction': 'graduation',
  'budget-participatif-agee': 'participatory',
  'club-photo-exposition': 'photo-club',
  'cine-club-classiques': 'cinema',
  'chronique-podcasts-etudiants': 'radio',
  'editorial-bibliotheque-silence': 'calme',
  'journee-portes-ouvertes-labos': 'labo',
  'lettre-ouverte-transport': 'bus',
  'opinion-frais-associatifs': 'participatory',
};

/** Mât : Saint-Louis-du-Ha! Ha! et le Témiscouata. Pas de campus réel. */
const MASTHEAD = [
  {
    id: 'mast-lac-temiscouata',
    local: 'lac-temiscouata.jpg',
    file: 'Lac Témiscouata.jpg',
    alt: 'Le lac Témiscouata sous un ciel chargé',
    caption: 'Le lac Témiscouata.',
    credit: 'Amqui',
    creditUrl: 'https://commons.wikimedia.org/wiki/User:Amqui',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    keywords: ['lac', 'Témiscouata', 'extérieur'],
    focalPoint: { x: 50, y: 38 },
  },
  {
    id: 'mast-fort-ingall',
    local: 'fort-ingall-aerien.jpg',
    file: 'Fort Ingall - Aerial view 08-2025 (01).jpg',
    alt: 'Le fort Ingall et le lac Témiscouata, vus du ciel',
    caption: 'Le fort Ingall et le lac Témiscouata, à Témiscouata-sur-le-Lac.',
    credit: 'Gabriel Picard',
    creditUrl: 'https://commons.wikimedia.org/wiki/User:Gacard',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    keywords: ['fort Ingall', 'lac', 'Témiscouata-sur-le-Lac'],
    focalPoint: { x: 50, y: 62 },
  },
  {
    id: 'mast-fourneau',
    local: 'montagne-fourneau.jpg',
    file: 'Montagne du Fourneau.JPG',
    alt: 'La montagne du Fourneau au-dessus du lac Témiscouata',
    caption: 'La montagne du Fourneau, vue du fort Ingall à Cabano.',
    credit: 'Fralambert',
    creditUrl: 'https://commons.wikimedia.org/wiki/User:Fralambert',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    keywords: ['montagne du Fourneau', 'Cabano', 'lac'],
    focalPoint: { x: 50, y: 40 },
  },
  {
    id: 'mast-sutherland',
    local: 'cascades-sutherland.jpg',
    file: 'Cascades Sutherland 01.jpg',
    alt: 'Les cascades Sutherland dans la forêt du parc national du Lac-Témiscouata',
    caption: 'Les cascades Sutherland, dans le parc national du Lac-Témiscouata.',
    credit: 'Fralambert',
    creditUrl: 'https://commons.wikimedia.org/wiki/User:Fralambert',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    keywords: ['cascades Sutherland', 'parc national du Lac-Témiscouata'],
    focalPoint: { x: 50, y: 41 },
  },
  {
    id: 'mast-cabano',
    local: 'cabano-aerien.jpg',
    file: 'Cabano - Vue aérienne 08-2025.jpg',
    alt: 'Vue aérienne de Cabano, le long du lac Témiscouata',
    caption: 'Cabano et le lac Témiscouata, à Témiscouata-sur-le-Lac.',
    credit: 'Gabriel Picard',
    creditUrl: 'https://commons.wikimedia.org/wiki/User:Gacard',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    keywords: ['Cabano', 'lac Témiscouata', 'Témiscouata-sur-le-Lac'],
    focalPoint: { x: 50, y: 64 },
  },
  {
    id: 'mast-st-louis-aerien',
    local: 'st-louis-aerien.jpg',
    file: 'Aerial view of Saint-Louis-du-Ha! Ha!, Québec.jpg',
    alt: 'Vue aérienne de Saint-Louis-du-Ha! Ha! en hiver',
    caption: 'Saint-Louis-du-Ha! Ha!.',
    credit: 'Quintin Soloviev',
    creditUrl: 'https://commons.wikimedia.org/wiki/User:Quintin_Soloviev',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    keywords: ['Saint-Louis-du-Ha! Ha!', 'hiver', 'extérieur'],
    focalPoint: { x: 50, y: 28 },
  },
  {
    id: 'mast-touladi',
    local: 'grand-lac-touladi.jpg',
    file: 'Grand lac Touladi 01.jpg',
    alt: 'Le Grand lac Touladi vu à travers les arbres',
    caption: 'Le Grand lac Touladi, dans le parc national du Lac-Témiscouata.',
    credit: 'Fralambert',
    creditUrl: 'https://commons.wikimedia.org/wiki/User:Fralambert',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    keywords: ['Grand lac Touladi', 'parc national du Lac-Témiscouata'],
    focalPoint: { x: 50, y: 60 },
  },
  {
    id: 'mast-st-louis-monument',
    local: 'st-louis-monument.jpg',
    file: 'Church of Saint-Louis-du-Ha!-Ha! - 52048153321.jpg',
    alt: 'Monument de pierre surmonté d’une statue, à Saint-Louis-du-Ha! Ha!',
    caption: 'Saint-Louis-du-Ha! Ha!, devant l’église.',
    credit: 'Judith Bourque',
    creditUrl: 'https://commons.wikimedia.org/wiki/File:Church_of_Saint-Louis-du-Ha!-Ha!_-_52048153321.jpg',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
    keywords: ['Saint-Louis-du-Ha! Ha!', 'monument', 'église'],
    focalPoint: { x: 50, y: 22 },
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

const KNOWN_LICENSES = new Set([
  'CC0', 'CC0 1.0', 'Public domain', 'Public Domain',
  'CC BY 2.0', 'CC BY 2.0 Canada', 'CC BY 2.0 ca', 'CC BY 3.0', 'CC BY 4.0',
  'CC BY-SA 2.0', 'CC BY-SA 2.5', 'CC BY-SA 3.0', 'CC BY-SA 4.0',
  'GFDL', 'GFDL 1.2',
]);

function asHttps(url = '') {
  const u = String(url || '').trim();
  if (!u) return '';
  if (u.startsWith('https://')) return u;
  if (u.startsWith('http://')) return `https://${u.slice(7)}`;
  return '';
}

function normalizeLicenseLabel(raw = '', fallback = 'CC BY-SA 4.0') {
  const s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (KNOWN_LICENSES.has(s)) return s;
  if (/^cc0|public domain|pdm/i.test(s)) return 'CC0';
  if (/by-sa\s*4/i.test(s)) return 'CC BY-SA 4.0';
  if (/by-sa\s*3/i.test(s)) return 'CC BY-SA 3.0';
  if (/by-sa\s*2/i.test(s)) return 'CC BY-SA 2.0';
  if (/^cc\s*by\s*4/i.test(s)) return 'CC BY 4.0';
  if (/^cc\s*by\s*3/i.test(s)) return 'CC BY 3.0';
  if (/^cc\s*by\s*2/i.test(s)) return 'CC BY 2.0';
  if (/gfdl/i.test(s)) return 'GFDL 1.2';
  // Licences nationales (GODL-India, etc.) : retomber sur le libellé seed.
  if (fallback && KNOWN_LICENSES.has(fallback)) return fallback;
  return 'CC BY-SA 4.0';
}

async function enrichLicenseFromCommons(fileName, meta) {
  // Best-effort: leave as-is; credits already set. Optional MediaWiki API later.
  if (meta.credit !== 'Wikimedia Commons') {
    return {
      ...meta,
      license: normalizeLicenseLabel(meta.license, meta.license),
      licenseUrl: asHttps(meta.licenseUrl) || sourcePage(fileName),
      creditUrl: asHttps(meta.creditUrl) || sourcePage(fileName),
    };
  }
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
    const licenseRaw = (em.LicenseShortName?.value || meta.license || '').trim();
    const license = normalizeLicenseLabel(licenseRaw, meta.license || 'CC BY-SA 4.0');
    const licenseUrl = asHttps(em.LicenseUrl?.value) || asHttps(meta.licenseUrl) || sourcePage(fileName);
    return {
      ...meta,
      credit: artist || meta.credit,
      creditUrl: asHttps(meta.creditUrl) || sourcePage(fileName),
      license,
      licenseUrl,
      width: ii.width,
      height: ii.height,
    };
  } catch {
    return {
      ...meta,
      license: normalizeLicenseLabel(meta.license, 'CC BY-SA 4.0'),
      licenseUrl: asHttps(meta.licenseUrl) || sourcePage(fileName),
      creditUrl: asHttps(meta.creditUrl) || sourcePage(fileName),
    };
  }
}

async function main() {
  await ensureDir(ART);
  const forceLabo = process.argv.includes('--force-labo');
  const forceAll = process.argv.includes('--force');
  // --force-themes=bus,calme,campus-vie
  const forceArg = process.argv.find((a) => a.startsWith('--force-themes='));
  const forceThemes = new Set(
    forceArg
      ? forceArg.slice('--force-themes='.length).split(',').map((s) => s.trim()).filter(Boolean)
      : [],
  );
  if (forceLabo) forceThemes.add('labo');

  // --- Article themes ---
  const themeAssets = {};
  for (const [theme, meta0] of Object.entries(ARTICLE_THEMES)) {
    const dest = path.join(ART, `${theme}.jpg`);
    const force = forceAll || forceThemes.has(theme);
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
        creditUrl: meta.creditUrl || sourcePage(meta0.file),
        license: meta.license,
        licenseUrl: meta.licenseUrl || sourcePage(meta0.file),
        width: size.width || meta.width || WIDTH,
        height: size.height || meta.height || Math.round(WIDTH * 0.66),
        mime: 'image/jpeg',
        checksum,
        focalPoint: { x: 50, y: 48 },
        keywords: [theme, ...(meta.alt || '').toLowerCase().split(/\s+/).filter((w) => w.length > 3).slice(0, 8)],
        usages: ['article'],
        // Scènes thématiques : pas d’établissement (avertissement OK dans validate).
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
        creditUrl: asHttps(m.creditUrl) || sourcePage(m.file),
        license: normalizeLicenseLabel(m.license, m.license),
        licenseUrl: asHttps(m.licenseUrl) || sourcePage(m.file),
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
