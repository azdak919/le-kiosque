import { expect, test } from '@playwright/test';

/**
 * Placement de la météo.
 * Sous 1100 px (téléphone, tablette, colonne à 800 px) : une seule puce,
 * pleine largeur, entre la barre radio et les cartes sports, avec max/min
 * et « Demain ».
 * À partir de 1280 px : la même puce dans la rangée du mât, à côté de la
 * date, sans toucher les boutons ni se dupliquer. La radio reste collante
 * et le petit espace sous le mât ne change pas.
 */

const FAUX_MODULE = `(function () {
  var s = document.currentScript; if (!s) return;
  var h = document.createElement('div'); h.className = 'radar-radio';
  h.style.cssText = 'display:block;height:48px;background:#0a0a0b;border-radius:12px';
  s.after(h); s.parentElement.dataset.radarRadio = 'ready';
})();`;

const FORECAST = {
  current: { temperature_2m: 5.4, weather_code: 0, is_day: 0 },
  daily: {
    time: ['2026-11-20', '2026-11-21'],
    weather_code: [0, 2],
    temperature_2m_max: [9.5, 8.2],
    temperature_2m_min: [1.3, 0.4],
  },
};

async function preparer(ctx) {
  await ctx.route('https://le-radar.ca/**', (route) => {
    if (route.request().url().endsWith('/radio-barre.js')) {
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: FAUX_MODULE });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await ctx.route('https://api.open-meteo.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(FORECAST),
  }));
}

async function poser(browser, viewport, theme) {
  const ctx = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    colorScheme: theme,
    isMobile: viewport.width < 721,
    hasTouch: viewport.width < 721,
  });
  await preparer(ctx);
  const page = await ctx.newPage();
  await page.goto('/autre-nom/demo/');
  const chip = page.locator('.weather-chip:not(.weather-chip--attente)').first();
  await expect(chip).toBeVisible({ timeout: 15000 });
  await page.locator('.masthead-sports-strip .sports-chip').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  return { ctx, page };
}

async function mesure(page) {
  return page.evaluate(() => {
    const visible = [...document.querySelectorAll('.weather-chip:not(.weather-chip--attente)')].filter((el) => {
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return b.width > 1 && b.height > 1 && cs.display !== 'none' && cs.visibility !== 'hidden';
    });
    const chip = visible[0] || null;
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const dock = document.getElementById('masthead-weather-dock');
    const radio = document.querySelector('.radar-radio-slot');
    const name = chip?.querySelector('.weather-chip__name');
    const extras = ['.weather-chip__today', '.weather-chip__tomorrow', '.weather-chip__max', '.weather-chip__min']
      .map((sel) => chip?.querySelector(sel))
      .filter(Boolean);
    const shown = (el) => {
      if (!el) return false;
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && el.getBoundingClientRect().width > 1;
    };
    return {
      count: visible.length,
      inDock: Boolean(chip && dock && dock.contains(chip)),
      inUtility: Boolean(chip && chip.closest('.masthead-utility')),
      dockHasChip: Boolean(dock?.querySelector('.weather-chip')),
      text: (chip?.innerText || '').replace(/\s+/g, ' '),
      aria: chip?.getAttribute('aria-label') || '',
      extras: extras.every(shown),
      name: name?.textContent || '',
      nameCut: Boolean(name && name.scrollWidth > name.clientWidth + 1),
      chip: box(chip),
      clock: box(document.querySelector('.masthead-clock')),
      tools: box(document.querySelector('.masthead-tools')),
      radio: box(radio),
      sports: box(document.querySelector('.masthead-sports-strip')),
      hscroll: document.documentElement.scrollWidth - window.innerWidth,
      radioPosition: radio ? getComputedStyle(radio).position : null,
      radioMarginTop: radio ? getComputedStyle(radio).marginTop : null,
    };
  });
}

