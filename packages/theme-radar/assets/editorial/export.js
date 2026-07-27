function yaml(value) {
  return JSON.stringify(value ?? '');
}

function articleMarkdown(article) {
  return `---
id: ${yaml(article.id)}
slug: ${yaml(article.slug)}
title: ${yaml(article.title)}
subtitle: ${yaml(article.subtitle || '')}
dek: ${yaml(article.dek || '')}
excerpt: ${yaml(article.excerpt || '')}
authors: ${JSON.stringify(article.authors || [])}
section: ${yaml(article.section || '')}
categories: ${JSON.stringify(article.categories || [])}
tags: ${JSON.stringify(article.tags || [])}
lang: ${yaml(article.lang || 'fr-CA')}
status: ${yaml(article.status)}
bodyFormat: ${yaml(article.body?.format || 'markdown')}
demo: ${Boolean(article.isDemo)}
publishedAt: ${yaml(article.publishedAt || '')}
updatedAt: ${yaml(article.updatedAt)}
lead: ${article.lead ? JSON.stringify(article.lead) : 'null'}
media: ${JSON.stringify(article.media || [])}
---

${article.body?.raw || ''}
`;
}

export async function markdownFiles(backup, publicBasePath = '') {
  const bundle = structuredClone(backup.bundle);
  const publication = bundle.publication;
  const files = [];
  const dataAssets = [publication.logo, ...(publication.masthead?.backgrounds?.images || []), ...bundle.articles.flatMap((article) => [article.lead, ...(article.media || [])])].filter(Boolean);
  for (const asset of dataAssets) {
    const match = /^data:([^;,]+);base64,(.*)$/.exec(asset.src || '');
    if (!match) continue;
    const ext = { 'image/svg+xml': 'svg', 'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg' }[match[1]] || 'bin';
    const previous = asset.src;
    const target = `media/${asset.id || crypto.randomUUID()}.${ext}`;
    asset.src = `/${target}`;
    const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
    files.push({ path: target, content: bytes });
    for (const article of bundle.articles) article.body.raw = String(article.body?.raw || '').split(previous).join(asset.src);
  }
  files.push({ path: 'kiosque-export.json', content: JSON.stringify({ format: backup.format, version: backup.version, exportedAt: backup.exportedAt }, null, 2) });
  files.push({ path: 'content/publication.yml', content: `slug: ${yaml(publication.slug)}
name: ${yaml(publication.name)}
tagline: ${yaml(publication.tagline || '')}
institution: ${yaml(publication.institution || '')}
institutionType: ${yaml(publication.institutionType || 'autre')}
region: ${yaml(publication.region || '')}
lang: ${yaml(publication.lang || 'fr-CA')}
siteUrl: ${yaml(publication.siteUrl || '')}
timeZone: ${yaml(publication.timeZone || 'America/Toronto')}
logo: ${publication.logo ? JSON.stringify(publication.logo) : 'null'}
theme:
  accent: ${yaml(publication.theme?.accent || '#6c2163')}
  accentDark: ${yaml(publication.theme?.accentDark || '#cf7ec1')}
  typography: ${yaml(publication.theme?.typography || 'modern-accessible')}
masthead:
  backgrounds:
    enabled: ${publication.masthead?.backgrounds?.enabled !== false}
    images: ${JSON.stringify(publication.masthead?.backgrounds?.images || [])}
  weather:
    enabled: ${Boolean(publication.masthead?.weather?.enabled)}
    localities: ${JSON.stringify(publication.masthead?.weather?.localities || [])}
  tools:
    pomodoro: ${publication.masthead?.tools?.pomodoro !== false}
    solitaire: ${publication.masthead?.tools?.solitaire !== false}
  overlayStrength: ${Number(publication.masthead?.overlayStrength ?? 0.55)}
  textAlignment: ${yaml(publication.masthead?.textAlignment || 'left')}
radio:
  enabled: ${publication.radio?.enabled !== false}
  station: ${yaml(publication.radio?.station || '')}
  theme: ${yaml(publication.radio?.theme || 'auto')}
  position: ${yaml(publication.radio?.position || 'top')}
founded: ${yaml(publication.founded || '')}
license: ${yaml(publication.license || 'CC-BY-SA-4.0')}
governance:
  owner: ${yaml(publication.governance?.owner || '')}
  stewardEntity: ${yaml(publication.governance?.stewardEntity || '')}
  contact: ${yaml(publication.governance?.contact || '')}
  repo: ${yaml(publication.governance?.repo || '')}
` });
  for (const section of bundle.taxonomies.sections) {
    files.push({ path: `content/sections/${section.slug}.yml`, content: `slug: ${yaml(section.slug)}\nname: ${yaml(section.name)}\ndescription: ${yaml(section.description || '')}\norder: ${Number(section.order || 0)}\n` });
  }
  files.push({ path: 'content/taxonomies.yml', content: `categories:\n${bundle.taxonomies.categories.map((item) => `  - name: ${yaml(item.name)}\n    slug: ${yaml(item.slug)}`).join('\n')}\ntags:\n${bundle.taxonomies.tags.map((item) => `  - name: ${yaml(item.name)}\n    slug: ${yaml(item.slug)}`).join('\n')}\n` });
  for (const author of bundle.authors) {
    files.push({ path: `content/auteurs/${author.slug}.md`, content: `---\nid: ${yaml(author.id)}\nslug: ${yaml(author.slug)}\nname: ${yaml(author.name)}\nrole: ${yaml(author.role || '')}\neditorialRole: ${yaml(author.editorialRole || 'auteur')}\ncohort: ${yaml(author.cohort || '')}\nactive: ${author.active !== false}\n---\n\n${author.bio || ''}\n` });
  }
  for (const article of bundle.articles) {
    const date = new Date(article.publishedAt || article.updatedAt || Date.now());
    const year = String(date.getUTCFullYear());
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    files.push({ path: `content/articles/${year}/${month}/${article.slug}.md`, content: articleMarkdown(article) });
  }
  const known = new Set(files.map((file) => file.path));
  const remoteMedia = [publication.logo, ...(publication.masthead?.backgrounds?.images || []), ...bundle.articles.flatMap((article) => [article.lead, ...(article.media || [])])]
    .filter((asset) => asset?.src?.startsWith('/media/'));
  for (const asset of remoteMedia) {
    const target = asset.src.replace(/^\//, '');
    if (known.has(target)) continue;
    const response = await fetch(`${publicBasePath}${asset.src}`);
    if (!response.ok) continue;
    files.push({ path: target, content: new Uint8Array(await response.arrayBuffer()) });
    known.add(target);
  }
  files.push({ path: 'README-EXPORT.md', content: `# Export KIOSQUE\n\nCet export est portable et ne contient aucun mot de passe, jeton ou secret.\n\nPour publier avec GitHub et Sveltia, créez un dépôt avec « Use this template », copiez ces fichiers aux mêmes chemins, puis activez GitHub Actions et Pages. Cette archive ne publie rien automatiquement.\n` });
  return files;
}

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}
const word = (value) => [value & 255, (value >>> 8) & 255];
const dword = (value) => [...word(value), ...word(value >>> 16)];
function join(parts) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}

export function zipStore(files) {
  const encoder = new TextEncoder();
  const local = [], central = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.path);
    const data = file.content instanceof Uint8Array ? file.content : encoder.encode(file.content);
    const sum = crc32(data);
    const header = new Uint8Array([80, 75, 3, 4, ...word(20), ...word(0x800), ...word(0), ...word(0), ...word(0), ...dword(sum), ...dword(data.length), ...dword(data.length), ...word(name.length), ...word(0)]);
    local.push(header, name, data);
    central.push(new Uint8Array([80, 75, 1, 2, ...word(20), ...word(20), ...word(0x800), ...word(0), ...word(0), ...word(0), ...dword(sum), ...dword(data.length), ...dword(data.length), ...word(name.length), ...word(0), ...word(0), ...word(0), ...word(0), ...dword(0), ...dword(offset)]), name);
    offset += header.length + name.length + data.length;
  }
  const localBytes = join(local), centralBytes = join(central);
  const end = new Uint8Array([80, 75, 5, 6, ...word(0), ...word(0), ...word(files.length), ...word(files.length), ...dword(centralBytes.length), ...dword(localBytes.length), ...word(0)]);
  return new Blob([localBytes, centralBytes, end], { type: 'application/zip' });
}
