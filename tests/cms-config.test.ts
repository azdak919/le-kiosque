/**
 * LE KIOSQUE — la configuration du CMS reste-t-elle fidèle au modèle ?
 *
 * Le test central de ce fichier est l'anti-dérive : **tout champ que le modèle
 * écrit dans le front-matter doit être déclaré dans la configuration du CMS.**
 *
 * Pourquoi c'est vital plutôt que pédant : les CMS de la famille Decap
 * re-sérialisent l'entrée depuis les champs déclarés. Une clé absente de la
 * configuration risque d'être SUPPRIMÉE à la première sauvegarde. Le jour où
 * quelqu'un ajoute un champ au modèle et oublie la configuration, le CMS
 * commencerait à effacer silencieusement des données — à commencer par l'`id`,
 * c'est-à-dire l'identité permanente des articles.
 *
 * Ce test échoue à la place.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { createSourceContext } from '../packages/core/src/source.ts';
import { CMS_STATUSES, type Article, type ContentBundle } from '../packages/core/src/model.ts';
import { MarkdownSource } from '../packages/adapters/markdown/src/index.ts';
import { buildCmsConfig, repoSlug } from '../packages/pipeline/src/cms-config.ts';
import type { KiosqueConfig } from '../packages/pipeline/src/config.ts';

const DEMO = path.resolve(fileURLToPath(new URL('../examples/demo-journal', import.meta.url)));
const silent = { info: () => {}, warn: () => {}, error: () => {} };

async function demoBundle(): Promise<ContentBundle> {
  const source = new MarkdownSource();
  await source.init({ root: DEMO }, createSourceContext({ logger: silent }));
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

const configFor = (root: string, extra: Partial<KiosqueConfig> = {}): KiosqueConfig => ({
  root,
  source: { adapter: 'markdown', options: { root } },
  ...extra,
});

interface Field {
  name: string;
  widget?: string;
  required?: boolean;
  fields?: Field[];
  options?: Array<{ value: string }>;
}
interface Collection {
  name: string;
  folder: string;
  fields: Field[];
}

async function collections(): Promise<Collection[]> {
  const cfg = buildCmsConfig({ config: configFor(DEMO), bundle: await demoBundle() });
  return cfg.collections as Collection[];
}

const byName = (list: Collection[], name: string): Collection => {
  const found = list.find((c) => c.name === name);
  assert.ok(found, `collection « ${name} » absente`);
  return found;
};

// ---------------------------------------------------------------------------

test('ANTI-DÉRIVE — tout champ écrit par le modèle est déclaré dans le CMS', async () => {
  const articles = byName(await collections(), 'articles');
  const declared = new Set(articles.fields.map((f) => f.name));

  // Extrait des clés réellement écrites par l'adaptateur Markdown, en lisant
  // le front-matter d'un vrai article du journal de démonstration. On teste
  // ce que le système produit, pas ce qu'on croit qu'il produit.
  const raw = await readFile(
    path.join(DEMO, 'content/articles/2026/09/radio-campus-cinquante-ans.md'),
    'utf8',
  );
  const fm = /^---\n([\s\S]*?)\n---/.exec(raw);
  assert.ok(fm, 'front-matter introuvable dans le fichier de démonstration');
  const keys = Object.keys(parseYaml(fm[1]) as Record<string, unknown>);

  for (const key of keys) {
    assert.ok(
      declared.has(key),
      `« ${key} » est écrit dans le front-matter mais n’est pas déclaré dans la configuration du CMS.\n` +
        `  Le CMS risque de l’effacer à la première sauvegarde.\n` +
        `  Ajouter le champ dans packages/pipeline/src/cms-config.ts (widget « hidden » si non éditable).`,
    );
  }

  // Les champs de traçabilité n'apparaissent dans aucun fichier de test, mais
  // doivent être déclarés d'avance : ils seront écrits dès qu'une révision aura
  // lieu, et il serait trop tard pour s'en apercevoir.
  for (const key of ['id', 'previousUrls', 'submittedAt', 'reviewedAt', 'reviewedBy', 'canonicalUrl']) {
    assert.ok(declared.has(key), `« ${key} » doit être déclaré pour ne pas être effacé`);
  }
});

test('l’identifiant permanent est caché et jamais éditable à la main', async () => {
  const articles = byName(await collections(), 'articles');
  const id = articles.fields.find((f) => f.name === 'id');
  assert.ok(id);
  assert.equal(id.widget, 'hidden', 'l’id ne doit jamais être présenté comme modifiable');
});

test('les statuts proposés sont exactement ceux du modèle', async () => {
  const articles = byName(await collections(), 'articles');
  const status = articles.fields.find((f) => f.name === 'status');
  assert.ok(status);
  assert.equal(status.widget, 'select', 'un enum strict, jamais du texte libre');
  assert.equal(status.required, true);
  assert.deepEqual(
    status.options?.map((o) => o.value),
    [...CMS_STATUSES],
  );
});

test('les sections proposées viennent du contenu, pas d’une liste écrite en dur', async () => {
  const bundle = await demoBundle();
  const cfg = buildCmsConfig({ config: configFor(DEMO), bundle });
  const articles = (cfg.collections as Collection[]).find((c) => c.name === 'articles')!;
  const section = articles.fields.find((f) => f.name === 'section');

  assert.deepEqual(
    section?.options?.map((o) => o.value),
    bundle.taxonomies.sections.map((s) => s.slug),
    'la liste doit suivre content/sections/ — sinon elle dérive dès la première section ajoutée',
  );
});

test('le texte alternatif des images est obligatoire', async () => {
  const articles = byName(await collections(), 'articles');
  const lead = articles.fields.find((f) => f.name === 'lead');
  const alt = lead?.fields?.find((f) => f.name === 'alt');

  assert.ok(alt, 'le champ alt doit exister');
  assert.equal(
    alt.required,
    true,
    'l’accessibilité se gagne à la saisie : une image sans description ne doit pas pouvoir être enregistrée',
  );
});

test('les métadonnées de recadrage et de licence sont préservées par le CMS', async () => {
  const articles = byName(await collections(), 'articles');
  const lead = articles.fields.find((field) => field.name === 'lead');
  const names = new Set(lead?.fields?.map((field) => field.name));
  for (const name of ['licenseUrl', 'sourceUrl', 'focalPoint', 'institution', 'campus', 'keywords', 'usages', 'source']) {
    assert.ok(names.has(name), `le champ média « ${name} » doit survivre à une sauvegarde CMS`);
  }
});

test('les options visuelles du masthead sont déclarées dans le CMS', async () => {
  const configuration = byName(await collections(), 'configuration');
  const publication = (configuration as unknown as { files: Array<{ fields: Field[] }> }).files[0];
  const masthead = publication.fields.find((field) => field.name === 'masthead');
  const names = new Set(masthead?.fields?.map((field) => field.name));
  assert.ok(names.has('overlayStrength'));
  assert.ok(names.has('textAlignment'));
});

test('le champ body est en dernier — il représente tout ce qui suit le front-matter', async () => {
  for (const name of ['articles', 'auteurs']) {
    const collection = byName(await collections(), name);
    const last = collection.fields[collection.fields.length - 1];
    assert.equal(last.name, 'body', `« body » doit clore la collection « ${name} »`);
  }
});

test('publish_mode n’est pas déclaré tant que Sveltia ne l’implémente pas', async () => {
  const cfg = buildCmsConfig({ config: configFor(DEMO), bundle: await demoBundle() });
  assert.ok(
    !('publish_mode' in cfg),
    'déclarer une révision par pull request qui n’existe pas induirait la rédaction en erreur',
  );
});

test('public_folder n’inclut PAS le sous-chemin — sinon les images doublent le préfixe', async () => {
  const bundle = await demoBundle();
  const cfg = buildCmsConfig({
    config: configFor(DEMO, { deploy: { basePath: '/le-kiosque' } }),
    bundle,
  });

  // Le front-matter stocke « /media/… » ; c'est le thème qui ajoute le
  // sous-chemin au rendu. L'inclure ici donnerait « /le-kiosque/le-kiosque/… ».
  assert.equal(cfg.public_folder, '/media/{{year}}/{{month}}');
  assert.ok(!String(cfg.public_folder).includes('le-kiosque'));
});

test('le dépôt GitHub est déduit de la gouvernance', async () => {
  const bundle = await demoBundle();
  assert.equal(repoSlug(bundle.publication), 'kiosque-demo/le-quorum');

  // Une gouvernance vide ne doit pas produire une configuration cassée
  // silencieusement : la valeur de repli est visiblement fausse.
  const orphan = { ...bundle.publication, governance: { ...bundle.publication.governance, repo: '' } };
  assert.equal(repoSlug(orphan), 'organisation/depot');
});
