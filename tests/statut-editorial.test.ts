/**
 * LE KIOSQUE — le statut éditorial tient-il ses promesses ?
 *
 * Ce fichier ne teste pas une fonctionnalité, il teste une garantie de
 * confidentialité : **un article non publié n'existe nulle part**. Chaque
 * sortie du build est vérifiée une par une, parce qu'il suffit d'un seul
 * oubli — un flux, un index de recherche, un JSON-LD — pour qu'un brouillon
 * de la rédaction se retrouve public.
 *
 * L'absence s'assère. Elle ne se suppose pas.
 */

import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createSourceContext } from '../packages/core/src/source.ts';
import {
  isListed,
  hasPublicPage,
  CMS_STATUSES,
  type Article,
  type ContentBundle,
  type EditorialStatus,
} from '../packages/core/src/model.ts';
import { validateArticle } from '../packages/core/src/validate.ts';
import { MarkdownSource } from '../packages/adapters/markdown/src/index.ts';
import { build } from '../packages/pipeline/src/build.ts';
import { sync } from '../packages/pipeline/src/sync.ts';
import type { KiosqueConfig } from '../packages/pipeline/src/config.ts';

const DEMO = path.resolve(fileURLToPath(new URL('../examples/demo-journal', import.meta.url)));
const silent = { info: () => {}, warn: () => {}, error: () => {} };

async function scratch(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kiosque-statut-'));
  await cp(path.join(DEMO, 'content'), path.join(dir, 'content'), { recursive: true });
  await cp(path.join(DEMO, 'media'), path.join(dir, 'media'), { recursive: true });
  return dir;
}

async function readMirror(root: string): Promise<ContentBundle> {
  const source = new MarkdownSource();
  await source.init({ root }, createSourceContext({ logger: silent }));
  const articles: Article[] = [];
  for await (const a of source.fetchArticles()) articles.push(a);
  return {
    publication: await source.fetchPublication(),
    authors: await source.fetchAuthors(),
    taxonomies: await source.fetchTaxonomies(),
    articles,
    syncedAt: new Date().toISOString(),
  };
}

const configFor = (root: string): KiosqueConfig => ({
  root,
  source: { adapter: 'markdown', options: { root } },
});

/** Toutes les sorties textuelles du site, aplaties. */
async function allOutput(outDir: string): Promise<string> {
  const chunks: string[] = [];
  async function walk(dir: string): Promise<void> {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (/\.(html|xml|json|txt)$/.test(e.name)) chunks.push(await readFile(full, 'utf8'));
    }
  }
  await walk(outDir);
  return chunks.join('\n');
}

// ---------------------------------------------------------------------------

test('le CMS n’expose que trois statuts', () => {
  assert.deepEqual([...CMS_STATUSES], ['draft', 'in-review', 'published']);
});

test('les deux notions de visibilité sont bien distinctes', () => {
  const base = { authors: [], categories: [], tags: [] } as unknown as Article;
  const withStatus = (status: EditorialStatus) => ({ ...base, status });

  // Dans les listes : « publié » et rien d'autre.
  assert.equal(isListed(withStatus('published')), true);
  for (const s of ['draft', 'in-review', 'scheduled', 'archived', 'retracted'] as EditorialStatus[]) {
    assert.equal(isListed(withStatus(s)), false, `« ${s} » ne doit pas apparaître dans les listes`);
  }

  // Une page à son URL : « publié » et « archivé ».
  assert.equal(hasPublicPage(withStatus('published')), true);
  assert.equal(hasPublicPage(withStatus('archived')), true, 'un article archivé garde son adresse');
  for (const s of ['draft', 'in-review', 'scheduled', 'retracted'] as EditorialStatus[]) {
    assert.equal(hasPublicPage(withStatus(s)), false, `« ${s} » ne doit avoir aucune page`);
  }
});

test('un article non publié n’apparaît dans AUCUNE sortie', async (t) => {
  const root = await scratch();
  t.after(() => rm(root, { recursive: true, force: true }));

  // Un brouillon et un article en révision, tous deux reconnaissables.
  await writeFile(
    path.join(root, 'content/articles/2026/10/secret-revision.md'),
    [
      '---',
      'id: 018f2c1a-7b3e-5000-9a4d-2f1e5c8b0d44',
      'title: ENQUETESECRETE sur le conseil',
      'slug: secret-revision',
      'status: in-review',
      'updatedAt: 2026-10-05T10:00:00Z',
      'authors: [marie-tremblay]',
      'section: actualites',
      'lang: fr-CA',
      '---',
      '',
      'Contenu confidentiel MOTDEPASSETEST en cours de révision.',
    ].join('\n'),
    'utf8',
  );

  const bundle = await readMirror(root);
  const out = path.join(root, 'dist');
  await build({ config: configFor(root), bundle, outDir: out, logger: silent });

  const everything = await allOutput(out);

  for (const trace of ['ENQUETESECRETE', 'MOTDEPASSETEST', 'secret-revision', 'brouillon-budget', 'peigne fin']) {
    assert.ok(
      !everything.includes(trace),
      `« ${trace} » fuit dans une sortie publique — brouillon ou article en révision exposé`,
    );
  }
});

