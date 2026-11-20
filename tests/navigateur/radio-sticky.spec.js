import { expect, test } from '@playwright/test';

/**
 * Barre radio activée : collée en haut du viewport au défilement
 * (parité LE-RADAR). Radio éteinte : rien ne change.
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
    return {
      withRadio: document.body.classList.contains('with-radio'),
      scrollY: window.scrollY || document.documentElement.scrollTop || 0,
      banner: box(banner),
      slot: box(slot),
      nav: box(nav),
      sports: box(sports),
      remonter: box(remonter),
      tools: box(tools),
      viewport: { w: window.innerWidth, h: window.innerHeight },
      radioVar: getComputedStyle(document.documentElement).getPropertyValue('--radio-sticky-h').trim(),
    };
  });
}

for (const theme of ['light', 'dark']) {
  for (const viewport of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'bureau', width: 1440, height: 900 },
  ]) {
    test(`radio collante au milieu de page ${viewport.name} ${theme}`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: theme,
      });
      await fauxRadar(ctx);
      const page = await ctx.newPage();
      await page.goto('/autre-nom/demo/');
      await page.waitForTimeout(400);
      const atTop = await metrics(page);
      expect(atTop.withRadio).toBe(true);
      expect(atTop.slot?.position).toBe('sticky');
      expect(atTop.slot?.display).not.toBe('none');
      expect(atTop.slot?.height).toBeGreaterThan(40);
      // Au repos, la barre est sous le mât (pas encore collée en haut).
      const bannerH = atTop.banner?.height || 0;
      expect(atTop.slot.top).toBeGreaterThan(bannerH + 20);

      await page.evaluate(() => window.scrollTo(0, 900));
      await page.waitForTimeout(200);
      const mid = await metrics(page);
      expect(mid.scrollY).toBeGreaterThan(400);
      const expectedTop = mid.banner?.height || 0;
      expect(Math.abs(mid.slot.top - expectedTop), `slot.top=${mid.slot.top} attendu ${expectedTop}`).toBeLessThanOrEqual(2);
      expect(Number(mid.slot.zIndex)).toBe(100);
      // Pleine largeur : rien du fil ne transparaît à côté de la barre.
      expect(Math.abs(mid.slot.left), `slot.left=${mid.slot.left}`).toBeLessThanOrEqual(1);
      expect(Math.abs(mid.slot.width - mid.viewport.w), `slot.w=${mid.slot.width} vp=${mid.viewport.w}`).toBeLessThanOrEqual(2);
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
