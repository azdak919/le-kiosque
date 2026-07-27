/**
 * Conformité de l'adaptateur Markdown + vérifications qui lui sont propres.
 * Aucun réseau : tout se lit dans examples/demo-journal.
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { runConformanceSuite, formatConformanceReport, validateBundle, formatIssues } from '../packages/core/src/index.ts';
import { MarkdownSource, parseFrontMatter, deriveExcerpt, derivedId } from '../packages/adapters/markdown/src/index.ts';
import type { Article } from '../packages/core/src/model.ts';

const root = path.resolve(fileURLToPath(new URL('../examples/demo-journal', import.meta.url)));
const config = { root };

test('l’adaptateur Markdown passe la suite de conformité', async () => {
  const report = await runConformanceSuite(() => new MarkdownSource(), config);
  if (!report.ok) console.error(formatConformanceReport(report));
  assert.ok(report.ok, 'adaptateur non conforme');
});

test('le journal de démonstration est valide de bout en bout', async () => {
  const source = new MarkdownSource();
  await source.init(config, { logger: console, secrets: () => undefined, fetch: globalThis.fetch });

  const articles: Article[] = [];
  for await (const a of source.fetchArticles()) articles.push(a);

  const result = validateBundle({
    publication: await source.fetchPublication(),
    articles,
    authors: await source.fetchAuthors(),
    taxonomies: await source.fetchTaxonomies(),
  });

  if (!result.ok) console.error(formatIssues(result.issues));
  assert.ok(result.ok, 'le contenu de démonstration comporte des erreurs');
});

test('les brouillons sont lus mais restent non publics', async () => {
  const source = new MarkdownSource();
  await source.init(config, { logger: console, secrets: () => undefined, fetch: globalThis.fetch });

  const articles: Article[] = [];
  for await (const a of source.fetchArticles()) articles.push(a);

  const draft = articles.find((a) => a.slug === 'brouillon-budget');
  assert.ok(draft, 'le brouillon devrait être lu par l’adaptateur');
  assert.equal(draft.status, 'draft');
});

test('previousUrls est conservé tel quel', async () => {
  const source = new MarkdownSource();
  await source.init(config, { logger: console, secrets: () => undefined, fetch: globalThis.fetch });

  const articles: Article[] = [];
  for await (const a of source.fetchArticles()) articles.push(a);

  const migrated = articles.find((a) => a.slug === 'radio-campus-cinquante-ans');
  assert.ok(migrated);
  assert.equal(migrated.previousUrls?.length, 2, 'les deux anciennes URL doivent survivre au sync');
});

test('parseFrontMatter sépare correctement les métadonnées du corps', () => {
  const { data, body } = parseFrontMatter('---\ntitle: Test\ntags: [a, b]\n---\n\nCorps du texte.');
  assert.equal(data.title, 'Test');
  assert.deepEqual(data.tags, ['a', 'b']);
  assert.equal(body, 'Corps du texte.');
});

test('parseFrontMatter tolère un fichier sans métadonnées', () => {
  const { data, body } = parseFrontMatter('Juste du texte.');
  assert.deepEqual(data, {});
  assert.equal(body, 'Juste du texte.');
});

test('deriveExcerpt retire le balisage et coupe proprement', () => {
  const out = deriveExcerpt('## Titre\n\nUne **phrase** avec un [lien](http://x). Une deuxième phrase.', 40);
  assert.ok(!out.includes('#') && !out.includes('*') && !out.includes('http'), `balisage résiduel : ${out}`);
  assert.ok(out.length <= 41, `extrait trop long : ${out.length}`);
});

test('derivedId est stable et dépend de son espace de noms', () => {
  assert.equal(derivedId('article', 'a/b'), derivedId('article', 'a/b'));
  assert.notEqual(derivedId('article', 'a/b'), derivedId('media', 'a/b'));
  assert.match(derivedId('article', 'a/b'), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('resolveMedia refuse de sortir du dossier media/', async () => {
  const source = new MarkdownSource();
  await source.init(config, { logger: console, secrets: () => undefined, fetch: globalThis.fetch });
  await assert.rejects(
    () => source.resolveMedia({
      id: 'x', kind: 'image', src: '/media/../../../../etc/passwd', alt: 'x',
      source: { backend: 'markdown', backendId: 'x', fetchedAt: new Date().toISOString() },
    }),
    /hors du dossier media/,
  );
});
