/**
 * Fiche distante complétée, logo `data:` posé en fichier, index stable.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { bodyMedia, normalizeRemote } from '../packages/pipeline/src/remote-normalize.ts';
import { writeIndex } from '../packages/pipeline/src/mirror.ts';
import type { ContentBundle } from '../packages/core/src/model.ts';

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function bundle(): ContentBundle {
  return {
    publication: {
      slug: 'mon-journal', name: 'La Girouette', siteUrl: '', timeZone: 'America/Toronto', lang: 'fr-CA',
      theme: { accent: '#0a5' }, governance: { owner: '', contact: '' },
      logo: { src: `data:image/png;base64,${PNG}`, alt: 'Logo' },
    } as never,
    articles: [{ id: 'a', slug: 'bonjour', publication: 'mon-journal', canonicalUrl: '/bonjour', title: 'Bonjour', body: { format: 'html', raw: '<p><img src="/media/x/y.jpg" alt=""></p>' } } as never],
    authors: [],
    taxonomies: { sections: [], categories: [], tags: [] },
    syncedAt: '2026-11-18T15:00:00.000Z',
  };
}

test('une fiche distante incomplète est complétée par publication.yml, sans réenregistrer', () => {
  const local = { slug: 'la-girouette', siteUrl: 'https://azdak919.github.io/la-girouette', noindex: true, governance: { owner: 'Cégep fictif', contact: 'redaction@example.org' } };
  const { bundle: out, logoFile } = normalizeRemote(bundle(), local);
  assert.equal(out.publication.slug, 'la-girouette');
  assert.equal(out.publication.siteUrl, 'https://azdak919.github.io/la-girouette');
  assert.equal(out.publication.noindex, true);
  assert.equal(out.publication.governance.owner, 'Cégep fictif');
  assert.equal(out.articles[0].canonicalUrl, 'https://azdak919.github.io/la-girouette/articles/bonjour/');
  assert.equal(out.articles[0].publication, 'la-girouette');
  assert.equal(out.publication.logo?.src, '/media/logo.png');
  assert.equal(logoFile?.src, '/media/logo.png');
  assert.equal(logoFile?.bytes[1], 0x50);
});

test('une valeur remplie dans le socle l’emporte sur publication.yml', () => {
  const b = bundle();
  b.publication.siteUrl = 'https://journal.example.org';
  b.publication.slug = 'girouette';
  const { bundle: out } = normalizeRemote(b, { slug: 'autre', siteUrl: 'https://ailleurs.example' });
  assert.equal(out.publication.slug, 'girouette');
  assert.equal(out.publication.siteUrl, 'https://journal.example.org');
});

test('les photos du texte sont repérées pour être rapatriées', () => {
  assert.deepEqual(bodyMedia('<img src="/media/a.jpg"> ![x](/media/b.png) <img src="https://ailleurs/c.jpg">'), ['/media/a.jpg', '/media/b.png']);
});

test('l’index garde sa date quand rien n’a changé (pas de commit du robot)', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'kiosque-index-'));
  try {
    const b = normalizeRemote(bundle(), { slug: 'la-girouette', siteUrl: 'https://x.example' }).bundle;
    await writeIndex(root, b);
    const first = await readFile(path.join(root, 'content', '.index.json'), 'utf8');
    await writeIndex(root, { ...b, syncedAt: '2026-11-19T10:00:00.000Z' });
    assert.equal(await readFile(path.join(root, 'content', '.index.json'), 'utf8'), first);
    await writeIndex(root, { ...b, articles: [], syncedAt: '2026-11-19T10:00:00.000Z' });
    assert.match(await readFile(path.join(root, 'content', '.index.json'), 'utf8'), /2026-11-19T10/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('noindex : robots.txt ferme le site et chaque page porte la balise', async () => {
  const { cp, appendFile } = await import('node:fs/promises');
  const { execFileSync } = await import('node:child_process');
  const repo = path.resolve(import.meta.dirname, '..');
  const root = await mkdtemp(path.join(os.tmpdir(), 'kiosque-noindex-'));
  try {
    await cp(path.join(repo, 'template'), root, { recursive: true });
    await appendFile(path.join(root, 'content', 'publication.yml'), '\nnoindex: true\n');
    execFileSync(process.execPath, [path.join(repo, 'packages/pipeline/src/cli.ts'), 'build', '--root', root], { stdio: 'pipe' });
    assert.equal(await readFile(path.join(root, 'dist', 'robots.txt'), 'utf8'), 'User-agent: *\nDisallow: /\n');
    const home = await readFile(path.join(root, 'dist', 'index.html'), 'utf8');
    assert.match(home, /<meta name="robots" content="noindex, nofollow">/);
    assert.match(home, /prefers-color-scheme: dark\)\{:root:not\(\[data-theme="light"\]\)\{--accent:/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
