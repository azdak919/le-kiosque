import { expect, test } from '@playwright/test';

/**
 * Barre radio activée : collée en haut du viewport au défilement
 * (parité LE-RADAR). Radio éteinte : rien ne change.
 * Les bords gauche et droit de la barre suivent la colonne
 * (dock météo, cartes sports), à 1 px près. Seul le fond opaque
 * derrière la barre collée traverse le viewport.
 */

const FAUX_MODULE = `(function () {
  var s = document.currentScript; if (!s) return;
  var h = document.createElement('div'); h.className = 'radar-radio';
  h.style.cssText = 'display:block;height:48px;background:#0a0a0b;border-radius:12px';
  s.after(h); s.parentElement.dataset.radarRadio = 'ready';
})();`;

async function fauxRadar(ctx, muet = false) {
  await ctx.route('https://le-radar.ca/**', (route) => {
    if (muet) return route.abort();
    if (route.request().url().endsWith('/radio-barre.js')) {
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: FAUX_MODULE });
    }
    return route.fulfill({ status: 404, body: '' });
  });
}

async function metrics(page) {
  return page.evaluate(() => {
    const slot = document.querySelector('.radar-radio-slot');
    const banner = document.querySelector('.demo-banner');
    const nav = document.querySelector('.nav-wrap');
    const sports = document.querySelector('.masthead-sports-strip');
    const dock = document.querySelector('.masthead-weather-dock');
    const bar = document.querySelector('.radar-radio');
    const remonter = document.getElementById('page-scroll-top');
    const tools = document.getElementById('page-tools');
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        top: r.top, bottom: r.bottom, left: r.left, right: r.right,
        width: r.width, height: r.height,
        position: cs.position, zIndex: cs.zIndex, display: cs.display,
        stickyTop: cs.top,
      };
    };
    const contentBox = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const left = r.left + (parseFloat(cs.paddingLeft) || 0);
      const right = r.right - (parseFloat(cs.paddingRight) || 0);
      return { left, right, width: right - left };
    };
    const midY = slot ? slot.getBoundingClientRect().top + Math.min(20, slot.getBoundingClientRect().height / 2) : 0;
    const tag = (el) => (el ? (el.className || el.id || el.tagName) : null);
    const after = slot ? getComputedStyle(slot, '::after') : null;
    return {
      withRadio: document.body.classList.contains('with-radio'),
      scrollY: window.scrollY || document.documentElement.scrollTop || 0,
      banner: box(banner),
      slot: box(slot),
      bar: box(bar),
      dockContent: contentBox(dock),
      sportsContent: contentBox(sports),
      navContent: contentBox(nav),
      nav: box(nav),
      sports: box(sports),
      remonter: box(remonter),
      tools: box(tools),
      after: after ? { content: after.content, width: after.width, bg: after.backgroundColor } : null,
      hits: {
        left: tag(document.elementFromPoint(4, midY)),
        right: tag(document.elementFromPoint(Math.max(0, innerWidth - 4), midY)),
      },
      viewport: { w: window.innerWidth, h: window.innerHeight },
      radioVar: getComputedStyle(document.documentElement).getPropertyValue('--radio-sticky-h').trim(),
    };
  });
}

function align(label, a, b) {
  expect(a, `${label} présent`).toBeTruthy();
  expect(b, `${label} colonne présente`).toBeTruthy();
  expect(Math.abs(a.left - b.left), `${label} left bar=${a.left} col=${b.left}`).toBeLessThanOrEqual(1);
  expect(Math.abs(a.right - b.right), `${label} right bar=${a.right} col=${b.right}`).toBeLessThanOrEqual(1);
}

