// Qualité du flux Atom : XML valide, titres « Média – Auteur : Titre », pas de doublon.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { atomFeed, feedEntryTitle, stripInvalidXml } from '../packages/pipeline/src/build.ts';

test('titre « Média – Auteur : Titre »', () => {
  assert.equal(feedEntryTitle('Le Délit', ['Héloïse Durning'], 'Le 17 octobre'), 'Le Délit – Héloïse Durning\u00A0: Le 17 octobre');
  assert.equal(feedEntryTitle('Le Délit', ['Le Délit'], 'Le Délit : Édito'), 'Le Délit\u00A0: Édito');
  assert.equal(feedEntryTitle('Le Délit', ['La rédaction'], 'Édito'), 'Le Délit\u00A0: Édito');
  assert.equal(feedEntryTitle('The Link', [], 'News', 'en-CA'), 'The Link: News');
  assert.equal(stripInvalidXml('énormi\u0002té'), 'énormité');
});

test('flux : XML propre, pas de doublon, format sur toutes les entrées', () => {
  const art = (id: string, title: string, authors: string[] = ['ana']) => ({
    id, title, authors, canonicalUrl: `https://ex.org/${id}/`, updatedAt: '2026-10-31T12:00:00Z',
    publishedAt: '2026-10-31T12:00:00Z', excerpt: `Une brève\u0002 propre pour ${id}.`,
  });
  const bundle = {
    publication: { name: 'Le Journal', lang: 'fr-CA', siteUrl: 'https://ex.org', institution: 'Cégep' },
    authors: [{ slug: 'ana', name: 'Ana B.' }], syncedAt: '2026-10-31T12:00:00Z',
  } as never;
  const xml = atomFeed(bundle, [art('a', 'Un'), art('a', 'Un'), art('b', 'Deux', [])] as never, 30);
  assert.ok(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(xml));
  const titles = [...xml.matchAll(/<entry>[\s\S]*?<title>([^<]*)<\/title>/g)].map((m) => m[1]);
  assert.deepEqual(titles, ['Le Journal – Ana B.\u00A0: Un', 'Le Journal\u00A0: Deux']);
  for (const t of titles) assert.match(t, /^Le Journal( – [^:]+)?\u00A0: \S/);
  assert.equal(new Set(titles).size, titles.length);
});
