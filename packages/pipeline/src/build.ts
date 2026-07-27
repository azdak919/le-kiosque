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
  isPublic,
  type Article,
  type Author,
  type ContentBundle,
} from '../../core/src/model.ts';
import {
  articlePage,
  authorPage,
  authorsIndexPage,
  homePage,
  page,
  redirectPage,
  sectionPage,
  esc,
  type RenderContext,
} from '../../theme-radar/src/templates.ts';
import { sanitizeHtml } from './sanitize.ts';
import { normalizeBasePath, type KiosqueConfig } from './config.ts';
import { readIndex } from './mirror.ts';

const THEME_ASSETS = path.resolve(
  fileURLToPath(new URL('../../theme-radar/assets', import.meta.url)),
);

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
): Promise<void> {
  if (allowDeletions) return;
  const index = await readIndex(root);
  const previous = index?.articles?.filter((a) => a.status === 'published' || a.status === 'archived').length;
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
  const updated = articles[0]?.updatedAt ?? bundle.syncedAt;

  const entries = articles
    .slice(0, limit)
    .map((a) => {
      const authors = a.authors
        .map((s) => bundle.authors.find((x) => x.slug === s)?.name ?? s)
        .map((n) => `    <author><name>${esc(n)}</name></author>`)
        .join('\n');
      return `  <entry>
    <title>${esc(a.title)}</title>
    <link href="${esc(a.canonicalUrl)}"/>
    <id>urn:uuid:${esc(a.id)}</id>
    <updated>${esc(a.updatedAt)}</updated>
    <published>${esc(a.publishedAt ?? a.updatedAt)}</published>
${authors}
    <summary type="text">${esc(a.excerpt)}</summary>
  </entry>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${esc(pub.lang)}">
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

  const published = bundle.articles.filter(isPublic).sort(byDateDesc);

  await guardAgainstEmptying(config.root, published.length, options.allowDeletions ?? false);

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const ctx: RenderContext = {
    publication: bundle.publication,
    basePath,
    taxonomies: bundle.taxonomies,
    authorsBySlug: new Map(bundle.authors.map((a) => [a.slug, a])),
    demoNotice: config.demoNotice,
    buildYear: new Date().getUTCFullYear(),
  };

  const base = bundle.publication.siteUrl.replace(/\/+$/, '');
  const urls: Array<{ loc: string; lastmod?: string }> = [];
  let pages = 0;

  // Accueil
  await emit(outDir, '/', homePage(published, ctx));
  urls.push({ loc: `${base}/`, lastmod: published[0]?.updatedAt });
  pages++;

  // Articles
  let redirects = 0;
  for (const article of published) {
    const withHtml: Article = { ...article, body: { ...article.body, html: renderBody(article) } };
    await emit(outDir, `/articles/${article.slug}/`, articlePage(withHtml, ctx));
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
    const inSection = published.filter((a) => a.section === section.slug);
    await emit(outDir, `/sections/${section.slug}/`, sectionPage(section, inSection, ctx));
    urls.push({ loc: `${base}/sections/${section.slug}/` });
    pages++;
  }

  // Auteur·rices
  const counts = new Map<string, number>();
  for (const a of published) for (const s of a.authors) counts.set(s, (counts.get(s) ?? 0) + 1);

  const orderedAuthors = [...bundle.authors].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  await emit(outDir, '/auteurs/', authorsIndexPage(orderedAuthors, counts, ctx));
  urls.push({ loc: `${base}/auteurs/` });
  pages++;

  for (const author of bundle.authors) {
    const signed = published.filter((a) => a.authors.includes(author.slug));
    await emit(outDir, `/auteurs/${author.slug}/`, authorPage(author, signed, ctx));
    urls.push({ loc: `${base}/auteurs/${author.slug}/` });
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
      <p class="section-intro">${published.length} article${published.length > 1 ? 's' : ''} publié${published.length > 1 ? 's' : ''}, ${bundle.taxonomies.sections.length} sections, ${bundle.authors.length} signatures.</p>
      <ul>
        ${published.map((a) => `<li><a href="${basePath}/articles/${esc(a.slug)}/">${esc(a.title)}</a></li>`).join('\n        ')}
      </ul>
    </div>`,
      { title: `Plan du site — ${bundle.publication.name}`, canonical: `${base}/plan-du-site/` },
      ctx,
    ),
  );
  pages++;

  // Flux, plan XML, robots
  await writeFile(path.join(outDir, 'feed.xml'), atomFeed(bundle, published, config.feedLimit ?? 30), 'utf8');
  await writeFile(path.join(outDir, 'sitemap.xml'), sitemap(bundle, urls), 'utf8');
  await writeFile(
    path.join(outDir, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${base}/sitemap.xml\n`,
    'utf8',
  );

  // Redirections déclaratives, pour les hébergeurs qui savent les lire.
  // GitHub Pages les ignore — d'où les pages HTML émises plus haut. Les deux
  // coexistent : le site doit fonctionner partout, pas seulement chez un.
  const redirectRules = published
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
      `RewriteEngine On\n${published
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

  // Fichiers statiques du thème et médias du miroir
  await cp(THEME_ASSETS, path.join(outDir, 'assets'), { recursive: true });
  await cp(path.join(config.root, 'media'), path.join(outDir, 'media'), {
    recursive: true,
    force: true,
    // Les fichiers cachés du miroir (.checksums.json) sont de l'outillage
    // interne : ils ne regardent pas les lectrices et lecteurs du journal.
    filter: (src) => !path.basename(src).startsWith('.'),
  }).catch(() => {
    log.warn('aucun dossier media/ — le site n’aura pas d’images');
  });

  // Un thème personnalisé par le journal surcharge les jetons du thème de base.
  const overrides = path.join(config.root, 'theme', 'tokens.css');
  await readFile(overrides, 'utf8')
    .then((css) => writeFile(path.join(outDir, 'assets', 'tokens.css'), css, 'utf8'))
    .catch(() => {});

  log.info(`${pages} pages, ${published.length} articles publiés, ${redirects} redirections`);
  return { pages, articles: published.length, redirects, outDir };
}
