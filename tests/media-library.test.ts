import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { validateSharedMedia } from '../packages/core/src/validate.ts';
import { readSharedMediaManifest } from '../packages/pipeline/src/shared-media.ts';
import { mastheadOptions } from '../packages/theme-radar/src/templates.ts';

const DEMO = path.resolve(fileURLToPath(new URL('../examples/demo-journal', import.meta.url)));

test('la banque photo de démonstration est locale, attribuée et recadrable', async () => {
  const manifest = await readSharedMediaManifest(DEMO);
  assert.ok(manifest);
  assert.ok(manifest.media.length >= 40, `attendu ≥40 médias, reçu ${manifest.media.length}`);
  // Garde-fou anti-régression navigateur : le parcours Playwright lit le seed, pas un
  // entier magique. Si ce test passe et que le seed build suit le manifest,
  // `toHaveCount(50)` ne doit plus jamais réapparaître.
  const navSpec = await readFile(path.join(DEMO, '../../tests/navigateur/demo-local.spec.js'), 'utf8');
  assert.match(navSpec, /demoSeedMediaCount|seed\.media/, 'le test navigateur doit lire le seed pour le compte médias');
  assert.doesNotMatch(
    navSpec,
    /\.media-card'\)\)\.toHaveCount\(\d+\)/,
    'le test navigateur ne doit pas figer toHaveCount(N) sur .media-card',
  );
  assert.match(manifest.notice, /campus réels|scènes réels/i);
  assert.match(manifest.notice, /ne représentent pas/i);

  const masthead = manifest.media.filter((media) => media.usages?.includes('masthead'));
  const articles = manifest.media.filter((media) => media.src.includes('/articles/'));
  assert.ok(masthead.length >= 14, 'le mât doit avoir plusieurs fonds HD');
  assert.ok(articles.length >= 28, 'les articles doivent avoir des photos thématiques locales');

  for (const [index, media] of manifest.media.entries()) {
    assert.deepEqual(validateSharedMedia(media, `media[${index}]`).filter((issue) => issue.level === 'error'), []);
    assert.ok(media.src.startsWith('/media/demo-library/'));
    assert.ok((media.width ?? 0) >= 1000, `${media.src} trop étroite`);
    const bytes = await readFile(path.join(DEMO, media.src));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), media.checksum);
  }
});

test('aucun article publié de la démo n’utilise un lead SVG fictif', async () => {
  const { readdir, readFile: rf } = await import('node:fs/promises');
  const root = path.join(DEMO, 'content/articles');
  async function walk(dir: string): Promise<string[]> {
    const out: string[] = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...await walk(full));
      else if (entry.name.endsWith('.md')) out.push(full);
    }
    return out;
  }
  const files = await walk(root);
  let published = 0;
  for (const file of files) {
    const text = await rf(file, 'utf8');
    if (!/^status:\s*published/m.test(text)) continue;
    published += 1;
    const lead = text.match(/^lead:\n((?:  .*\n)*)/m)?.[1] ?? '';
    assert.ok(lead, `${file} sans lead`);
    assert.doesNotMatch(lead, /\.svg\b/, `${file} a encore un lead SVG`);
    assert.match(lead, /demo-library\/articles\/.+\.jpg/, `${file} lead hors banque articles`);
  }
  assert.ok(published >= 15, `trop peu d’articles publiés (${published})`);
});

test('le contrat de masthead borne le voile et dérive le point focal', () => {
  const publication = {
    name: 'Le Quorum', tagline: 'Signature', institution: 'Cégep fictif', theme: { accent: '#123456' },
    masthead: { overlayStrength: 8, textAlignment: 'right' as const, backgrounds: { enabled: true, images: [{
      id: 'image', kind: 'image' as const, src: '/media/image.jpg', alt: 'Image', focalPoint: { x: 123, y: -4 },
      source: { backend: 'test', backendId: 'image', fetchedAt: '2026-07-27T00:00:00Z' },
    }] } },
  } as Parameters<typeof mastheadOptions>[0];
  const options = mastheadOptions(publication);
  assert.equal(options.backgroundPosition, '100% 0%');
  assert.equal(options.overlayStrength, 0.9);
  assert.equal(options.textAlignment, 'right');
  assert.equal(options.theme, publication.theme);
});
