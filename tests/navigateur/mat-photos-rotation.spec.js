import { expect, test } from '@playwright/test';

const FAUX_MODULE = `(function () {
  var s = document.currentScript; if (!s) return;
  var h = document.createElement('div'); h.className = 'radar-radio';
  h.style.cssText = 'display:block;height:48px;background:#0a0a0b;border-radius:12px';
  s.after(h); s.parentElement.dataset.radarRadio = 'ready';
})();`;

async function fauxRadar(ctx) {
  await ctx.route('https://le-radar.ca/**', (route) => {
    if (route.request().url().endsWith('/radio-barre.js')) {
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: FAUX_MODULE });
    }
    return route.fulfill({ status: 404, body: '' });
  });
}

async function snapshot(page) {
  return page.evaluate(() => {
    const btn = document.getElementById('masthead-shuffle');
    const img = document.querySelector('[data-masthead-background]');
    const credit = document.querySelector('[data-masthead-credit]');
    const payload = JSON.parse(document.getElementById('masthead-backgrounds')?.textContent || '[]');
    const images = Array.isArray(payload) ? payload : payload.images || [];
    const src = img?.currentSrc || img?.getAttribute('src') || '';
    const item = images.find((it) => src.includes((it.src || '').split('/').pop())) || images[Number(img?.getAttribute('data-masthead-start') || 0)];
    return {
      hidden: btn ? btn.hidden || getComputedStyle(btn).display === 'none' : true,
      count: images.length,
      randomOrder: Array.isArray(payload) ? true : payload.randomOrder !== false,
      src,
      credit: (credit?.textContent || '').trim(),
      itemCredit: item?.credit || '',
      start: img?.getAttribute('data-masthead-start'),
    };
  });
}

test('bouton ↻ caché avec une photo, visible avec deux ou plus', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await fauxRadar(ctx);
  const page = await ctx.newPage();
  await page.goto('/autre-nom/demo/');
  await page.waitForTimeout(400);
  const many = await snapshot(page);
  expect(many.count).toBeGreaterThanOrEqual(2);
  expect(many.hidden).toBe(false);

  await page.evaluate(() => {
    const payload = JSON.parse(document.getElementById('masthead-backgrounds').textContent || '[]');
    const images = (Array.isArray(payload) ? payload : payload.images || []).slice(0, 1);
    document.getElementById('masthead-backgrounds').textContent = JSON.stringify({ randomOrder: true, images });
    if (typeof window.KiosqueRefreshMastheadBackgrounds === 'function') window.KiosqueRefreshMastheadBackgrounds();
  });
  const one = await snapshot(page);
  expect(one.count).toBe(1);
  expect(one.hidden).toBe(true);
  await ctx.close();
});

test('crédit suit la photo au clic sur ↻', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await fauxRadar(ctx);
  const page = await ctx.newPage();
  await page.goto('/autre-nom/demo/');
  await page.waitForTimeout(500);
  const before = await snapshot(page);
  expect(before.credit).toMatch(/Photo :/);
  expect(before.credit).toContain(before.itemCredit);
  await page.locator('#masthead-shuffle').click();
  await page.waitForTimeout(700);
  const after = await snapshot(page);
  expect(after.src).not.toBe(before.src);
  expect(after.credit).toMatch(/Photo :/);
  expect(after.credit).toContain(after.itemCredit);
  await ctx.close();
});

test('départ aléatoire : les rechargements ne restent pas sur la même photo', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await fauxRadar(ctx);
  const starts = new Set();
  for (let i = 0; i < 16; i += 1) {
    const page = await ctx.newPage();
    await page.goto('/autre-nom/demo/', { waitUntil: 'load' });
    const snap = await snapshot(page);
    starts.add(snap.start || snap.src);
    await page.close();
  }
  expect(starts.size).toBeGreaterThan(1);
  await ctx.close();
});
