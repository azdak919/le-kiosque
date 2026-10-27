/**
 * `sync --since` ne voit que le delta. Il ne doit ni réduire l'index qui
 * alimente le garde-fou anti-site-vide, ni oublier les empreintes des médias.
 */
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { MarkdownSource } from '../packages/adapters/markdown/src/index.ts';
import { sync } from '../packages/pipeline/src/sync.ts';
import { readChecksums } from '../packages/pipeline/src/mirror.ts';

const DEMO = path.resolve(fileURLToPath(new URL('../examples/demo-journal', import.meta.url)));
const silent = { info: () => {}, warn: () => {}, error: () => {} };

test('sync --since conserve l’index complet et les empreintes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'kiosque-inc-'));
  await cp(path.join(DEMO, 'content'), path.join(root, 'content'), { recursive: true });
  await cp(path.join(DEMO, 'media'), path.join(root, 'media'), { recursive: true });
  const config = { root, source: { adapter: 'markdown', options: { root } } };

  await sync({ config, source: new MarkdownSource() as never, logger: silent });
  const full = JSON.parse(await readFile(path.join(root, 'content', '.index.json'), 'utf8'));
  const sums = Object.keys(await readChecksums(root)).length;
  assert.ok(full.articles.length > 0);

  // Une date future : le delta est vide, comme un backend sans nouveauté.
  await sync({ config, source: new MarkdownSource() as never, since: '2999-01-01T00:00:00Z', logger: silent });
  const after = JSON.parse(await readFile(path.join(root, 'content', '.index.json'), 'utf8'));
  assert.equal(after.articles.length, full.articles.length);
  assert.equal(after.counts.articles, full.counts.articles);
  assert.equal(Object.keys(await readChecksums(root)).length, sums);
});
