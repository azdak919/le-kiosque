/**
 * LE KIOSQUE — noyau commun de configuration.
 *
 * Une seule source de vérité pour le configurateur web (site/configurer) et
 * l'installateur du kit portable (tools/kit/installer.mjs) : les questions
 * essentielles, leurs valeurs par défaut, leur validation et les fichiers
 * produits. Module ES pur, sans dépendance : il tourne tel quel dans un
 * navigateur (<script type="module">) et dans Node.
 *
 * Il produit aussi « kiosque-config.json », le fichier que l'extension
 * WordPress « Le Kiosque » importe en un écran.
 */

export const FORMAT = 'kiosque-config';
export const VERSION = 1;

export const SECTIONS_PROPOSEES = ['Actualités', 'Campus', 'Culture', 'Sports', 'Opinion'];

/** Les seules questions posées au départ. Tout le reste a un défaut sensé. */
export const ESSENTIELS = [
  {
    cle: 'name', etape: 1, etiquette: 'Nom du journal', exemple: 'La Gazette du Nord',
    ou: 'Le nom tel qu’il doit apparaître en haut du site.',
  },
  {
    cle: 'institution', etape: 1, etiquette: 'Établissement', exemple: 'Cégep du Nord',
    ou: 'Le nom officiel du cégep, de l’université ou de l’école.',
  },
  {
    cle: 'accent', etape: 2, etiquette: 'Couleur principale', exemple: '#6c2163',
    ou: 'La couleur du journal (logo, affiche). L’établissement publie souvent ses couleurs officielles dans ses normes graphiques.',
  },
  {
    cle: 'sections', etape: 3, etiquette: 'Sections', exemple: SECTIONS_PROPOSEES.join('\n'),
    ou: 'Une section par ligne. Vous pourrez en ajouter ou en retirer plus tard.',
  },
];

/** Étapes communes (web : 4 écrans; kit : la partie « journal » de l'étape 4). */
export const ETAPES = [
  { n: 1, titre: 'Votre journal' },
  { n: 2, titre: 'Apparence' },
  { n: 3, titre: 'Sections' },
  { n: 4, titre: 'C’est prêt' },
];

export function slugify(value, repli = 'journal') {
  return String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 96) || repli;
}

export function normalizeHex(value, repli) {
  const hex = String(value ?? '').trim();
  return /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : repli;
}

