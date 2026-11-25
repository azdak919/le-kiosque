/**
 * Produit la vitrine, le configurateur et Le Quorum dans un seul dist/.
 * Le seul accès au contenu passe par le miroir Markdown local : aucun CMS,
 * aucun secret et aucun réseau ne participent au build.
 */

import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import rootConfig from '../kiosque.config.ts';
import { MarkdownSource } from '../packages/adapters/markdown/src/index.ts';
import { createSourceContext } from '../packages/core/src/source.ts';
import { build } from '../packages/pipeline/src/build.ts';
import { normalizeBasePath, withBase } from '../packages/pipeline/src/config.ts';
import { readSharedMediaManifest } from '../packages/pipeline/src/shared-media.ts';
import { localAdminPage, SOCLE_COMMIT, SOCLE_VERSION } from '../packages/theme-radar/src/local-admin.ts';
import { updatePage } from '../packages/theme-radar/src/update-page.ts';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const outDir = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : path.join(repoRoot, 'dist');
if (outDir === repoRoot || outDir === path.parse(outDir).root) {
  throw new Error(`OUT_DIR refuse (${outDir}) : le build efface ce dossier avant d’écrire.`);
}
const siteDir = path.join(repoRoot, 'site');
const journalRoot = path.resolve(repoRoot, rootConfig.root ?? 'examples/demo-journal');
const basePath = normalizeBasePath(process.env.BASE ?? rootConfig.deploy?.basePath);
const demoBase = normalizeBasePath(`${basePath}/demo`);
const demoDatabaseKey = (slug) => `kiosque-${demoBase.replace(/[^a-z0-9]+/gi, '-') || 'root'}-${slug}`;

const log = {
  info: (message) => console.log(`[site] ${message}`),
  warn: (message) => console.warn(`[site] ${message}`),
  error: (message) => console.error(`[site] ${message}`),
};

async function readBundle() {
  const source = new MarkdownSource();
  await source.init({ root: journalRoot }, createSourceContext({ logger: log }));
  const articles = [];
  for await (const article of source.fetchArticles()) articles.push(article);
  const mediaManifest = await readSharedMediaManifest(journalRoot);
  return {
    publication: await source.fetchPublication(),
    authors: await source.fetchAuthors(),
    taxonomies: await source.fetchTaxonomies(),
    articles,
    media: mediaManifest?.media,
    syncedAt: new Date().toISOString(),
  };
}

function deployedOrigin() {
  // SITE_ORIGIN sert aux essais. Sinon l’origine du journal (kiosque.config.ts)
  // prime sur github.io : tant que le domaine n’est pas enregistré dans Pages,
  // GitHub annonce encore azdak919.github.io et un sous-chemin /le-kiosque.
  const fromEnv = String(process.env.SITE_ORIGIN || '').trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const fromConfig = String(rootConfig.deploy?.origin || '').trim();
  if (fromConfig) return fromConfig.replace(/\/+$/, '');
  if (process.env.GITHUB_REPOSITORY_OWNER) {
    return `https://${process.env.GITHUB_REPOSITORY_OWNER}.github.io`;
  }
  return 'https://journal-exemple.invalid';
}

/** URL absolue d’une page de la vitrine (origine + chemin de base). */
function publicUrl(urlPath) {
  const prefixed = withBase(basePath, urlPath);
  return `${deployedOrigin()}${prefixed.startsWith('/') ? prefixed : `/${prefixed}`}`;
}

/**
 * Icônes d'onglet du Kiosque (kiosque à auvent rayé, dessin original ;
 * voir THIRD_PARTY.md) : pages de présentation, guide, configurateur et la
 * démonstration de cette vitrine. Jamais dans le thème : le site public
 * d'un vrai journal garde son logo ou son nom.
 */