test('une URL devinée ne donne accès à rien', async (t) => {
  const root = await scratch();
  t.after(() => rm(root, { recursive: true, force: true }));

  const bundle = await readMirror(root);
  const out = path.join(root, 'dist');
  await build({ config: configFor(root), bundle, outDir: out, logger: silent });

  // Le brouillon du journal de démonstration a un slug parfaitement devinable.
  await assert.rejects(
    () => readFile(path.join(out, 'articles/brouillon-budget/index.html'), 'utf8'),
    'aucune page ne doit exister à l’URL d’un brouillon',
  );
});

test('un article archivé garde sa page mais quitte les listes', async (t) => {
  const root = await scratch();
  t.after(() => rm(root, { recursive: true, force: true }));

  const file = path.join(root, 'content/articles/2026/09/radio-campus-cinquante-ans.md');
  const raw = await readFile(file, 'utf8');
  await writeFile(file, raw.replace('status: published', 'status: archived'), 'utf8');

  const bundle = await readMirror(root);
  const out = path.join(root, 'dist');
  await build({ config: configFor(root), bundle, outDir: out, allowDeletions: true, logger: silent });

  // La page répond toujours : les liens partagés depuis des années survivent.
  const page = await readFile(path.join(out, 'articles/radio-campus-cinquante-ans/index.html'), 'utf8');
  assert.match(page, /cinquante bougies/);

  // Mais l'article ne figure plus au fil ni au flux.
  const home = await readFile(path.join(out, 'index.html'), 'utf8');
  const feed = await readFile(path.join(out, 'feed.xml'), 'utf8');
  assert.ok(!home.includes('cinquante bougies'), 'un article archivé ne doit plus être au fil');
  assert.ok(!feed.includes('cinquante bougies'), 'un article archivé ne doit plus être au flux');

  // Ses redirections restent servies — sinon les anciens liens mourraient.
  const redirect = await readFile(path.join(out, 'blogue/radio-campus-cinquante-ans/index.html'), 'utf8');
  assert.match(redirect, /canonical/);
});

test('un statut inconnu fait échouer sync en nommant le fichier', async (t) => {
  const root = await scratch();
  t.after(() => rm(root, { recursive: true, force: true }));

  const file = path.join(root, 'content/articles/2026/09/assemblee-generale-reconduction.md');
  const raw = await readFile(file, 'utf8');
  await writeFile(file, raw.replace('status: published', 'status: publie'), 'utf8');

  const messages: string[] = [];
  const capture = { ...silent, error: (m: string) => messages.push(m) };

  await assert.rejects(
    () => sync({ config: configFor(root), source: new MarkdownSource() as never, logger: capture }),
    /validation du contenu échouée/,
  );

  const joined = messages.join('\n');
  assert.match(joined, /statut inconnu.*publie/, 'le message doit citer la valeur fautive');
  assert.match(joined, /articles\[\d+\]\.status/, 'le message doit situer le problème');
  assert.match(joined, /draft, in-review/, 'le message doit rappeler les valeurs acceptées');
});

test('publier exige signature, section et date — un brouillon reste libre', () => {
  const bare = {
    id: '018f2c1a-7b3e-5000-9a4d-2f1e5c8b0d55',
    slug: 'incomplet',
    publication: 'demo',
    title: 'Un titre',
    excerpt: '',
    body: { format: 'markdown' as const, raw: 'Du texte.' },
    media: [],
    authors: [],
    categories: [],
    tags: [],
    lang: 'fr-CA',
    updatedAt: '2026-10-01T00:00:00Z',
    canonicalUrl: 'https://exemple.ca/articles/incomplet/',
    source: { backend: 'markdown', backendId: 'x.md', fetchedAt: '2026-10-01T00:00:00Z' },
  };

  // Brouillon : on n'entrave jamais l'écriture.
  const draft = validateArticle({ ...bare, status: 'draft' } as Article);
  assert.equal(draft.filter((i) => i.level === 'error').length, 0, 'un brouillon incomplet doit passer');

  // Publié : on entrave la publication.
  const published = validateArticle({ ...bare, status: 'published' } as Article);
  const errors = published.filter((i) => i.level === 'error').map((i) => i.path);
  assert.ok(errors.some((p) => p.endsWith('.authors')), 'la signature doit être exigée');
  assert.ok(errors.some((p) => p.endsWith('.section')), 'la section doit être exigée');
  assert.ok(errors.some((p) => p.endsWith('.publishedAt')), 'la date doit être exigée');
});
