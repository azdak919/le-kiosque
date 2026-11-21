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

test('bandeau sports à 1280 px : plusieurs cartes, aucune case vide', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await fauxRadar(ctx);
  const page = await ctx.newPage();
  await page.goto('/autre-nom/demo/');
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const host = document.querySelector('#masthead-sports-strip, .masthead-sports-strip');
    if (!host) return null;
    const chips = [...host.querySelectorAll('.sports-chip')];
    const lib = window.KiosqueSportsBoard;
    const avail = host.clientWidth;
    const expected = lib ? lib.sportsBoardCountFromWidth(avail, { desktop: true }) : chips.length;
    return {
      hidden: host.hidden || host.classList.contains('is-empty'),
      count: chips.length,
      expected,
      avail,
      texts: chips.map((c) => (c.textContent || '').trim()),
      widths: chips.map((c) => c.getBoundingClientRect().width),
      empty: chips.filter((c) => !(c.textContent || '').trim() || c.getBoundingClientRect().width < 8).length,
    };
  });
  expect(info).toBeTruthy();
  expect(info.hidden).toBeFalsy();
  expect(info.count).toBe(3);
  expect(info.count).toBe(info.expected);
  expect(info.empty).toBe(0);
  info.widths.forEach((w) => expect(w).toBeGreaterThan(80));
  await ctx.close();
});

test('plan de vague : départs décalés de 440 ms', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await fauxRadar(ctx);
  const page = await ctx.newPage();
  await page.goto('/autre-nom/demo/');
  const plan = await page.evaluate(() => {
    const lib = window.KiosqueSportsBoard;
    if (!lib) return null;
    const events = lib.sportsWaveSchedule(5, {
      stepMs: lib.SPORTS_CASCADE_STEP_MS,
      holdMs: lib.SPORTS_BOARD_HOLD_MIN_MS,
      firstWait: true,
    });
    return { events, step: lib.SPORTS_CASCADE_STEP_MS, staggered: lib.sportsWaveStaggered(events) };
  });
  expect(plan).toBeTruthy();
  expect(plan.staggered).toBe(true);
  expect(plan.events[1].at - plan.events[0].at).toBe(440);
  await ctx.close();
});
