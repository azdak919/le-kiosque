'use strict';

const LEAD_MIN_WIDTH = 720;
const LEAD_MIN_HEIGHT = 405;
const LEAD_MIN_PIXELS = 320_000;

function meetsLeadDisplaySize(width = 0, height = 0) {
  const ratio = width / Math.max(height, 1);
  const pixels = width * height;
  return (
    width >= LEAD_MIN_WIDTH
    && height >= LEAD_MIN_HEIGHT
    && pixels >= LEAD_MIN_PIXELS
    && ratio >= 0.95
    && ratio <= 2.6
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Probe remote image size via range/head fetch + SOF markers (JPEG/PNG/WebP). */
async function probeRemoteImageSize(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Le-Kiosque-StockPhoto/1.0 (student media; https://github.com/azdak919/le-kiosque)',
        Range: 'bytes=0-65535',
      },
      redirect: 'follow',
    });
    if (!res.ok && res.status !== 206) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return parseImageSize(buf);
  } catch {
    return null;
  }
}

function parseImageSize(buf) {
  if (!buf || buf.length < 24) return null;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      if (marker === 0xd8 || marker === 0xd9) { i += 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      i += 2 + len;
    }
    return null;
  }
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  // WebP RIFF
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    // VP8X
    if (buf.toString('ascii', 12, 16) === 'VP8X' && buf.length >= 30) {
      const w = 1 + buf[24] + (buf[25] << 8) + (buf[26] << 16);
      const h = 1 + buf[27] + (buf[28] << 8) + (buf[29] << 16);
      return { width: w, height: h };
    }
  }
  return null;
}

module.exports = {
  meetsLeadDisplaySize,
  probeRemoteImageSize,
  sleep,
  LEAD_MIN_WIDTH,
  LEAD_MIN_HEIGHT,
  LEAD_MIN_PIXELS,
  parseImageSize,
};
