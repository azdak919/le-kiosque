/**
 * Adaptateur socle éteint, page Mise à jour, questions d'hébergement
 * et lecture d'une archive de journal. Le gabarit reste sur Markdown.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { SocleSource } from '../packages/adapters/socle/src/index.ts';
import * as K from '../packages/config-core/kiosque-config.mjs';
import type { Article, ContentBundle } from '../packages/core/src/model.ts';
import { MarkdownSource } from '../packages/adapters/markdown/src/index.ts';
import { createSourceContext } from '../packages/core/src/source.ts';
import { build } from '../packages/pipeline/src/build.ts';
import { updatePage } from '../packages/theme-radar/src/update-page.ts';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DEMO = path.join(ROOT, 'examples/demo-journal');
const silent = { info: () => {}, warn: () => {}, error: () => {} };
const COURRIEL = 'membre-secret@journal-exemple.invalid';

function dword(value: number): number[] {
  return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255];
}
function word(value: number): number[] {
  return [value & 255, (value >>> 8) & 255];
}
function crc32(bytes: Uint8Array): number {
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let b = 0; b < 8; b++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}
function zipStore(entries: Array<[string, string]>): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  let offset = 0;
  const central: Uint8Array[] = [];
  for (const [fileName, text] of entries) {
    const name = enc.encode(fileName);
    const data = enc.encode(text);
    const sum = crc32(data);
    const local = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04, ...word(20), ...word(0), ...word(0), ...word(0), ...word(0),
      ...dword(sum), ...dword(data.length), ...dword(data.length), ...word(name.length), ...word(0),
    ]);
    parts.push(local, name, data);
    central.push(new Uint8Array([
      0x50, 0x4b, 0x01, 0x02, ...word(20), ...word(20), ...word(0), ...word(0), ...word(0), ...word(0),
      ...dword(sum), ...dword(data.length), ...dword(data.length), ...word(name.length), ...word(0),
      ...word(0), ...word(0), ...word(0), ...dword(0), ...dword(offset),
    ]), name);
    offset += local.length + name.length + data.length;
  }
  const locals = join(parts);
  const directory = join(central);
  const end = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06, ...word(0), ...word(0), ...word(entries.length), ...word(entries.length),
    ...dword(directory.length), ...dword(locals.length), ...word(0),
  ]);
  return join([locals, directory, end]);
}
function join(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) { out.set(part, cursor); cursor += part.length; }
  return out;
}

test('build n’importe ni un adaptateur ni le serveur du socle ; le gabarit reste markdown', async () => {
  const buildSrc = await readFile(path.join(ROOT, 'packages/pipeline/src/build.ts'), 'utf8');
  assert.doesNotMatch(buildSrc, /adapters\//);
  // Du socle, le build ne prend que l'admin (page et fichiers), copiée dans
  // le site : aucun journal ne dépend d'un serveur pour être lu.
  const bridge = await readFile(path.join(ROOT, 'packages/theme-radar/src/local-admin.ts'), 'utf8');
  for (const source of [buildSrc, bridge]) {
    assert.doesNotMatch(source, /le-socle\/src|from 'le-socle'/);
    for (const [, spec] of source.matchAll(/from '(le-socle[^']*)'/g)) assert.match(spec, /^le-socle\/admin\//);
  }
  const template = await readFile(path.join(ROOT, 'template/kiosque.config.ts'), 'utf8');
  const demo = await readFile(path.join(ROOT, 'examples/demo-journal/kiosque.config.ts'), 'utf8');
  assert.doesNotMatch(template, /adapter:\s*'socle'/);
  assert.doesNotMatch(demo, /adapter:\s*'socle'/);
  assert.match(template, /adapter:\s*'markdown'/);
  const serveur = K.kiosqueConfigTs(K.completer({
    name: 'La Gazette', institution: 'Cégep du Nord', accent: '#8a1538', sections: 'Actualités', hebergement: 'serveur',
  }));
  // Sans adresse de socle, le journal reste sur Markdown.
  assert.match(serveur, /adapter: 'markdown'/);
  assert.doesNotMatch(serveur, /adapter: 'socle'/);
  const avecSocle = K.kiosqueConfigTs(K.completer({
    name: 'La Gazette', institution: 'Cégep du Nord', sections: 'Actualités', hebergement: 'serveur', socleUrl: 'https://journal.cegep.example/socle/',
  }));
  assert.match(avecSocle, /adapter: 'socle', options: \{ baseUrl: "https:\/\/journal\.cegep\.example\/socle" \}/);
  assert.match(avecSocle, /mode: 'external'/);
});

test('le configurateur : adresse déduite du dépôt, logo dans l’archive, catégories des sections, vraies vérifications', () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const vide = K.completer({ name: 'La Girouette', institution: 'Cégep fictif', sections: 'Campus\nCulture' });
  assert.equal(vide.demoContent, false);
  assert.ok(K.aVerifier(vide).length >= 2, 'dépôt et courriel manquants sont signalés');
  const c = K.completer({
    name: 'La Girouette', institution: 'Cégep fictif', sections: 'Campus\nCulture', repository: 'azdak919/la-girouette',
    contact: 'redaction@girouette.example', noindex: true, logo: { src: `data:image/png;base64,${png}` },
  });
  assert.equal(c.siteUrl, 'https://azdak919.github.io/la-girouette');
  assert.deepEqual(K.aVerifier(c), []);
  const files = K.fichiersKiosque(c);
  const logo = files.find((f) => f.path === 'media/logo.png');
  assert.ok(logo?.bytes?.length, 'le logo est un fichier de l’archive');
  const pub = files.find((f) => f.path === 'content/publication.yml').content;
  assert.match(pub, /noindex: true/);
  assert.match(pub, /src: "\/media\/logo\.png"/);
  assert.match(pub, /contact: "redaction@girouette\.example"/);
  const tax = files.find((f) => f.path === 'content/taxonomies.yml').content;
  assert.match(tax, /slug: "campus"/);
  assert.doesNotMatch(tax, /vie-etudiante|politique/);
  const json = JSON.parse(files.find((f) => f.path === 'kiosque-config.json').content);
  assert.equal(json.gouvernance.contact, 'redaction@girouette.example');
  assert.equal(json.gouvernance.depot, 'https://github.com/azdak919/la-girouette');
  assert.equal(json.options.noindex, true);
  const retour = K.importer(json);
  assert.equal(retour.repository, 'azdak919/la-girouette');
  assert.equal(retour.noindex, true);
});

test('la page Mise à jour nomme Socle et Kiosque et n’appelle pas le réseau', () => {
  const html = updatePage({
    lang: 'fr-CA',
    publicationName: 'La Gazette',
    backHref: '/admin/',
    lines: [
      { id: 'socle', title: 'Socle', installed: '1.0.0', offered: null, notes: '' },
      { id: 'kiosque', title: 'Kiosque', installed: '0.1.0', offered: '0.2.0', notes: '' },
    ],
  });
  assert.match(html, /Socle/);
  assert.match(html, /Kiosque/);
  assert.match(html, /content\/, media\/, theme\/tokens\.css, kiosque\.config\.ts, OWNERS\.md/);
  assert.doesNotMatch(html, /type="password"/);
  assert.doesNotMatch(html, /fetch\s*\(/);
  assert.match(html, /Une majeure attend un oui de plus/);
});

test('le configurateur demande la langue, l’hébergement et l’archive, sans secret', async () => {
  const html = await readFile(path.join(ROOT, 'site/configurer/index.html'), 'utf8');
  assert.match(html, /data-key="langue"/);
  assert.match(html, /data-key="hebergement"/);
  assert.match(html, /value="serveur"/);
  assert.match(html, /data-key="quiPublie"/);
  assert.match(html, /id="restore-zip"/);
  assert.match(html, /id="restore-report"/);
  assert.match(html, /Étape 1 sur 4/);
  assert.match(html, /Étape 4 sur 4/);
  assert.doesNotMatch(html, /type="password"/);
  assert.doesNotMatch(html, /Étape 5 sur/);
});

test('lireArchive signale les années absentes et une session, sans afficher de courriel', () => {
  const site = zipStore([
    ['manifest.json', JSON.stringify({
      kind: 'site',
      includedYears: [2025, 2026],
      excludedYears: [2020],
      note: 'Les années plus anciennes ne sont pas dans ce fichier. Une archive antérieure est supposée les contenir. Ce programme ne peut pas le vérifier.',
    })],
    ['content/articles/une.md', '# Une'],
    ['content/articles/une.json', '{"id":"une"}'],
    ['html/une.html', '<p>Une</p>'],
    ['media/photo.jpg', 'octets'],
    ['auth/members.json', JSON.stringify([{ email: COURRIEL }])],
  ]);
  const lu = K.lireArchive(site);
  assert.equal(lu.ok, true);
  assert.equal(lu.kind, 'site');
  assert.deepEqual(lu.excludedYears, [2020]);
  assert.equal(lu.articles, 1);
  assert.match(lu.message, /ne peut pas le vérifier/);
  assert.match(lu.message, /ne sont pas affichées/);
  assert.doesNotMatch(JSON.stringify(lu), new RegExp(COURRIEL));

  const session = zipStore([
    ['manifest.json', JSON.stringify({ kind: 'session', session: 'automne', includedYears: [2026] })],
    ['content/articles/deux.md', '# Deux'],
    ['html/deux.html', '<p>Deux</p>'],
  ]);
  const seance = K.lireArchive(session);
  assert.equal(seance.kind, 'session');
  assert.equal(seance.session, 'automne');
  assert.match(seance.message, /ne remplace pas les autres années/);
  assert.match(seance.message, /Articles seulement/);

  const refus = K.lireArchive(new Uint8Array([1, 2, 3]));
  assert.equal(refus.ok, false);
  assert.match(refus.message, /n’est pas une archive de journal/);
});

test('health du socle reste muet tant que le module éditorial est éteint', async () => {
  const source = new SocleSource();
  const ctx = (fetchImpl: typeof fetch) => createSourceContext({ logger: silent, secrets: () => undefined, fetch: fetchImpl });
  await source.init({}, ctx(async () => { throw new Error('réseau'); }));
  assert.deepEqual(
    { ok: (await source.health()).ok, reason: (await source.health()).reason },
    { ok: false, reason: 'not-configured' },
  );

  await source.init({ baseUrl: 'https://journal.example/' }, ctx(async (url) => {
    assert.equal(String(url), 'https://journal.example/v1/health');
    return new Response(JSON.stringify({ modules: { editorial: false } }), { status: 200 });
  }));
  const eteint = await source.health();
  assert.equal(eteint.ok, false);
  assert.equal(eteint.reason, 'module éteint');

  await source.init({ baseUrl: 'https://journal.example' }, ctx(async (url) => {
    const href = String(url);
    if (href.endsWith('/v1/health')) return new Response(JSON.stringify({ modules: { editorial: true } }), { status: 200 });
    if (href.endsWith('/v1/editorial/snapshot')) {
      return new Response(JSON.stringify({
        publication: { name: 'La Gazette' },
        articles: [{ id: 'une', title: 'Une' }],
        authors: [],
        taxonomies: { sections: [], categories: [], tags: [] },
        syncedAt: '2026-11-17T00:00:00.000Z',
      }), { status: 200 });
    }
    return new Response('absent', { status: 404 });
  }));
  assert.equal((await source.health()).ok, true);
  const articles: Article[] = [];
  for await (const article of source.fetchArticles()) articles.push(article);
  assert.equal(articles[0]?.id, 'une');
});

test('le build démo écrit la page Mise à jour et l’admin y mène', async (t) => {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'kiosque-maj-'));
  t.after(() => rm(outDir, { recursive: true, force: true }));
  const source = new MarkdownSource();
  await source.init({ root: DEMO }, createSourceContext({ logger: silent }));
  const articles: Article[] = [];
  for await (const article of source.fetchArticles()) articles.push(article);
  const bundle: ContentBundle = {
    publication: await source.fetchPublication(),
    authors: await source.fetchAuthors(),
    taxonomies: await source.fetchTaxonomies(),
    articles,
    syncedAt: '2026-11-17T00:00:00.000Z',
  };
  await build({
    config: { root: DEMO, source: { adapter: 'markdown' }, editorial: { mode: 'demo-local' }, deploy: { basePath: '' } },
    bundle, outDir, logger: silent,
  });
  const page = await readFile(path.join(outDir, 'admin/mise-a-jour/index.html'), 'utf8');
  const admin = await readFile(path.join(outDir, 'admin/index.html'), 'utf8');
  assert.match(page, /Socle/);
  assert.match(page, /Kiosque/);
  assert.match(page, /1\.0\.0/);
  assert.match(page, /Aucune version proposée/);
  assert.match(admin, /href="\/admin\/mise-a-jour\/"/);
  assert.match(admin, /Tableau de bord/);
  // Même coquille que l'admin : barre latérale, feuille admin, entrée active.
  assert.match(page, /class="admin-sidebar"/);
  assert.match(page, /href="\/assets\/kiosque-admin\.css"/);
  assert.match(page, /data-nav="update" aria-current="page"/);
  assert.match(page, /href="\/admin\/#articles"/);
  assert.match(page, /pull request « Mise à jour de la plateforme »/);
  await readFile(path.join(outDir, 'assets/kiosque-admin.css'), 'utf8');
});

test('la mise à jour de plateforme du gabarit vise le vrai dépôt amont', async () => {
  const workflow = await readFile(path.join(ROOT, '.github/workflows/maj-plateforme.yml'), 'utf8');
  assert.match(workflow, /https:\/\/github\.com\/azdak919\/le-kiosque\.git/);
  assert.doesNotMatch(workflow, /github\.com\/kiosque\/kiosque/);
});

test('un journal créé depuis le gabarit ne publie que lui-même', async () => {
  const dir = path.join(ROOT, '.github/workflows');
  const amont = ['verification.yml', 'veille.yml', 'dependabot-automerge.yml'];
  const journal = ['publier.yml', 'maj-socle.yml', 'maj-plateforme.yml'];
  for (const name of amont) {
    const wf = await readFile(path.join(dir, name), 'utf8');
    assert.match(wf, /github\.repository == 'azdak919\/le-kiosque'/, `${name} ne tourne que dans le dépôt amont`);
  }
  for (const name of journal) {
    const wf = await readFile(path.join(dir, name), 'utf8');
    assert.match(wf, /github\.repository != 'azdak919\/le-kiosque'/, `${name} ne tourne que dans un journal`);
    assert.doesNotMatch(wf, /--force/, `${name} ne pousse jamais de force`);
  }
  const plateforme = await readFile(path.join(dir, 'maj-plateforme.yml'), 'utf8');
  assert.doesNotMatch(plateforme, /git merge upstream/, 'un dépôt « Use this template » ne partage pas d’historique avec l’amont');
  assert.match(plateforme, /maj-plateforme\.sh/);
});
