/**
 * Un logo fabriqué automatiquement (cercle aux initiales) n'est pas un logo :
 * sans fichier téléversé, le mât montre le nom du journal. Ce module reconnaît
 * ces monogrammes encore stockés dans des journaux déjà installés.
 *
 * L'assistant et le configurateur ne doivent jamais en fabriquer.
 */

export const MAX_MONOGRAM_BYTES = 32 * 1024;
export const MONOGRAM_SIZES = [256, 512, 1024];

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];

function asBytes(value) {
  if (!value) return null;
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return null;
}

/** Octets d'une adresse data:image/png ; sinon null (chemin de fichier, etc.). */
export function bytesFromLogoSrc(src) {
  const raw = String(src || '');
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+=*)/i.exec(raw);
  if (!match) return null;
  if (typeof atob === 'function') {
    const bin = atob(match[1]);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(match[1], 'base64'));
  return null;
}

function readUint32(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

export function pngHeader(bytes) {
  const data = asBytes(bytes);
  if (!data || data.length < 33) return null;
  for (let i = 0; i < 8; i++) if (data[i] !== PNG_SIG[i]) return null;
  if (readUint32(data, 8) !== 13) return null;
  if (data[12] !== 0x49 || data[13] !== 0x48 || data[14] !== 0x44 || data[15] !== 0x52) return null;
  return {
    width: readUint32(data, 16),
    height: readUint32(data, 20),
    bit: data[24],
    colorType: data[25],
  };
}

export function isDataPng(src) {
  return /^data:image\/png;base64,/i.test(String(src || ''));
}

export function isInitialsMonogramCandidate(logo, bytes) {
  const raw = asBytes(bytes) || bytesFromLogoSrc(logo?.src);
  if (!raw || raw.length === 0 || raw.length > MAX_MONOGRAM_BYTES) return false;
  const header = pngHeader(raw);
  if (!header) return false;
  if (header.width !== header.height) return false;
  if (!MONOGRAM_SIZES.includes(header.width)) return false;
  if (header.bit !== 8 || header.colorType !== 6) return false;
  return true;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Décode un PNG 8 bits RGBA (type 6). `inflateSync` est celui de Node
 * (`zlib.inflateSync`) ; sans lui, retourne null.
 */
export function decodePngRgba(bytes, inflateSync) {
  const data = asBytes(bytes);
  const header = pngHeader(data);
  if (!data || !header || !inflateSync || header.bit !== 8 || header.colorType !== 6) return null;
  const parts = [];
  let offset = 8;
  while (offset + 12 <= data.length) {
    const length = readUint32(data, offset);
    const type = String.fromCharCode(data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > data.length) return null;
    if (type === 'IDAT') parts.push(data.subarray(start, end));
    if (type === 'IEND') break;
    offset = end + 4;
  }
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const compressed = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    compressed.set(part, at);
    at += part.length;
  }
  let inflated;
  try {
    const result = inflateSync(compressed);
    inflated = asBytes(result);
  } catch {
    return null;
  }
  if (!inflated) return null;
  const { width, height } = header;
  const stride = width * 4;
  const expected = height * (stride + 1);
  if (inflated.length < expected) return null;
  const rgba = new Uint8Array(width * height * 4);
  const prev = new Uint8Array(stride);
  const row = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filter = inflated[rowStart];
    const src = inflated.subarray(rowStart + 1, rowStart + 1 + stride);
    for (let i = 0; i < stride; i++) {
      const x = src[i];
      const a = i >= 4 ? row[i - 4] : 0;
      const b = prev[i];
      const c = i >= 4 ? prev[i - 4] : 0;
      let value = x;
      if (filter === 1) value = (x + a) & 255;
      else if (filter === 2) value = (x + b) & 255;
      else if (filter === 3) value = (x + ((a + b) >> 1)) & 255;
      else if (filter === 4) value = (x + paeth(a, b, c)) & 255;
      else if (filter !== 0) return null;
      row[i] = value;
    }
    rgba.set(row, y * stride);
    prev.set(row);
  }
  return { width, height, rgba };
}

/** Cercle bi-couleur sur fond transparent, typique des monogrammes générés. */
export function pixelsLookLikeInitialsMonogram(width, height, rgba) {
  if (!rgba || width !== height || !MONOGRAM_SIZES.includes(width)) return false;
  const alphaAt = (x, y) => rgba[(y * width + x) * 4 + 3];
  const corners = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
    [2, 2], [width - 3, 2], [2, height - 3], [width - 3, height - 3],
  ];
  if (corners.some(([x, y]) => alphaAt(x, y) > 8)) return false;
  const cx = (width - 1) / 2;
  const cy = (height - 1) / 2;
  let rMax = 0;
  let opaque = 0;
  const colors = new Map();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (rgba[i + 3] <= 16) continue;
      opaque += 1;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist > rMax) rMax = dist;
      const key = (rgba[i] >> 4 << 8) | (rgba[i + 1] >> 4 << 4) | (rgba[i + 2] >> 4);
      colors.set(key, (colors.get(key) || 0) + 1);
    }
  }
  if (opaque < width * height * 0.2) return false;
  const ratio = rMax / width;
  if (ratio < 0.32 || ratio > 0.51) return false;
  let inside = 0;
  let filled = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (Math.hypot(x - cx, y - cy) > rMax + 0.75) continue;
      inside += 1;
      if (alphaAt(x, y) > 16) filled += 1;
    }
  }
  if (!inside || filled / inside < 0.93) return false;
  const top = [...colors.values()].sort((a, b) => b - a);
  const dominant = (top[0] || 0) + (top[1] || 0);
  return dominant / opaque >= 0.9;
}

export function inspectPngMonogram(bytes, inflateSync) {
  const raw = asBytes(bytes);
  if (!raw || !isInitialsMonogramCandidate({ src: '' }, raw)) {
    return { candidate: false, monogram: false };
  }
  if (!inflateSync) return { candidate: true, monogram: null };
  const decoded = decodePngRgba(raw, inflateSync);
  if (!decoded) return { candidate: true, monogram: null };
  return { candidate: true, monogram: pixelsLookLikeInitialsMonogram(decoded.width, decoded.height, decoded.rgba) };
}

/**
 * Vrai si le logo est un monogramme d'initiales généré (ou un candidat
 * data PNG, quand on ne peut pas décoder les pixels).
 */
export function isGeneratedInitialsLogo(logo, bytes, inflateSync) {
  if (!logo || !logo.src) return false;
  const raw = asBytes(bytes) || bytesFromLogoSrc(logo.src);
  if (!raw) return false;
  const result = inspectPngMonogram(raw, inflateSync);
  if (result.monogram === true) return true;
  if (result.monogram === false) return false;
  return result.candidate && isDataPng(logo.src);
}

/** Logo affichable dans le mât ; `undefined` si absent ou monogramme généré. */
export function usablePublicationLogo(logo, bytes, inflateSync) {
  if (!logo?.src) return undefined;
  if (isGeneratedInitialsLogo(logo, bytes, inflateSync)) return undefined;
  return logo;
}
