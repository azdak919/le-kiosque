import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

const FAUX_MODULE = `(function () {
  var s = document.currentScript; if (!s) return;
  var h = document.createElement('div'); h.className = 'radar-radio';
  h.style.cssText = 'display:block;height:48px;background:#0a0a0b;border-radius:12px';
  s.after(h); s.parentElement.dataset.radarRadio = 'ready';
})();`;

/** Coup d’envoi : quart d’heure précédent, moins 30 min, dans un fuseau. */
function kickoffHm(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);
  const quarter = Math.floor((hour * 60 + minute) / 15) * 15;
  let total = quarter - 30;
  if (total < 0) total += 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function hmToChip(hm) {
  return hm.replace(':', ' h ');
}

function clockLabel(iso) {
  const raw = new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'America/Toronto',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
  return String(raw)
    .replace(/(\d{1,2})\s*[:.]\s*(\d{2})/, '$1 h $2')
    .replace(/\s*h\s*/i, ' h ')
    .replace(/\s+/g, ' ')
    .trim();
}

function bakedLiveTime(html) {
  const raw = html.match(/id="masthead-sports-strip"[^>]*data-sports-payload="([^"]+)"/);
  if (!raw) throw new Error('le HTML statique n’a pas de payload sports');
  const json = raw[1]
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
  const payload = JSON.parse(json);
  const hockey = (payload.teams || []).find((team) => team.id === 'demo-touladis-hockey-m');
  return hockey?.nextGame?.time || '';
}

function serve(root) {
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    let file = path.normalize(path.join(root, decodeURIComponent(url.pathname)));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end('');
      return;
    }
    try {
      if (statSync(file).isDirectory()) file = path.join(file, 'index.html');
    } catch {
      res.writeHead(404);
      res.end('');
      return;
    }
    try {
      const body = readFileSync(file);
      const ext = path.extname(file);
      const types = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '.jpg': 'image/jpeg',
        '.webp': 'image/webp',
        '.png': 'image/png',
        '.woff2': 'font/woff2',
      };
      res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('');
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

test('un build UTC affiche le coup d’envoi du visiteur à Montréal', async ({ browser }) => {
  test.setTimeout(120_000);
  const out = mkdtempSync(path.join(tmpdir(), 'kiosque-utc-'));
  let server;
  let ctx;
  const builtAt = new Date();
  const built = spawnSync(process.execPath, ['tools/build-site.mjs'], {
    cwd: ROOT,
    env: { ...process.env, TZ: 'UTC', OUT_DIR: out },
    encoding: 'utf8',
  });
  expect(built.status, built.stderr || built.stdout).toBe(0);

  const builtDone = new Date();
  const html = readFileSync(path.join(out, 'demo', 'index.html'), 'utf8');
  const baked = bakedLiveTime(html);
  const utcBefore = kickoffHm(builtAt, 'UTC');
  const utcAfter = kickoffHm(builtDone, 'UTC');
  expect(
    baked === utcBefore || baked === utcAfter,
    `le HTML sans JS doit figer le coup d’envoi UTC (${utcBefore} ou ${utcAfter}), pas ${baked}`,
  ).toBe(true);

  // Heures montréalaises dont le coup d’envoi n’est pas celui figé au build.
  const visits = [
    '2026-11-21T12:07:00-05:00',
    '2026-11-21T08:10:00-05:00',
    '2026-11-21T21:22:00-05:00',
  ].map((iso) => ({ iso, clock: clockLabel(iso), kick: kickoffHm(new Date(iso), 'America/Toronto') }));
  const visit = visits.find((item) => item.kick !== baked) || visits[0];
  const expectedChip = hmToChip(visit.kick);
  expect(visit.kick).not.toBe(baked);

  server = await serve(out);
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  ctx = await browser.newContext({
    timezoneId: 'America/Toronto',
    locale: 'fr-CA',
    viewport: { width: 1440, height: 900 },
  });
  await ctx.route('https://le-radar.ca/**', (route) => {
    if (route.request().url().endsWith('/radio-barre.js')) {
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: FAUX_MODULE });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  try {
    await ctx.clock.install({ time: visit.iso });
    const page = await ctx.newPage();
    await page.goto(`${origin}/demo/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction((chip) => {
      const clock = document.querySelector('[data-masthead-time]')?.textContent || '';
      const sports = document.querySelector('#masthead-sports-strip')?.innerText || '';
      return clock.includes(chip.clock) && sports.includes('En cours') && sports.includes(chip.kick);
    }, { clock: visit.clock, kick: expectedChip });
    const shown = await page.evaluate(() => ({
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      clock: document.querySelector('[data-masthead-time]')?.textContent?.trim(),
      sports: document.querySelector('#masthead-sports-strip')?.innerText || '',
    }));
    expect(shown.tz).toBe('America/Toronto');
    expect(shown.clock).toContain(visit.clock);
    expect(shown.sports).toContain(`En cours · ${expectedChip}`);
  } finally {
    await ctx?.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    rmSync(out, { recursive: true, force: true });
  }
});
