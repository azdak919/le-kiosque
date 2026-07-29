/**
 * LE KIOSQUE — génération du site statique.
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  CE MODULE NE PARLE JAMAIS À UN CMS.
 *  Il n'importe aucun adaptateur, ne fait aucun appel réseau, ne lit aucun
 *  secret. Il ne connaît que `content/` et `media/`.
 *  C'est cette frontière — et elle seule — qui garantit qu'un backend mort
 *  casse l'écriture sans jamais casser la lecture.
 * ══════════════════════════════════════════════════════════════════════════
 */

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

import {
  byDateDesc,
  isListed,
  hasPublicPage,
  LISTED_STATUSES,
  type EditorialStatus,
  type Article,
  type Author,
  type ContentBundle,
} from '../../core/src/model.ts';
import {
  articlePage,
  archivesPage,
  archivesYearPage,
  categoryPage,
  authorPage,
  authorsIndexPage,
  groupArticlesByYear,
  homePage,
  page,
  redirectPage,
  sectionPage,
  esc,
  type RenderContext,
} from '../../theme-radar/src/templates.ts';
import { adminPage, unavailableExternalAdminPage } from '../../theme-radar/src/admin.ts';
import { localAdminPage } from '../../theme-radar/src/local-admin.ts';
import { renderCmsConfig } from './cms-config.ts';
import { sanitizeHtml } from './sanitize.ts';
import { normalizeBasePath, type KiosqueConfig } from './config.ts';
import { readIndex } from './mirror.ts';

const THEME_ASSETS = path.resolve(
  fileURLToPath(new URL('../../theme-radar/assets', import.meta.url)),
);
const PGLITE_DIST = path.resolve(fileURLToPath(new URL('../../../node_modules/@electric-sql/pglite/dist', import.meta.url)));
const MARKED_BROWSER = path.resolve(fileURLToPath(new URL('../../../node_modules/marked/lib/marked.esm.js', import.meta.url)));

