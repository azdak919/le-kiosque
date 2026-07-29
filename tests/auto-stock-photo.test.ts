/**
 * Option publication.media.autoStockPhoto — lecture YAML + CMS.
 */

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { MarkdownSource } from '../packages/adapters/markdown/src/index.ts';
import { createSourceContext } from '../packages/core/src/source.ts';
import { buildCmsConfig } from '../packages/pipeline/src/cms-config.ts';

const silent = { info: () => {}, warn: () => {}, error: () => {} };

test('publication.yml lit media.autoStockPhoto', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'kiosque-autostock-'));
  try {
    const content = path.join(dir, 'content');
    await mkdir(content, { recursive: true });
    await writeFile(
      path.join(content, 'publication.yml'),
      `slug: test-journal
name: Test
institution: Cégep
institutionType: cegep
lang: fr-CA
siteUrl: https://example.invalid
timeZone: America/Toronto
theme:
  accent: '#123456'
media:
  autoStockPhoto: true
governance:
  owner: org
  contact: a@b.c
  repo: https://github.com/x/y
`,
    );
    const source = new MarkdownSource();
    await source.init({ root: dir }, createSourceContext({ logger: silent }));
    const pub = await source.fetchPublication();
    assert.equal(pub.media?.autoStockPhoto, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Sveltia expose le booléen autoStockPhoto', () => {
  const cfg = buildCmsConfig({
    config: { root: '.', source: { adapter: 'markdown' }, deploy: { basePath: '' } },
    bundle: {
      publication: {
        id: 'p',
        slug: 'j',
        name: 'J',
        institution: 'C',
        institutionType: 'cegep',
        lang: 'fr-CA',
        siteUrl: 'https://example.invalid',
        timeZone: 'America/Toronto',
        theme: { accent: '#123' },
        governance: { owner: 'o', contact: 'a@b.c', repo: 'https://github.com/o/r' },
      },
      authors: [],
      taxonomies: { sections: [], categories: [], tags: [] },
      articles: [],
      syncedAt: new Date().toISOString(),
    },
  });
  const json = JSON.stringify(cfg);
  assert.match(json, /autoStockPhoto/);
  assert.match(json, /Proposer une photo libre/);
});
