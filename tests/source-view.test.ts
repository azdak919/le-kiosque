import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { renderSourceArticle } from '../packages/theme-radar/src/source-view.js';
import { MarkdownSource } from '../packages/adapters/markdown/src/index.ts';
import { createSourceContext } from '../packages/core/src/source.ts';
import { build } from '../packages/pipeline/src/build.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEMO = path.join(ROOT, 'examples/demo-journal');
const silent = { info: () => {}, warn: () => {}, error: () => {} };

test('le noyau de carte conserve les règles image, métadonnées et absence d’image de la suite', () => {
  const view = {
    section: 'Campus',
    href: '/depot/articles/essai/',
    title: 'Un titre long mais lisible',
    excerpt: 'Un extrait utile qui situe le lectorat avant la lecture complète.',
    readMore: true,
    date: { iso: '2026-07-29T10:00:00.000Z', label: '29 juillet 2026, 06 h 00' },
    authors: [{ name: 'Marie Tremblay', href: '/depot/auteurs/marie/' }],
    image: {
      src: '/depot/media/essai.jpg', alt: 'Des étudiantes dans un corridor',
      focalPoint: { x: 62, y: 39 }, width: 1200, height: 800,
    },
  };
  const brief = renderSourceArticle(view, 'brief');
  const tail = renderSourceArticle(view, 'tail');

  assert.match(brief, /article--brief/);
  assert.match(brief, /article--thumb/);
  assert.match(brief, /<figure class="article-media">/);
  assert.match(brief, /loading="lazy"/);
  assert.match(brief, /width="1200" height="800"/);
  assert.match(brief, /article-byline__label">Par<\/span>\s*<a class="article-author"/);
  assert.match(brief, /Lire la suite/);
  // Texte et lien séparés : le line-clamp En bref ne doit pas avaler le lien.
  assert.match(brief, /article-brief-text/);
  assert.match(brief, /<\/span>\s*<a class="article-more"/);
  assert.doesNotMatch(tail, /<figure class="article-media">/);
  assert.match(tail, /article--tail/);
});

test('le build copie le même noyau et la même feuille de style dans la démonstration', async (t) => {
  const out = await mkdtemp(path.join(os.tmpdir(), 'kiosque-source-view-'));
  t.after(() => rm(out, { recursive: true, force: true }));
  const source = new MarkdownSource();
  await source.init({ root: DEMO }, createSourceContext({ logger: silent }));
  const articles = [];
  for await (const article of source.fetchArticles()) articles.push(article);
  const bundle = {
    publication: await source.fetchPublication(), authors: await source.fetchAuthors(),
    taxonomies: await source.fetchTaxonomies(), articles, syncedAt: new Date().toISOString(),
  };
  await build({
    config: { root: DEMO, source: { adapter: 'markdown' }, deploy: { basePath: '/sous-dossier' }, editorial: { mode: 'demo-local' } },
    bundle, outDir: out, logger: silent,
  });
  const home = await readFile(path.join(out, 'index.html'), 'utf8');
  const runtime = await readFile(path.join(out, 'assets/editorial/render.js'), 'utf8');
  await access(path.join(out, 'assets/editorial/source-view.js'));

  assert.match(home, /href="\/sous-dossier\/assets\/source-view\.css"/);
  // Avec des leads réels, les briefs portent aussi has-image + article--thumb.
  assert.match(home, /article--brief(?: has-image article--thumb)? article--compact/);
  assert.match(home, /demo-library\/articles\/.+\.jpg/);
  assert.doesNotMatch(home, /media\/2026\/.+\.svg/);
  assert.match(runtime, /import \{ renderSourceArticle \} from '\.\/source-view\.js'/);
});
