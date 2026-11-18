/**
 * Un backend distant (socle, WordPress…) : `sync` écrit le miroir Markdown
 * que `build` relit. Aller-retour sur le journal de démonstration.
 */
import assert from 'node:assert/strict';
import { cp, mkdtemp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { MarkdownSource } from '../packages/adapters/markdown/src/index.ts';
import type { Article, ContentBundle } from '../packages/core/src/model.ts';
import { createSourceContext } from '../packages/core/src/source.ts';
import { sync } from '../packages/pipeline/src/sync.ts';

const DEMO = path.resolve(fileURLToPath(new URL('../examples/demo-journal', import.meta.url)));
const silent = { info: () => {}, warn: () => {}, error: () => {} };

async function readAll(root: string): Promise<ContentBundle> {
  const source = new MarkdownSource();
  await source.init({ root }, createSourceContext({ logger: silent }));
  const articles: Article[] = [];
  for await (const article of source.fetchArticles()) articles.push(article);
  return {
    publication: await source.fetchPublication(),
    authors: await source.fetchAuthors(),
    taxonomies: await source.fetchTaxonomies(),
    articles,
    syncedAt: '',
  };
}

/** Un backend distant qui sert un paquet tout fait, médias compris. */
function remote(bundle: ContentBundle, mediaRoot: string) {
  return {
    id: 'distant',
    capabilities: {},
    async init() {},
    async health() { return { ok: true, checkedAt: new Date().toISOString() }; },
    async fetchPublication() { return bundle.publication; },
    async fetchAuthors() { return bundle.authors; },
    async fetchTaxonomies() { return bundle.taxonomies; },
    async *fetchArticles() { yield* bundle.articles; },
    async resolveMedia(asset: { src: string }) {
      return new Uint8Array(await readFile(path.join(mediaRoot, asset.src.replace(/^\/?(media\/)?/, ''))));
    },
  };
}

function strip<T>(value: T): unknown {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value, (key, item) => (key === 'source' || key === 'id' && typeof item === 'string' && item.startsWith('media') ? undefined : item)));
}

test('sync écrit le miroir d’un backend distant, relu à l’identique par build', async () => {
  const demo = await readAll(DEMO);
  const root = await mkdtemp(path.join(os.tmpdir(), 'kiosque-distant-'));
  const config = { root, source: { adapter: 'distant', options: {} } };
  await sync({ config: config as never, source: remote(demo, path.join(DEMO, 'media')) as never, logger: silent });

  const back = await readAll(root);
  assert.equal(back.articles.length, demo.articles.length);
  const byId = new Map(back.articles.map((article) => [article.id, article]));
  for (const article of demo.articles) {
    const copy = byId.get(article.id);
    assert.ok(copy, `article perdu : ${article.slug}`);
    for (const key of ['slug', 'title', 'excerpt', 'status', 'section', 'publishedAt', 'canonicalUrl', 'lang', 'isDemo'] as const) {
      assert.deepEqual(copy[key], article[key], `${article.slug}.${key}`);
    }
    assert.deepEqual(copy.authors, article.authors);
    assert.deepEqual(copy.tags, article.tags);
    assert.equal(copy.body.raw, article.body.raw);
    assert.deepEqual(strip(copy.lead), strip(article.lead), `${article.slug}.lead`);
  }
  assert.deepEqual(back.authors.map((a) => [a.slug, a.name, a.bio]).sort(), demo.authors.map((a) => [a.slug, a.name, a.bio]).sort());
  assert.deepEqual(back.taxonomies.sections.map((s) => s.slug), demo.taxonomies.sections.map((s) => s.slug));
  assert.deepEqual(back.taxonomies.tags.map((t) => t.slug).sort(), demo.taxonomies.tags.map((t) => t.slug).sort());
  assert.equal(back.publication.name, demo.publication.name);
  assert.equal(back.publication.siteUrl, demo.publication.siteUrl);
});

test('un article retiré du backend quitte le miroir ; un fichier écrit à la main reste', async () => {
  const demo = await readAll(DEMO);
  const root = await mkdtemp(path.join(os.tmpdir(), 'kiosque-distant-'));
  const config = { root, source: { adapter: 'distant', options: {} } };
  const media = path.join(DEMO, 'media');
  await sync({ config: config as never, source: remote(demo, media) as never, logger: silent });
  const hand = path.join(root, 'content', 'articles', '2020', '01', 'a-la-main.md');
  await mkdir(path.dirname(hand), { recursive: true });
  await writeFile(hand, '---\ntitle: À la main\nstatus: draft\n---\n\nTexte.\n');

  const [gone, ...kept] = demo.articles;
  // Incrémental : rien ne disparaît.
  await sync({ config: config as never, source: remote({ ...demo, articles: kept }, media) as never, since: '2000-01-01T00:00:00Z', logger: silent });
  assert.ok((await readAll(root)).articles.some((article) => article.id === gone!.id));
  // Complet : l'article retiré part, le fichier à la main reste.
  await sync({ config: config as never, source: remote({ ...demo, articles: kept }, media) as never, logger: silent });
  const after = await readAll(root);
  assert.equal(after.articles.some((article) => article.id === gone!.id), false);
  await access(hand);
});