for (const theme of ['light', 'dark']) {
  for (const viewport of [
    { name: 'mobile-390', width: 390, height: 844 },
    { name: 'bureau-1024', width: 1024, height: 800 },
    { name: 'bureau-1440', width: 1440, height: 900 },
    { name: 'bureau-1920', width: 1920, height: 900 },
  ]) {
    test(`radio collante au milieu de page ${viewport.name} ${theme}`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: theme,
      });
      await fauxRadar(ctx);
      const page = await ctx.newPage();
      await page.goto('/autre-nom/demo/');
      await page.waitForSelector('.radar-radio');
      await page.waitForSelector('.masthead-sports-strip .sports-chip, .masthead-sports-strip:not([hidden])', { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(400);
      const atTop = await metrics(page);
      expect(atTop.withRadio).toBe(true);
      expect(atTop.slot?.position).toBe('sticky');
      expect(atTop.slot?.display).not.toBe('none');
      expect(atTop.slot?.height).toBeGreaterThan(40);
      // Au repos, la barre est sous le mât (pas encore collée en haut).
      const bannerH = atTop.banner?.height || 0;
      expect(atTop.slot.top).toBeGreaterThan(bannerH + 20);

      expect(atTop.bar, 'barre visible').toBeTruthy();
      if (atTop.sportsContent && atTop.sportsContent.width > 40) {
        align('haut sports', atTop.bar, atTop.sportsContent);
      }
      if (atTop.dockContent && atTop.dockContent.width > 40) {
        align('haut météo', atTop.bar, atTop.dockContent);
      }

      await page.evaluate(() => window.scrollTo(0, 1100));
      await page.waitForTimeout(200);
      const mid = await metrics(page);
      expect(mid.scrollY).toBeGreaterThan(400);
      const expectedTop = mid.banner?.height || 0;
      expect(Math.abs(mid.slot.top - expectedTop), `slot.top=${mid.slot.top} attendu ${expectedTop}`).toBeLessThanOrEqual(2);
      expect(Number(mid.slot.zIndex)).toBe(100);
      // La barre collée garde les bords de la colonne mesurés en haut de page.
      expect(mid.bar, 'barre visible à mi-défilement').toBeTruthy();
      if (atTop.sportsContent && atTop.sportsContent.width > 40) {
        align('milieu sports', mid.bar, atTop.sportsContent);
      }
      if (atTop.dockContent && atTop.dockContent.width > 40) {
        align('milieu météo', mid.bar, atTop.dockContent);
      }
      // Fond opaque plein viewport : les gouttières appartiennent à l'emplacement, pas au fil.
      expect(String(mid.hits.left)).toMatch(/radar-radio/);
      expect(String(mid.hits.right)).toMatch(/radar-radio/);
      // Sports et nav ont défilé (plus bas que le haut de page, éventuellement sous la barre).
      if (mid.sports && mid.sports.height > 0) {
        expect(mid.sports.top).toBeLessThan(mid.slot.top);
      }
      if (mid.nav && mid.nav.height > 0) {
        expect(mid.nav.top).toBeLessThan(atTop.nav.top);
      }
      // Le bouton remonter reste en bas, au-dessus de la barre radio (z-index 180).
      if (mid.tools) {
        expect(mid.tools.position).toBe('fixed');
        expect(Number(mid.tools.zIndex)).toBeGreaterThan(Number(mid.slot.zIndex));
        expect(mid.tools.bottom).toBeGreaterThan(mid.viewport.h - 120);
      }
      await ctx.close();
    });
  }
}

test('radio éteinte : l’emplacement n’est pas collant et ne prend pas de place', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await fauxRadar(ctx, true);
  const page = await ctx.newPage();
  await page.goto('/autre-nom/demo/');
  await page.waitForTimeout(400);
  const info = await page.evaluate(() => {
    const slot = document.querySelector('.radar-radio-slot');
    const cs = slot ? getComputedStyle(slot) : null;
    return {
      display: cs?.display || null,
      position: cs?.position || null,
      height: slot ? slot.getBoundingClientRect().height : 0,
    };
  });
  expect(info.display).toBe('none');
  expect(info.height).toBe(0);
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(150);
  const mid = await page.evaluate(() => {
    const slot = document.querySelector('.radar-radio-slot');
    return slot ? slot.getBoundingClientRect().height : 0;
  });
  expect(mid).toBe(0);
  await ctx.close();
});