function kiosqueIcons() {
  const logo = `${basePath}/assets/logo`;
  return [
    `<link rel="icon" type="image/png" sizes="16x16" href="${logo}/favicon-16.png" media="(prefers-color-scheme: light)">`,
    `<link rel="icon" type="image/png" sizes="16x16" href="${logo}/favicon-16-sombre.png" media="(prefers-color-scheme: dark)">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="${logo}/favicon-32.png" media="(prefers-color-scheme: light)">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="${logo}/favicon-32-sombre.png" media="(prefers-color-scheme: dark)">`,
    `<link rel="icon" type="image/png" sizes="512x512" href="${logo}/icone-512.png">`,
    `<link rel="icon" type="image/svg+xml" sizes="any" href="${logo}/icone.svg">`,
    `<link rel="apple-touch-icon" href="${logo}/apple-touch-icon.png">`,
  ].join('\n  ');
}

/** Ajoute les icônes du Kiosque aux pages de la démonstration (vitrine seulement). */
async function addDemoIcons(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await addDemoIcons(file);
    else if (entry.name.endsWith('.html')) {
      const html = await readFile(file, 'utf8');
      if (html.includes('</head>') && !html.includes('rel="icon"')) await writeFile(file, html.replace('</head>', `${kiosqueIcons()}\n</head>`), 'utf8');
    }
  }
}

function injectBase(html, urlPath) {
  const canonical = publicUrl(urlPath);
  return html
    .replaceAll('{{ICONES}}', kiosqueIcons())
    .replaceAll('{{BASE_PATH}}', basePath)
    .replaceAll('{{DEMO_PATH}}', withBase(basePath, '/demo/'))
    .replaceAll('{{CANONICAL}}', canonical);
}