const DOCK = [
  { name: 'mobile', width: 390, height: 844, margin: '4px' },
  { name: 'tablette', width: 768, height: 1024, margin: '10px' },
  { name: 'tablette-large', width: 1024, height: 768, margin: '10px' },
];
const MAT = [
  { name: 'bureau', width: 1280, height: 900, margin: '10px' },
  { name: 'bureau-large', width: 1440, height: 900, margin: '10px' },
  { name: 'bureau-très-large', width: 1920, height: 900, margin: '10px' },
];

for (const theme of ['light', 'dark']) {
  for (const viewport of [...DOCK, ...MAT]) {
    const docked = viewport.width < 1100;
    test(`météo ${docked ? 'sous la radio' : 'à côté de la date'} ${viewport.name} ${theme}`, async ({ browser }) => {
      const { ctx, page } = await poser(browser, viewport, theme);
      const m = await mesure(page);
      expect(m.count, 'une seule puce visible').toBe(1);
      expect(m.extras, 'max/min et demain visibles').toBe(true);
      expect(m.text).toMatch(/Max/i);
      expect(m.text).toMatch(/Min/i);
      expect(m.text).toMatch(/Demain/i);
      expect(m.name.length, 'localité').toBeGreaterThan(1);
      expect(m.nameCut, 'toponyme coupé').toBe(false);
      expect(m.hscroll, 'défilement horizontal').toBeLessThanOrEqual(1);
      expect(m.radioPosition, 'radio collante').toBe('sticky');
      expect(m.radioMarginTop, 'espace sous le mât').toBe(viewport.margin);
      expect(m.chip.height).toBeGreaterThan(28);
      if (m.aria) expect(m.aria).toMatch(/max/i);
      if (docked) {
        expect(m.inDock).toBe(true);
        expect(m.inUtility).toBe(false);
        expect(m.chip.top).toBeGreaterThanOrEqual(m.radio.bottom - 2);
        expect(m.sports.top).toBeGreaterThanOrEqual(m.chip.bottom - 2);
        expect(m.tools.bottom).toBeLessThanOrEqual(m.radio.top + 2);
        expect(m.chip.top).toBeGreaterThan(m.tools.bottom - 1);
      } else {
        expect(m.inUtility).toBe(true);
        expect(m.inDock).toBe(false);
        expect(m.dockHasChip).toBe(false);
        const mid = (b) => b.top + b.height / 2;
        expect(Math.abs(mid(m.chip) - mid(m.clock)), 'même rangée que la date').toBeLessThanOrEqual(2);
        expect(m.chip.left).toBeGreaterThanOrEqual(m.clock.right - 1);
        expect(m.tools.left - m.chip.right, 'les boutons ne sont pas serrés').toBeGreaterThanOrEqual(8);
        expect(m.chip.bottom).toBeLessThanOrEqual(m.radio.top + 1);
        expect(m.sports.top).toBeGreaterThanOrEqual(m.radio.bottom - 2);
      }
      await ctx.close();
    });
  }
}

test('la puce suit le redimensionnement sans se dupliquer', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await preparer(ctx);
  const page = await ctx.newPage();
  await page.goto('/autre-nom/demo/');
  await expect(page.locator('.weather-chip:not(.weather-chip--attente)').first()).toBeVisible({ timeout: 15000 });
  await page.locator('.masthead-sports-strip .sports-chip').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
  const attendre = async () => {
    await page.evaluate(() => new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    await page.waitForTimeout(180);
  };
  let m = await mesure(page);
  expect(m.inDock, 'mobile').toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await attendre();
  m = await mesure(page);
  expect(m.count).toBe(1);
  expect(m.inUtility, 'bureau').toBe(true);
  expect(m.inDock).toBe(false);
  expect(m.extras).toBe(true);
  await page.setViewportSize({ width: 768, height: 1024 });
  await attendre();
  m = await mesure(page);
  expect(m.count).toBe(1);
  expect(m.inDock, 'tablette').toBe(true);
  expect(m.inUtility).toBe(false);
  await ctx.close();
});
