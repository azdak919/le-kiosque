/** Un logo-emblème accompagne le nom du journal ; un logo large le remplace. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateSync } from 'node:zlib';

import { imageSize } from '../packages/pipeline/src/image-size.ts';

function png(width: number, height: number): Buffer {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0); head.writeUInt32BE(height, 4); head[8] = 8; head[9] = 6;
  const chunk = (type: string, data: Buffer) => { const b = Buffer.alloc(8 + data.length + 4); b.writeUInt32BE(data.length, 0); b.write(type, 4, 'ascii'); data.copy(b, 8); return b; };
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', head), chunk('IDAT', deflateSync(Buffer.alloc(1))), chunk('IEND', Buffer.alloc(0))]);
}

test('taille lue dans l’en-tête : PNG, SVG, JPEG', () => {
  assert.deepEqual(imageSize(png(512, 512)), { width: 512, height: 512 });
  assert.deepEqual(imageSize(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 120"></svg>')), { width: 600, height: 120 });
  const jpeg = Buffer.from('ffd8ffe000104a46494600010100000100010000ffc0001108007800a003012200021101031101ffd9', 'hex');
  assert.deepEqual(imageSize(jpeg), { width: 160, height: 120 });
  assert.equal(imageSize(Buffer.from('pas une image')), null);
});
