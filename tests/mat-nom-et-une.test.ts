import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  isGeneratedInitialsLogo,
  usablePublicationLogo,
} from '../packages/theme-radar/src/generated-logo.js';
import { magazineFeedHtml, wordmarkInner, type RenderContext } from '../packages/theme-radar/src/templates.ts';
import type { Article, Publication } from '../packages/core/src/model.ts';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const FIX = (name: string) => path.join(ROOT, 'tests/fixtures', name);

function dataPng(file: string): string {
  return `data:image/png;base64,${readFileSync(FIX(file)).toString('base64')}`;
}

function logo(file: string, extra: Record<string, unknown> = {}) {
  return { id: 'logo', kind: 'image' as const, src: dataPng(file), alt: 'La Vigie', ...extra };
}

test('un monogramme d’initiales n’est pas un logo ; un vrai fichier l’est', () => {
  const mono = logo('monogramme-initiales.png');
  assert.equal(isGeneratedInitialsLogo(mono, undefined, inflateSync), true);
  assert.equal(usablePublicationLogo(mono, undefined, inflateSync), undefined);

  const wide = logo('logo-mot.png');
  assert.equal(isGeneratedInitialsLogo(wide, undefined, inflateSync), false);
  assert.equal(usablePublicationLogo(wide, undefined, inflateSync)?.src, wide.src);

  const gradient = logo('badge-degrade.png');
  assert.equal(isGeneratedInitialsLogo(gradient, undefined, inflateSync), false);

  const liveLike = {
    ...mono,
    source: { backend: 'socle', backendId: 'kiosque-config.json', fetchedAt: '2026-11-18T21:06:13.849Z' },
  };
  assert.equal(isGeneratedInitialsLogo(liveLike, undefined, inflateSync), true);
});

const publication = {
  id: 'p1',
  slug: 'la-vigie',
  name: 'La Vigie',
  institution: 'Cégep de l’exemple',
  institutionType: 'cegep',
  lang: 'fr-CA',
  siteUrl: 'https://vigie.example',
  timeZone: 'America/Toronto',
  theme: { accent: '#0d3b66' },
  governance: { owner: 'L’association' },
} as Publication;

function ctx(logoSrc?: ReturnType<typeof logo>): RenderContext {
  return {
    publication: { ...publication, logo: logoSrc },
    basePath: '',
    taxonomies: { sections: [], categories: [], tags: [] },
    authorsBySlug: new Map(),
    buildYear: 2026,
  };
}

function article(id: string, title: string, featured = false): Article {
  return {
    id,
    slug: id,
    publication: 'la-vigie',
    title,
    excerpt: 'Résumé.',
    body: { format: 'markdown', raw: 'Corps.' },
    media: [],
    authors: [],
    categories: [],
    tags: [],
    lang: 'fr-CA',
    status: 'published',
    updatedAt: '2026-11-18T12:00:00.000Z',
    publishedAt: '2026-11-18T12:00:00.000Z',
    canonicalUrl: `https://vigie.example/articles/${id}/`,
    source: { backend: 'markdown', backendId: id, fetchedAt: '2026-11-18T12:00:00.000Z' },
    featured: featured || undefined,
  };
}

test('sans logo, ou avec un monogramme stocké, le mât montre le nom en caractères de journal', () => {
  const empty = wordmarkInner({ name: 'La Vigie' }, ctx());
  assert.match(empty, /<span class="wordmark-name">La Vigie<\/span>/);
  assert.doesNotMatch(empty, /publication-logo/);

  const generated = wordmarkInner({ name: 'La Vigie', logo: logo('monogramme-initiales.png') }, ctx());
  assert.match(generated, /<span class="wordmark-name">La Vigie<\/span>/);
  assert.doesNotMatch(generated, /publication-logo/);

  const real = wordmarkInner({ name: 'La Vigie', logo: logo('logo-mot.png') }, ctx());
  assert.match(real, /<img class="publication-logo"/);
  assert.doesNotMatch(real, /wordmark-name/);
});

test('« À la une » seulement pour une vraie sélection, qui prend alors la manchette', () => {
  const first = article('a1', 'Premier paru');
  const second = article('a2', 'Second paru');
  const without = magazineFeedHtml([first, second], ctx(), { heroLabel: 'Le fil étudiant', empty: 'Aucun article.' });
  assert.match(without, /Premier paru/);
  assert.doesNotMatch(without, /À la une/);
  assert.doesNotMatch(without, /article-eyebrow/);

  const picked = magazineFeedHtml(
    [first, { ...second, featured: true }],
    ctx(),
    { heroLabel: 'Le fil étudiant', empty: 'Aucun article.' },
  );
  assert.match(picked, /<span class="article-eyebrow">À la une<\/span>/);
  const leadAt = picked.indexOf('article--lead');
  const uneTitle = picked.indexOf('Second paru');
  const firstTitle = picked.indexOf('Premier paru');
  assert.ok(leadAt !== -1 && uneTitle !== -1 && uneTitle > leadAt && uneTitle < firstTitle);
});

test('le configurateur ne fabrique pas de logo à initiales', () => {
  const src = readFileSync(path.join(ROOT, 'site/configurer/configurateur.js'), 'utf8');
  assert.match(src, /on ne dessine jamais d’initiales/);
  assert.doesNotMatch(src, /fillText/);
  assert.doesNotMatch(src, /toDataURL/);
});
