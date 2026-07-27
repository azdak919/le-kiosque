/**
 * Produit la vitrine, le configurateur et Le Quorum dans un seul dist/.
 * Le seul accès au contenu passe par le miroir Markdown local : aucun CMS,
 * aucun secret et aucun réseau ne participent au build.
 */

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import rootConfig from '../kiosque.config.ts';
import { MarkdownSource } from '../packages/adapters/markdown/src/index.ts';
import { createSourceContext } from '../packages/core/src/source.ts';
import { build } from '../packages/pipeline/src/build.ts';
import { normalizeBasePath, withBase } from '../packages/pipeline/src/config.ts';
import { localAdminPage } from '../packages/theme-radar/src/local-admin.ts';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const outDir = path.join(repoRoot, 'dist');
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
  return {
    publication: await source.fetchPublication(),
    authors: await source.fetchAuthors(),
    taxonomies: await source.fetchTaxonomies(),
    articles,
    syncedAt: new Date().toISOString(),
  };
}

function deployedOrigin() {
  if (process.env.SITE_ORIGIN) return process.env.SITE_ORIGIN.replace(/\/+$/, '');
  if (process.env.GITHUB_REPOSITORY_OWNER) {
    return `https://${process.env.GITHUB_REPOSITORY_OWNER}.github.io`;
  }
  return 'https://journal-exemple.invalid';
}

function injectBase(html) {
  return html
    .replaceAll('{{BASE_PATH}}', basePath)
    .replaceAll('{{DEMO_PATH}}', withBase(basePath, '/demo/'));
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
      accent: publication.theme.accent,
      accentDark: publication.theme.accentDark,
      typography: publication.theme.typography ?? 'modern-accessible',
      founded: publication.founded,
      license: publication.license,
    },
    governance: publication.governance,
    radio: publication.radio,
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
    source: rootConfig.source ?? { adapter: 'markdown' },
    deploy: { ...rootConfig.deploy, basePath: demoBase },
  },
  bundle: demoBundle,
  outDir: path.join(outDir, 'demo'),
  logger: log,
});

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

// GitHub Pages sert ce fichier pour une URL créée après le build. Le front
// PGlite remplace ce 404 seulement si la route appartient au journal.
const demoFallback = await readFile(path.join(outDir, 'demo', 'index.html'), 'utf8');
await writeFile(path.join(outDir, '404.html'), demoFallback.replace(/<main id="contenu">[\s\S]*?<\/main>/, '<main id="contenu"><div class="wrap wire"><h1>Page introuvable</h1><p>Cette adresse ne correspond à aucune page du journal.</p></div></main>'), 'utf8');

await cp(path.join(repoRoot, 'packages/theme-radar/assets'), path.join(outDir, 'assets'), {
  recursive: true,
  filter: (source) => !['admin', 'editorial'].includes(path.basename(source)),
});
await cp(path.join(siteDir, 'assets'), path.join(outDir, 'assets'), { recursive: true });

await writeFile(
  path.join(outDir, 'index.html'),
  injectBase(await readFile(path.join(siteDir, 'index.html'), 'utf8')),
  'utf8',
);
await mkdir(path.join(outDir, 'configurer'), { recursive: true });
await writeFile(
  path.join(outDir, 'configurer', 'index.html'),
  injectBase(await readFile(path.join(siteDir, 'configurer/index.html'), 'utf8')),
  'utf8',
);
await cp(
  path.join(siteDir, 'configurer/configurateur.js'),
  path.join(outDir, 'configurer/configurateur.js'),
);
await writeFile(
  path.join(outDir, 'configurer', 'prefill.js'),
  `window.KIOSQUE_PREFILL = ${JSON.stringify(prefill(bundle)).replace(/</g, '\\u003c')};\n`,
  'utf8',
);
await writeFile(path.join(outDir, '.nojekyll'), '', 'utf8');

console.log(`[site] site complet produit dans ${outDir} (basePath « ${basePath || '/'} »)`);
