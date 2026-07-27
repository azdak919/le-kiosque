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
  assert.equal(manifest.media.length, 6);
  assert.match(manifest.notice, /campus réels/i);
  assert.match(manifest.notice, /ne représentent pas/i);

  for (const [index, media] of manifest.media.entries()) {
    assert.deepEqual(validateSharedMedia(media, `media[${index}]`).filter((issue) => issue.level === 'error'), []);
    assert.ok(media.src.startsWith('/media/demo-library/'));
    const bytes = await readFile(path.join(DEMO, media.src));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), media.checksum);
  }
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
