import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';

const root = path.resolve('dist');
const prefix = '/autre-nom';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.wasm': 'application/wasm', '.data': 'application/octet-stream', '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml' };

createServer(async (request, response) => {
  const url = new URL(request.url || '/', 'http://localhost');
  if (!url.pathname.startsWith(prefix)) { response.writeHead(404); response.end('Not found'); return; }
  const relative = decodeURIComponent(url.pathname.slice(prefix.length)).replace(/^\/+/, '');
  let file = path.resolve(root, relative || 'index.html');
  if (!file.startsWith(root + path.sep) && file !== path.join(root, 'index.html')) { response.writeHead(400); response.end('Bad path'); return; }
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = path.join(file, 'index.html');
    await stat(file);
  } catch {
    file = path.join(root, '404.html');
  }
  response.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  createReadStream(file).pipe(response);
}).listen(4173, '127.0.0.1', () => console.log('E2E: http://127.0.0.1:4173/autre-nom/'));