function luminance(hex) {
  const c = [1, 3, 5].map((o) => {
    const v = parseInt(hex.slice(o, o + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contraste(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Variante claire de la couleur pour le mode sombre (mélange avec du blanc). */
export function couleurSombre(accent) {
  const hex = normalizeHex(accent, '#6c2163');
  let mix = 0.45;
  let out = hex;
  for (; mix <= 0.9; mix += 0.05) {
    out = '#' + [1, 3, 5].map((o) => {
      const v = parseInt(hex.slice(o, o + 2), 16);
      return Math.round(v + (255 - v) * mix).toString(16).padStart(2, '0');
    }).join('');
    if (contraste(out, '#0e0f12') >= 4.5) break;
  }
  return out;
}

/** Valeurs par défaut de tout ce qui n'est pas essentiel (réglages avancés). */
export function defauts(r = {}) {
  const name = r.name || 'Mon journal';
  return {
    slug: slugify(name),
    tagline: '',
    institutionType: 'cegep',
    region: 'Québec',
    founded: String(new Date().getFullYear()),
    siteUrl: 'https://journal-exemple.invalid',
    timeZone: 'America/Toronto',
    accentDark: couleurSombre(r.accent),
    typography: 'modern-accessible',
    logoAlt: name,
    logo: null,
    repository: 'nom-utilisateur/le-journal',
    deployment: 'github-pages',
    cname: '',
    demoContent: true,
    startEmpty: false,
    radioEnabled: true,
    station: '',
    backgroundsEnabled: true,
    weatherEnabled: false,
    weatherLocalities: '',
    pomodoro: true,
    solitaire: true,
    users: '',
    authBaseUrl: '',
  };
}

/** Retourne un message d'erreur en français, ou null si la valeur convient. */
export function valider(cle, valeur) {
  const v = String(valeur ?? '').trim();
  switch (cle) {
    case 'name':
      if (!v) return 'Indiquez le nom du journal.';
      if (v.length > 80) return 'Le nom dépasse 80 caractères.';
      return null;
    case 'institution':
      if (!v) return 'Indiquez l’établissement.';
      return null;
    case 'accent':
    case 'accentDark':
      return /^#[0-9a-f]{6}$/i.test(v) ? null : 'Une couleur au format #rrggbb, par exemple #6c2163.';
    case 'sections':
      return lireSections(v).length ? null : 'Gardez au moins une section.';
    case 'slug':
      return /^[a-z0-9-]+$/.test(v) ? null : 'Lettres minuscules, chiffres et tirets seulement.';
    case 'siteUrl':
      try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? null : 'L’adresse commence par https://'; } catch { return 'Une adresse complète, par exemple https://journal-exemple.ca'; }
    default:
      return null;
  }
}

/** Les essentiels manquants ou invalides d'une étape : [{cle, message}]. */
export function erreursEtape(etape, r) {
  return ESSENTIELS.filter((q) => q.etape === etape)
    .map((q) => ({ cle: q.cle, message: valider(q.cle, r[q.cle]) }))
    .filter((e) => e.message);
}

/** « Nom » ou « Nom | identifiant | description », une par ligne. */
export function lireSections(texte) {
  if (Array.isArray(texte)) return texte;
  const vus = new Set();
  return String(texte ?? '').split(/\r?\n/).map((ligne) => {
    const b = ligne.split('|').map((x) => x.trim());
    if (!b[0]) return null;
    let slug = slugify(b[1] || b[0], 'section');
    while (vus.has(slug)) slug += '-2';
    vus.add(slug);
    return { name: b[0], slug, description: b[2] || '' };
  }).filter(Boolean).map((s, i) => ({ ...s, order: i + 1 }));
}

export function lireUtilisateurs(texte) {
  return String(texte ?? '').split(/\r?\n/).map((ligne) => {
    const b = ligne.split('|').map((x) => x.trim());
    return b[0] ? { name: b[0], email: b[1] || '', role: b[2] || 'auteur' } : null;
  }).filter(Boolean);
}

/** Réponses partielles → configuration complète (défauts pour le reste). */
export function completer(r = {}) {
  const base = defauts(r);
  const out = { ...base };
  for (const [k, v] of Object.entries(r)) if (v !== undefined && v !== null && v !== '') out[k] = v;
  if (!r.slug) out.slug = slugify(out.name);
  if (!r.logoAlt) out.logoAlt = out.name;
  out.accent = normalizeHex(out.accent, '#6c2163');
  out.accentDark = normalizeHex(r.accentDark, couleurSombre(out.accent));
  return out;
}

const yaml = (v) => JSON.stringify(String(v ?? ''));

function depot(c) {
  const m = /^([^/\s]+)\/([^/\s]+)$/.exec(String(c.repository || '').trim());
  return m ? { owner: m[1], repo: m[2] } : { owner: 'nom-utilisateur', repo: 'le-journal' };
}

export function publicationYml(c, { categories = [] } = {}) {
  const repo = depot(c);
  const users = lireUtilisateurs(c.users);
  const contact = users.find((u) => u.email)?.email || 'redaction@journal-exemple.invalid';
  const releve = users.filter((u) => u.email).slice(0, 2).map((u) => u.email);
  while (releve.length < 2) releve.push(`releve-${releve.length + 1}@journal-exemple.invalid`);
  const localites = String(c.weatherLocalities || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4);
  return [
    '# Valeurs produites par le configurateur KIOSQUE (packages/config-core).',
    `slug: ${yaml(c.slug)}`,
    `name: ${yaml(c.name)}`,
    `tagline: ${yaml(c.tagline)}`,
    `institution: ${yaml(c.institution)}`,
    `institutionType: ${yaml(c.institutionType)}`,
    `region: ${yaml(c.region)}`,
    'lang: fr-CA',
    `siteUrl: ${yaml(c.siteUrl)}`,
    `timeZone: ${yaml(c.timeZone)}`,
    'theme:',
    `  accent: ${yaml(c.accent)}`,
    `  accentDark: ${yaml(c.accentDark)}`,
    `  typography: ${yaml(c.typography)}`,
    'masthead:',
    '  backgrounds:',
    `    enabled: ${Boolean(c.backgroundsEnabled)}`,
    '    images: []',
    '  weather:',
    `    enabled: ${Boolean(c.weatherEnabled)}`,
    `    localities: [${localites.map(yaml).join(', ')}]`,
    '  tools:',
    `    pomodoro: ${Boolean(c.pomodoro)}`,
    `    solitaire: ${Boolean(c.solitaire)}`,
    'radio:',
    `  enabled: ${Boolean(c.radioEnabled)}`,
    `  station: ${yaml(c.station)}`,
    '  theme: dark',
    '  position: top',
    `founded: ${yaml(c.founded)}`,
    'license: CC-BY-SA-4.0',
    'governance:',
    `  owner: ${yaml(repo.owner)}`,
    `  stewardEntity: ${yaml(c.institution)}`,
    `  contact: ${yaml(contact)}`,
    `  repo: ${yaml(`https://github.com/${repo.owner}/${repo.repo}`)}`,
    '  recoveryContacts:',
    `    - ${yaml(releve[0])}`,
    `    - ${yaml(releve[1])}`,
    '',
  ].join('\n');
}

export function tokensCss(c) {
  const serif = c.typography === 'institutional' ? 'Arial, Helvetica, sans-serif' : 'Georgia, "Times New Roman", serif';
  return [
    '/* Seul fichier visuel à personnaliser. */',
    ':root {',
    '  --bg: #ffffff; --bg-soft: #f6f6f4;',
    '  --ink: #16181c; --ink-soft: #44474d; --muted: #80858c;',
    '  --rule: #e7e7e3; --rule-strong: #14161a;',
    `  --accent: ${c.accent};`,
    `  --accent-dark: ${c.accentDark};`,
    '  --live: #c8102e; --live-dark: #9c0c24;',
    '  --radio: #003da5; --radio-bright: #5d9be0;',
    `  --serif: ${serif};`,
    '  --sans: system-ui, -apple-system, "Segoe UI", sans-serif;',
    '  --maxw: 800px; --pad: 24px;',
    '  --wordmark-size: clamp(2.05rem, 6.8vw + .3rem, 4.25rem);',
    '  --lead-title-size: clamp(1.55rem, 4.1vw + .15rem, 2.55rem);',
    '}',
    ':root[data-theme="dark"] {',
    '  --bg: #0e0f12; --bg-soft: #181a1e;',
    '  --ink: #f1f2f4; --ink-soft: #c2c6cd; --muted: #888d96;',
    '  --rule: #26282d; --rule-strong: #f1f2f4;',
    `  --accent: ${c.accentDark};`,
    '}',
    '',
  ].join('\n');
}

export function sectionYml(s) {
  return [`slug: ${yaml(s.slug)}`, `name: ${yaml(s.name)}`, `description: ${yaml(s.description)}`, `order: ${s.order}`, ''].join('\n');
}

export function kiosqueConfigTs(c) {
  const base = c.deployment === 'github-pages' ? `/${depot(c).repo}` : '';
  return [
    "import type { KiosqueConfig } from './packages/pipeline/src/config.ts';",
    '',
    'const config: Partial<KiosqueConfig> = {',
    "  source: { adapter: 'markdown', options: { root: new URL('.', import.meta.url).pathname } },",
    "  editorial: { mode: 'git-sveltia' },",
    '  deploy: {',
    `    basePath: ${JSON.stringify(base)},`,
    ...(c.deployment === 'custom-domain' && c.cname ? [`    cname: ${JSON.stringify(c.cname)},`] : []),
    '  },',
    ...(c.authBaseUrl ? [`  cms: { authBaseUrl: ${JSON.stringify(c.authBaseUrl)}, branch: 'main' },`] : []),
    `  demoContent: ${Boolean(c.demoContent && !c.startEmpty)},`,
    '  feedLimit: 30,',
    '};',
    '',
    'export default config;',
    '',
  ].join('\n');
}

/** Les fichiers du journal Kiosque (GitHub, kit portable). */
export function fichiersKiosque(c, { categories = [], tags = [] } = {}) {
  const sections = lireSections(c.sections);
  const tax = (liste) => (liste.length ? liste.map((x) => `  - name: ${yaml(x.name)}\n    slug: ${yaml(x.slug)}`) : ['  []']);
  return [
    { path: 'kiosque.config.ts', content: kiosqueConfigTs(c) },
    { path: 'content/publication.yml', content: publicationYml(c) },
    { path: 'content/taxonomies.yml', content: ['categories:', ...tax(categories), 'tags:', ...tax(tags), ''].join('\n') },
    { path: 'theme/tokens.css', content: tokensCss(c) },
    { path: FICHIER_EXPORT, content: `${JSON.stringify(exporter(c), null, 2)}\n` },
    ...sections.map((s) => ({ path: `content/sections/${s.slug}.yml`, content: sectionYml(s) })),
  ];
}

export const FICHIER_EXPORT = 'kiosque-config.json';

/** Rôles éditoriaux du Kiosque et leur correspondance WordPress. */
export const ROLES = [
  { slug: 'kiosque_journaliste', nom: 'Journaliste', base: 'contributor', kiosque: 'auteur' },
  { slug: 'kiosque_chef_pupitre', nom: 'Chef de pupitre', base: 'editor', kiosque: 'editeur' },
  { slug: 'kiosque_redacteur_chef', nom: 'Rédacteur en chef', base: 'editor', kiosque: 'redacteur' },
];

export const PAGES = [
  { slug: 'equipe', titre: 'Équipe' },
  { slug: 'a-propos', titre: 'À propos' },
  { slug: 'politique-de-correction', titre: 'Politique de correction' },
  { slug: 'deontologie', titre: 'Déontologie' },
];

/** kiosque-config.json : lu par l'extension WordPress et par le kit. */
export function exporter(c) {
  return {
    format: FORMAT,
    version: VERSION,
    journal: {
      nom: c.name, slug: c.slug, signature: c.tagline, etablissement: c.institution,
      typeEtablissement: c.institutionType, region: c.region, fondation: c.founded,
      adresse: c.siteUrl, fuseau: c.timeZone, langue: 'fr-CA',
    },
    apparence: { couleur: c.accent, couleurSombre: c.accentDark, typographie: c.typography, logo: c.logo?.src || null, logoAlt: c.logoAlt },
    sections: lireSections(c.sections).map(({ name, slug, description, order }) => ({ nom: name, slug, description, ordre: order })),
    pages: PAGES,
    roles: ROLES,
    options: { radio: Boolean(c.radioEnabled), station: c.station || '', meteo: Boolean(c.weatherEnabled), localites: c.weatherLocalities || '' },
  };
}

/** Inverse de exporter() : kiosque-config.json → réponses (kit, réimport web). */
export function importer(json) {
  const d = typeof json === 'string' ? JSON.parse(json) : json;
  if (!d || d.format !== FORMAT) throw new Error('Ce fichier n’est pas un kiosque-config.json.');
  if (d.version > VERSION) throw new Error(`Version ${d.version} trop récente pour cet outil (≤ ${VERSION}).`);
  const j = d.journal || {}, a = d.apparence || {}, o = d.options || {};
  return completer({
    name: j.nom, slug: j.slug, tagline: j.signature, institution: j.etablissement,
    institutionType: j.typeEtablissement, region: j.region, founded: j.fondation,
    siteUrl: j.adresse, timeZone: j.fuseau,
    accent: a.couleur, accentDark: a.couleurSombre, typography: a.typographie, logoAlt: a.logoAlt,
    logo: a.logo ? { kind: 'image', src: a.logo, alt: a.logoAlt || j.nom } : null,
    sections: (d.sections || []).map((s) => [s.nom, s.slug, s.description || ''].join(' | ')).join('\n'),
    radioEnabled: o.radio, station: o.station, weatherEnabled: o.meteo, weatherLocalities: o.localites,
  });
}

/**
 * Applique la configuration à un journal existant (gabarit du kit) sans
 * écraser ses commentaires pédagogiques : remplacements ciblés, ligne à ligne.
 * Retourne les nouveaux textes de publication.yml et de theme/tokens.css.
 */
export function appliquerAuGabarit({ publication, tokens }, c) {
  const scal = { slug: c.slug, name: c.name, tagline: c.tagline || `Le journal étudiant — ${c.institution}`, institution: c.institution, institutionType: c.institutionType, region: c.region, siteUrl: c.siteUrl };
  let p = publication;
  for (const [k, v] of Object.entries(scal)) {
    if (v === undefined || v === '') continue;
    p = p.replace(new RegExp(`^${k}:[^\\n#]*(#.*)?$`, 'm'), (_, com) => `${k}: ${yaml(v)}${com ? `      ${com}` : ''}`);
  }
  p = p.replace(/^(\s+)accent:.*$/m, `$1accent: ${yaml(c.accent)}`).replace(/^(\s+)accentDark:.*$/m, `$1accentDark: ${yaml(c.accentDark)}`);
  // Remplacement par valeur : l'ancienne couleur claire et l'ancienne couleur
  // sombre (lues dans publication.yml) deviennent les nouvelles, où qu'elles soient.
  const ancien = (k) => new RegExp(`^\\s+${k}:\\s*['"]?(#[0-9a-f]{6})`, 'im').exec(publication)?.[1];
  let t = tokens;
  if (t) {
    const clair = ancien('accent'), sombre = ancien('accentDark');
    const remplace = (txt, de, vers) => (de ? txt.replace(new RegExp(`(--accent:\\s*)${de}\\b`, 'gi'), `$1${vers}`) : txt);
    t = remplace(remplace(t, sombre, '§SOMBRE§'), clair, c.accent).replaceAll('§SOMBRE§', c.accentDark);
  }
  return { publication: p, tokens: t };
}