async function copyPgliteModule(entry: string, sourceRoot: string, targetRoot: string, seen = new Set<string>()): Promise<void> {
  const relative = path.relative(sourceRoot, entry);
  if (seen.has(relative)) return;
  seen.add(relative);
  const code = await readFile(entry, 'utf8').catch(() => {
    throw new Error(`Ressource PGlite absente : ${relative}. Relancer « npm ci » avant le build.`);
  });
  const target = path.join(targetRoot, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, code, 'utf8');
  const references = [...code.matchAll(/(?:from\s*|import\s*)[(']*["'](\.{1,2}\/[^"']+\.js)["']/g)].map((match) => match[1]);
  for (const reference of references) await copyPgliteModule(path.resolve(path.dirname(entry), reference), sourceRoot, targetRoot, seen);
}

async function copyDemoRuntime(outDir: string): Promise<void> {
  const editorialDir = path.join(outDir, 'assets', 'editorial');
  const pgliteDir = path.join(editorialDir, 'pglite');
  // Le même noyau de carte est exécuté par les gabarits statiques et par la
  // démo PGlite. Il vit côté thème, puis est copié explicitement dans le
  // runtime navigateur — jamais recopié à la main dans render.js.
  await cp(path.resolve(THEME_ASSETS, '..', 'src', 'source-view.js'), path.join(editorialDir, 'source-view.js'));
  await copyPgliteModule(path.join(PGLITE_DIST, 'index.js'), PGLITE_DIST, pgliteDir);
  await copyPgliteModule(path.join(PGLITE_DIST, 'worker', 'index.js'), PGLITE_DIST, pgliteDir);
  for (const file of ['pglite.wasm', 'pglite.data', 'initdb.wasm']) {
    await cp(path.join(PGLITE_DIST, file), path.join(pgliteDir, file)).catch(() => {
      throw new Error(`Ressource PGlite absente : ${file}. Relancer « npm ci » avant le build.`);
    });
  }
  await cp(MARKED_BROWSER, path.join(editorialDir, 'marked.esm.js')).catch(() => {
    throw new Error('Module navigateur marked absent. Relancer « npm ci » avant le build.');
  });
}

export interface BuildOptions {
  config: KiosqueConfig;
  bundle: ContentBundle;
  outDir: string;
  /**
   * Autorise la publication d'un site contenant MOINS d'articles que le dernier
   * index connu. Sans ce drapeau, `build` s'arrête — voir `guardAgainstEmptying`.
   */
  allowDeletions?: boolean;
  logger?: { info(m: string): void; warn(m: string): void };
}

export interface BuildResult {
  pages: number;
  articles: number;
  redirects: number;
  outDir: string;
}

// ---------------------------------------------------------------------------
// L'invariant : un site ne se vide jamais tout seul
// ---------------------------------------------------------------------------

export class EmptyingError extends Error {
  // Champs déclarés puis assignés : les propriétés de paramètre ne sont pas de
  // la syntaxe « effaçable » et Node refuserait le fichier.
  previous: number;
  next: number;

  constructor(previous: number, next: number) {
    super(
      `Le site publié perdrait des articles : ${previous} → ${next}.\n` +
        `  Un quota dépassé, un jeton expiré ou une API vide ressemblent exactement à ceci.\n` +
        `  Si la suppression est VOLONTAIRE, relancer avec --allow-deletions.`,
    );
    this.name = 'EmptyingError';
    this.previous = previous;
    this.next = next;
  }
}

/**
 * Compare le nombre d'articles publics à celui du dernier index connu.
 *
 * C'est le garde-fou central du projet. Le mode de mort qu'il empêche est réel
 * et banal : un jeton d'API expire pendant l'été, le CMS répond « 0 article »
 * avec un code 200, le build passe, et le journal se réveille en septembre avec
 * dix ans d'archives remplacés par une page vide.
 */
export async function guardAgainstEmptying(
  root: string,
  nextPublicCount: number,
  allowDeletions: boolean,
  includeDemo = true,
): Promise<void> {
  if (allowDeletions) return;
  const index = await readIndex(root);
  // Le filtre DOIT correspondre exactement à ce qu'on compte du côté du build,
  // sinon le garde-fou se déclenche à tort — ou pire, ne se déclenche pas.
  // Ici : les articles qui comptent dans les listes, donc `published` seul.
  const previous = index?.articles?.filter(
    (a) => LISTED_STATUSES.includes(a.status as EditorialStatus) && (includeDemo || !a.demo),
  ).length;
  if (previous === undefined) return; // premier build : rien à comparer
  if (nextPublicCount < previous) throw new EmptyingError(previous, nextPublicCount);
}

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------

marked.setOptions({ gfm: true, breaks: false });

function renderBody(article: Article): string {
  if (article.body.format === 'html') return sanitizeHtml(article.body.raw);
  // Le Markdown de notre propre dépôt est de confiance, mais on l'assainit
  // quand même : `marked` laisse passer le HTML brut inséré dans le Markdown,
  // et un jour ce Markdown viendra d'un import WordPress.
  return sanitizeHtml(marked.parse(article.body.raw, { async: false }) as string);
}

function atomFeed(bundle: ContentBundle, articles: Article[], limit: number): string {
  const pub = bundle.publication;
  const base = pub.siteUrl.replace(/\/+$/, '');
  const updated = articles.map((article) => article.updatedAt).sort().at(-1) ?? bundle.syncedAt;

  const entries = articles
    .slice(0, limit)
    .map((a) => {
      const authors = a.authors
        .map((s) => bundle.authors.find((x) => x.slug === s)?.name ?? s)
        .map((n) => `    <author><name>${esc(n)}</name></author>`)
        .join('\n');
      const leadUrl = a.lead
        ? (/^https?:\/\//.test(a.lead.src) ? a.lead.src : `${base}${a.lead.src}`)
        : undefined;
      const leadType = a.lead?.mime
        ?? (/\.svg(?:\?|$)/i.test(a.lead?.src ?? '') ? 'image/svg+xml'
          : /\.png(?:\?|$)/i.test(a.lead?.src ?? '') ? 'image/png'
            : /\.webp(?:\?|$)/i.test(a.lead?.src ?? '') ? 'image/webp' : 'image/jpeg');
      const media = leadUrl
        ? `\n    <media:content url="${esc(leadUrl)}" type="${esc(leadType)}" medium="image"/>`
        : '';
      return `  <entry>
    <title>${esc(a.title)}</title>
    <link href="${esc(a.canonicalUrl)}" rel="alternate" type="text/html"/>
    <id>urn:uuid:${esc(a.id)}</id>
    <updated>${esc(a.updatedAt)}</updated>
    <published>${esc(a.publishedAt ?? a.updatedAt)}</published>
${authors}
    <summary type="text">${esc(a.excerpt)}</summary>${media}
  </entry>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/" xml:lang="${esc(pub.lang)}">
  <title>${esc(pub.name)}</title>
  <subtitle>${esc(pub.tagline ?? pub.institution)}</subtitle>
  <link href="${esc(base)}/feed.xml" rel="self"/>
  <link href="${esc(base)}/"/>
  <id>${esc(base)}/</id>
  <updated>${esc(updated)}</updated>
  <generator uri="https://github.com/kiosque/kiosque">Le Kiosque</generator>
${entries}
</feed>
`;
}

function sitemap(bundle: ContentBundle, urls: Array<{ loc: string; lastmod?: string }>): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${esc(u.lastmod)}</lastmod>` : ''}</url>`,
  )
  .join('\n')}
</urlset>
`;
}

async function emit(outDir: string, routePath: string, html: string): Promise<void> {
  const target = routePath === '/' ? 'index.html' : `${routePath.replace(/^\/|\/$/g, '')}/index.html`;
  const full = path.join(outDir, target);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, html, 'utf8');
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export async function build(options: BuildOptions): Promise<BuildResult> {
  const { config, bundle, outDir } = options;
  const log = options.logger ?? { info: () => {}, warn: () => {} };
  const basePath = normalizeBasePath(config.deploy?.basePath);
  const editorialMode = config.editorial?.mode ?? 'git-sveltia';
  const editorialAssetsBase = `${basePath}/assets/editorial`;
  const databaseKey = `kiosque-${basePath.replace(/[^a-z0-9]+/gi, '-') || 'root'}-${bundle.publication.slug}`;
  const publicationForRender = editorialMode === 'demo-local' ? bundle.publication : {
    ...bundle.publication,
    masthead: bundle.publication.masthead ? {
      ...bundle.publication.masthead,
      backgrounds: bundle.publication.masthead.backgrounds ? {
        ...bundle.publication.masthead.backgrounds,
        images: bundle.publication.masthead.backgrounds.images.filter((image) => !image.src.startsWith('/media/demo-library/')),
      } : undefined,
    } : undefined,
  };

  // Deux ensembles, deux usages — les confondre casse soit les liens
  // partagés, soit la confidentialité des brouillons.
  //   listed : ce qui apparaît dans les listes (published seul)
  //   paged  : ce qui garde une page à son URL (published + archived)
  const eligible = config.demoContent === false
    ? bundle.articles.filter((article) => !article.isDemo)
    : bundle.articles;
  const listed = eligible.filter(isListed).sort(byDateDesc);
  const paged = eligible.filter(hasPublicPage).sort(byDateDesc);

  await guardAgainstEmptying(
    config.root,
    listed.length,
    options.allowDeletions ?? false,
    config.demoContent !== false,
  );

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const ctx: RenderContext = {
    publication: publicationForRender,
    basePath,
    taxonomies: bundle.taxonomies,
    authorsBySlug: new Map(bundle.authors.map((a) => [a.slug, a])),
    demoNotice: config.demoNotice,
    buildYear: new Date().getUTCFullYear(),
    editorial: editorialMode === 'demo-local' ? {
      mode: 'demo-local',
      assetsBase: editorialAssetsBase,
      seedUrl: `${editorialAssetsBase}/seed.json`,
      databaseKey,
    } : undefined,
  };

  const base = bundle.publication.siteUrl.replace(/\/+$/, '');
  const urls: Array<{ loc: string; lastmod?: string }> = [];
  let pages = 0;

  // Accueil
  await emit(outDir, '/', homePage(listed, ctx));
  if (editorialMode === 'demo-local') {
    await writeFile(
      path.join(outDir, '404.html'),
      homePage(listed, ctx).replace(
        /<main id="contenu">[\s\S]*?<\/main>/,
        '<main id="contenu"><div class="wrap wire"><h1>Page introuvable</h1><p>Cette adresse ne correspond à aucune page du journal.</p></div></main>',
      ),
      'utf8',
    );
  }
  urls.push({ loc: `${base}/`, lastmod: listed[0]?.updatedAt });
  pages++;

  // Articles
  let redirects = 0;
  for (const article of paged) {
    const withHtml: Article = { ...article, body: { ...article.body, html: renderBody(article) } };
    // Rail « En bref » : listés (published), du plus récent, hors l’article courant.
    const related = listed.filter((item) => item.slug !== article.slug);
    await emit(outDir, `/articles/${article.slug}/`, articlePage(withHtml, ctx, related));
    urls.push({ loc: article.canonicalUrl, lastmod: article.updatedAt });
    pages++;

    // Anciennes URL → pages de redirection. GitHub Pages ne redirige pas côté
    // serveur ; une page canonique + meta-refresh est la seule voie qui marche
    // partout. Un lien partagé il y a cinq ans continue de fonctionner.
    for (const old of article.previousUrls ?? []) {
      if (!old.startsWith(base)) continue; // hors de notre domaine : rien à faire
      const route = old.slice(base.length) || '/';
      const clean = route.replace(/\.html?$/, '');
      await emit(outDir, clean, redirectPage(article.canonicalUrl, ctx));
      redirects++;
      pages++;
    }
  }

  // Sections
  for (const section of bundle.taxonomies.sections) {
    const inSection = listed.filter((a) => a.section === section.slug);
    await emit(outDir, `/sections/${section.slug}/`, sectionPage(section, inSection, ctx));
    urls.push({ loc: `${base}/sections/${section.slug}/` });
    pages++;
  }

  // Catégories : même espace de routes dans le site statique et le front local.
  for (const category of bundle.taxonomies.categories) {
    const inCategory = listed.filter((article) => article.categories.includes(category.slug));
    await emit(outDir, `/categories/${category.slug}/`, categoryPage(category, inCategory, ctx));
    urls.push({ loc: `${base}/categories/${category.slug}/` });
    pages++;
  }

  // Auteur·rices
  const counts = new Map<string, number>();
  for (const a of listed) for (const s of a.authors) counts.set(s, (counts.get(s) ?? 0) + 1);

  const orderedAuthors = [...bundle.authors].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  // En bref sur /auteurs/ : mêmes dernières manches que le fil d’accueil.
  await emit(outDir, '/auteurs/', authorsIndexPage(orderedAuthors, counts, ctx, listed));
  urls.push({ loc: `${base}/auteurs/` });
  pages++;

  for (const author of bundle.authors) {
    const signed = listed.filter((a) => a.authors.includes(author.slug));
    await emit(outDir, `/auteurs/${author.slug}/`, authorPage(author, signed, ctx));
    urls.push({ loc: `${base}/auteurs/${author.slug}/` });
    pages++;
  }

  // Archives chronologiques (published + archived) — registre SEO lisible sans JS.
  // Le fil d’accueil reste le « fil vivant » ; /archives/ est le catalogue durable.
  await emit(outDir, '/archives/', archivesPage(paged, ctx));
  urls.push({
    loc: `${base}/archives/`,
    lastmod: paged[0]?.updatedAt ?? paged[0]?.publishedAt,
  });
  pages++;
  for (const group of groupArticlesByYear(paged, bundle.publication.timeZone)) {
    await emit(outDir, `/archives/${group.year}/`, archivesYearPage(group.year, group.articles, ctx));
    urls.push({
      loc: `${base}/archives/${group.year}/`,
      lastmod: group.articles[0]?.updatedAt ?? group.articles[0]?.publishedAt,
    });
    pages++;
  }

  // Plan du site lisible par un humain — c'est aussi la porte d'entrée d'une
  // reprise : on y voit tout ce que le journal contient.
  await emit(
    outDir,
    '/plan-du-site/',
    page(
      `<div class="wrap wire">
      <div class="wire-head"><h1 class="wire-title">Plan du site</h1></div>
      <p class="section-intro">${listed.length} article${listed.length > 1 ? 's' : ''} sur le fil, ${paged.length} dans les <a href="${basePath}/archives/">archives</a>, ${bundle.taxonomies.sections.length} sections, ${bundle.authors.length} signatures.</p>
      <ul>
        <li><a href="${basePath}/archives/">Archives</a> — registre chronologique complet</li>
        ${listed.map((a) => `<li><a href="${basePath}/articles/${esc(a.slug)}/">${esc(a.title)}</a></li>`).join('\n        ')}
      </ul>
    </div>`,
      { title: `Plan du site — ${bundle.publication.name}`, canonical: `${base}/plan-du-site/` },
      ctx,
    ),
  );
  urls.push({ loc: `${base}/plan-du-site/` });
  pages++;

  // Flux, plan XML, robots
  await writeFile(path.join(outDir, 'feed.xml'), atomFeed(bundle, listed, config.feedLimit ?? 30), 'utf8');
  await writeFile(path.join(outDir, 'sitemap.xml'), sitemap(bundle, urls), 'utf8');
  await writeFile(
    path.join(outDir, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`,
    'utf8',
  );

  // Redirections déclaratives, pour les hébergeurs qui savent les lire.
  // GitHub Pages les ignore — d'où les pages HTML émises plus haut. Les deux
  // coexistent : le site doit fonctionner partout, pas seulement chez un.
  const redirectRules = paged
    .flatMap((a) =>
      (a.previousUrls ?? [])
        .filter((u) => u.startsWith(base))
        .map((u) => `${u.slice(base.length) || '/'}  ${a.canonicalUrl.slice(base.length)}  301`),
    )
    .join('\n');
  if (redirectRules) {
    await writeFile(path.join(outDir, '_redirects'), `${redirectRules}\n`, 'utf8');
    await writeFile(
      path.join(outDir, '.htaccess'),
      `RewriteEngine On\n${paged
        .flatMap((a) =>
          (a.previousUrls ?? [])
            .filter((u) => u.startsWith(base))
            .map((u) => `Redirect 301 ${u.slice(base.length) || '/'} ${a.canonicalUrl}`),
        )
        .join('\n')}\n`,
      'utf8',
    );
  }

  // Empêche Jekyll de réinterpréter le site côté GitHub Pages : sans ce fichier,
  // tout dossier commençant par « _ » est silencieusement ignoré au déploiement.
  await writeFile(path.join(outDir, '.nojekyll'), '', 'utf8');

  if (config.deploy?.cname) {
    await writeFile(path.join(outDir, 'CNAME'), `${config.deploy.cname}\n`, 'utf8');
  }

  // ── Interface de rédaction ────────────────────────────────────────────
  // La configuration est DÉRIVÉE du contenu : ajouter une section la fait
  // apparaître dans le CMS sans que personne n'y pense, et le CMS ne peut pas
  // diverger du format que `sync` sait relire.
  await mkdir(path.join(outDir, 'admin'), { recursive: true });
  if (editorialMode === 'demo-local') {
    await writeFile(path.join(outDir, 'admin', 'index.html'), localAdminPage({
      publicationName: bundle.publication.name, lang: bundle.publication.lang,
      publicBasePath: basePath, adminBasePath: `${basePath}/admin`, assetsBase: editorialAssetsBase,
      seedUrl: `${editorialAssetsBase}/seed.json`, publicationSlug: bundle.publication.slug, databaseKey,
    }), 'utf8');
  } else if (editorialMode === 'git-sveltia') {
    await writeFile(path.join(outDir, 'admin', 'index.html'), adminPage({ publicationName: bundle.publication.name, lang: bundle.publication.lang, basePath, accent: bundle.publication.theme.accent }), 'utf8');
    await writeFile(path.join(outDir, 'admin', 'config.yml'), renderCmsConfig({ config, bundle, authBaseUrl: config.cms?.authBaseUrl, branch: config.cms?.branch }), 'utf8');
    await cp(path.join(THEME_ASSETS, 'admin'), path.join(outDir, 'admin'), { recursive: true, force: true }).catch(() => {
      log.warn('Sveltia CMS absent — lancer « node tools/vendor-cms.mjs ». Le site publié n’est pas affecté.');
    });
  } else {
    await writeFile(path.join(outDir, 'admin', 'index.html'), unavailableExternalAdminPage(
      { publicationName: bundle.publication.name, lang: bundle.publication.lang, basePath, accent: bundle.publication.theme.accent },
      config.editorial?.externalBackend ?? 'PocketBase',
    ), 'utf8');
  }
  pages++;

  // Fichiers statiques du thème et médias du miroir. `admin/` est exclu : il a
  // déjà été copié ci-dessus, à sa place.
  await cp(THEME_ASSETS, path.join(outDir, 'assets'), {
    recursive: true,
    filter: (src) => {
      const name = path.basename(src);
      if (name === 'admin') return false;
      if (editorialMode !== 'demo-local' && name === 'editorial') return false;
      return true;
    },
  });
  if (editorialMode === 'demo-local') {
    await copyDemoRuntime(outDir);
    await writeFile(path.join(outDir, 'assets', 'editorial', 'seed.json'), JSON.stringify({
      // Bump version when demo authors/media/articles change so PGlite
      // re-hydrates unmodified demo rows (portraits, lead photos, etc.).
      format: 'kiosque-demo-seed', version: 7,
      publication: { ...bundle.publication, theme: { ...bundle.publication.theme, typography: bundle.publication.theme.typography ?? 'modern-accessible' } },
      articles: bundle.articles.map((article) => ({ ...article, isDemo: true, isUserModified: false })),
      authors: bundle.authors.map((author) => ({ ...author, isDemo: true, isUserModified: false })),
      media: bundle.media ?? [],
      sections: bundle.taxonomies.sections, categories: bundle.taxonomies.categories, tags: bundle.taxonomies.tags,
      settings: { demoVisible: config.demoContent !== false },
    }).replace(/</g, '\\u003c'), 'utf8');
  }
  await cp(path.join(config.root, 'media'), path.join(outDir, 'media'), {
    recursive: true,
    force: true,
    // Les fichiers cachés du miroir (.checksums.json) sont de l'outillage
    // interne : ils ne regardent pas les lectrices et lecteurs du journal.
    filter: (src) => {
      if (path.basename(src).startsWith('.')) return false;
      const relative = path.relative(path.join(config.root, 'media'), src);
      if (editorialMode !== 'demo-local' && relative.split(path.sep)[0] === 'demo-library') return false;
      return true;
    },
  }).catch(() => {
    log.warn('aucun dossier media/ — le site n’aura pas d’images');
  });

  // Un thème personnalisé par le journal surcharge les jetons du thème de base.
  const overrides = path.join(config.root, 'theme', 'tokens.css');
  await readFile(overrides, 'utf8')
    .then((css) => writeFile(path.join(outDir, 'assets', 'tokens.css'), css, 'utf8'))
    .catch(() => {});

  log.info(`${pages} pages, ${listed.length} articles publiés, ${redirects} redirections`);
  return { pages, articles: listed.length, redirects, outDir };
}