function prefill(bundle) {
  const publication = bundle.publication;
  return {
    publication: {
      name: publication.name,
      slug: publication.slug,
      tagline: publication.tagline,
      institution: publication.institution,
      institutionType: publication.institutionType,
      region: publication.region,
      lang: publication.lang,
      siteUrl: publication.siteUrl,
      timeZone: publication.timeZone,
      accent: publication.theme.accent,
      accentDark: publication.theme.accentDark,
      typography: publication.theme.typography ?? 'modern-accessible',
      founded: publication.founded,
      license: publication.license,
    },
    governance: publication.governance,
    radio: publication.radio,
    masthead: publication.masthead,
    sections: bundle.taxonomies.sections.map(({ name, slug, description, order }) => ({
      name, slug, description, order,
    })),
    categories: bundle.taxonomies.categories.map(({ name, slug }) => ({ name, slug })),
    tags: bundle.taxonomies.tags.map(({ name, slug }) => ({ name, slug })),
    users: [
      { name: 'Alex Exemple', email: 'alex@journal-exemple.invalid', role: 'editeur' },
      { name: 'Sam Exemple', email: 'sam@journal-exemple.invalid', role: 'auteur' },
    ],
    repository: 'nom-utilisateur/le-journal',
    deployment: 'github-pages',
    demoContent: true,
    serviceUrl: 'https://service.example',
    serviceKey: 'DEMO_ONLY_DO_NOT_USE',
    exampleNotice: 'Toutes les valeurs préremplies sont fictives et servent uniquement de démonstration.',
    databaseKey: demoDatabaseKey(publication.slug),
    demoPath: withBase(basePath, '/demo/'),
    adminPath: withBase(basePath, '/admin/'),
  };
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const bundle = await readBundle();
const siteUrl = `${deployedOrigin()}${demoBase}`;
const demoBundle = {
  ...bundle,
  publication: { ...bundle.publication, siteUrl },
  articles: bundle.articles.map((article) => ({
    ...article,
    canonicalUrl: `${siteUrl}/articles/${article.slug}/`,
    previousUrls: article.previousUrls?.map((url) => `${siteUrl}${new URL(url).pathname}`),
  })),
};

await build({
  config: {
    ...rootConfig,
    root: journalRoot,
    // Markdown local, jamais l'adaptateur du journal publié : la démo ne parle à aucun socle.
    source: { adapter: 'markdown' },
    // Pas de CNAME ici : il appartient à la racine de l’artefact, pas à /demo/.
    deploy: { basePath: demoBase },
    // La rédaction de la vitrine vit à /admin/, pas sous une page redaction du dossier demo.
    // mode et demoContent sont forcés. Un journal configuré (`external`,
    // demoContent false) n'émettrait pas seed.json : l'admin ne démarre pas.
    editorial: { ...rootConfig.editorial, mode: 'demo-local', redactionHref: withBase(basePath, '/admin/') },
    demoContent: true,
    demoEditorialEntry: true,
  },
  bundle: demoBundle,
  outDir: path.join(outDir, 'demo'),
  logger: log,
});

await addDemoIcons(path.join(outDir, 'demo'));

// La vitrine place l'administration locale à la racine. L'alias historique
// /demo/admin/ reste utilisable sans maintenir deux applications distinctes.
await mkdir(path.join(outDir, 'admin'), { recursive: true });
await writeFile(path.join(outDir, 'admin', 'index.html'), localAdminPage({
  publicationName: demoBundle.publication.name,
  lang: demoBundle.publication.lang,
  publicBasePath: demoBase,
  adminBasePath: normalizeBasePath(`${basePath}/admin`),
  assetsBase: `${demoBase}/assets/editorial`,
  seedUrl: `${demoBase}/assets/editorial/seed.json`,
  publicationSlug: demoBundle.publication.slug,
  databaseKey: demoDatabaseKey(demoBundle.publication.slug),
}), 'utf8');
await writeFile(path.join(outDir, 'demo', 'admin', 'index.html'), `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${withBase(basePath, '/admin/')}"><link rel="canonical" href="${withBase(basePath, '/admin/')}"><title>Administration déplacée</title></head><body><p><a href="${withBase(basePath, '/admin/')}">Ouvrir l’administration locale</a></p></body></html>`, 'utf8');

// La page Mise à jour suit l'admin à la racine : sans elle, le lien de la
// barre latérale menait à un 404. L'ancienne adresse sous /demo/ redirige.
const kiosqueVersion = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8')).version;
await mkdir(path.join(outDir, 'admin', 'mise-a-jour'), { recursive: true });
await writeFile(path.join(outDir, 'admin', 'mise-a-jour', 'index.html'), updatePage({
  lang: demoBundle.publication.lang,
  publicationName: demoBundle.publication.name,
  backHref: withBase(basePath, '/admin/'),
  adminBasePath: normalizeBasePath(`${basePath}/admin`),
  publicBasePath: demoBase,
  cssHref: `${demoBase}/assets/editorial/admin.css`,
  mode: 'demo-local',
  lines: [
    { id: 'socle', title: 'Socle', installed: SOCLE_VERSION, offered: null, notes: '', commit: SOCLE_COMMIT },
    { id: 'kiosque', title: 'Kiosque', installed: kiosqueVersion, offered: null, notes: '' },
  ],
}), 'utf8');
await writeFile(path.join(outDir, 'demo', 'admin', 'mise-a-jour', 'index.html'), `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=${withBase(basePath, '/admin/mise-a-jour/')}"><link rel="canonical" href="${withBase(basePath, '/admin/mise-a-jour/')}"><title>Page déplacée</title></head><body><p><a href="${withBase(basePath, '/admin/mise-a-jour/')}">Ouvrir la page Mise à jour</a></p></body></html>`, 'utf8');

// GitHub Pages sert ce fichier pour une URL créée après le build. Le front
// La démo remplace ce 404 seulement si la route appartient au journal.
const demoFallback = await readFile(path.join(outDir, 'demo', 'index.html'), 'utf8');
await writeFile(path.join(outDir, '404.html'), demoFallback.replace(/<main id="contenu">[\s\S]*?<\/main>/, '<main id="contenu"><div class="wrap wire"><h1>Page introuvable</h1><p>Cette adresse ne correspond à aucune page du journal.</p></div></main>'), 'utf8');

await cp(path.join(repoRoot, 'packages/theme-radar/assets'), path.join(outDir, 'assets'), {
  recursive: true,
  filter: (source) => !['admin', 'editorial'].includes(path.basename(source)),
});
await cp(path.join(siteDir, 'assets'), path.join(outDir, 'assets'), { recursive: true });

await writeFile(
  path.join(outDir, 'index.html'),
  injectBase(await readFile(path.join(siteDir, 'index.html'), 'utf8'), '/'),
  'utf8',
);
await mkdir(path.join(outDir, 'guide'), { recursive: true });
await writeFile(
  path.join(outDir, 'guide', 'index.html'),
  injectBase(await readFile(path.join(siteDir, 'guide/index.html'), 'utf8'), '/guide/'),
  'utf8',
);
await cp(path.join(repoRoot, 'docs/guide-une-page.pdf'), path.join(outDir, 'guide', 'guide.pdf'));
await mkdir(path.join(outDir, 'configurer'), { recursive: true });
await writeFile(
  path.join(outDir, 'configurer', 'index.html'),
  injectBase(await readFile(path.join(siteDir, 'configurer/index.html'), 'utf8'), '/configurer/'),
  'utf8',
);
await cp(
  path.join(siteDir, 'configurer/configurateur.js'),
  path.join(outDir, 'configurer/configurateur.js'),
);
// Noyau commun configurateur ↔ kit portable (même logique, un seul endroit).
await cp(
  path.join(repoRoot, 'packages/config-core/kiosque-config.mjs'),
  path.join(outDir, 'configurer/kiosque-config.mjs'),
);
await writeFile(
  path.join(outDir, 'configurer', 'prefill.js'),
  `window.KIOSQUE_PREFILL = ${JSON.stringify(prefill(bundle)).replace(/</g, '\\u003c')};\n`,
  'utf8',
);
await writeFile(path.join(outDir, '.nojekyll'), '', 'utf8');

const origin = deployedOrigin();
const pages = ['/', '/guide/', '/configurer/', '/demo/'];
await writeFile(
  path.join(outDir, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((urlPath) => `  <url><loc>${publicUrl(urlPath)}</loc></url>`).join('\n')}\n</urlset>\n`,
  'utf8',
);
await writeFile(
  path.join(outDir, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${publicUrl('/sitemap.xml')}\n`,
  'utf8',
);
const icon = (file, type, sizes) => ({
  src: publicUrl(`/assets/logo/${file}`),
  sizes,
  type,
  purpose: 'any',
});
await writeFile(
  path.join(outDir, 'manifest.webmanifest'),
  `${JSON.stringify({
    name: 'Le Kiosque',
    short_name: 'Kiosque',
    lang: 'fr-CA',
    id: publicUrl('/'),
    start_url: publicUrl('/'),
    scope: publicUrl('/'),
    display: 'standalone',
    theme_color: '#6c2163',
    background_color: '#ffffff',
    icons: [
      icon('icone-512.png', 'image/png', '512x512'),
      icon('apple-touch-icon.png', 'image/png', '180x180'),
      icon('icone.svg', 'image/svg+xml', 'any'),
    ],
  }, null, 2)}\n`,
  'utf8',
);

// GitHub Pages lit ce fichier à la racine de l’artefact et en fait le domaine
// personnalisé. Le DNS kiosque.le-radar.ca pointe déjà vers le compte.
const cname = String(rootConfig.deploy?.cname || '').trim();
if (cname) await writeFile(path.join(outDir, 'CNAME'), `${cname}\n`, 'utf8');

console.log(`[site] site complet produit dans ${outDir} (basePath « ${basePath || '/'} », ${origin})`);
