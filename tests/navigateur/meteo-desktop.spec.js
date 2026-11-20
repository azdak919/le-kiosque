import { expect, test } from '@playwright/test';

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

for (const theme of ['light', 'dark']) {
  for (const viewport of [
    { name: 'mobile', width: 390, height: 844 },
    { name: 'bureau', width: 1440, height: 900 },
  ]) {
    test(`puce météo élargie ${viewport.name} ${theme}`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: theme,
      });
      await preparer(ctx);
      const page = await ctx.newPage();
      await page.goto('/autre-nom/demo/');
      const chip = page.locator('.masthead-weather-dock .weather-chip');
      await expect(chip).toBeVisible({ timeout: 15000 });
      await expect(chip.locator('.weather-chip__today')).toBeVisible();
      await expect(chip.locator('.weather-chip__tomorrow')).toBeVisible();
      const text = (await chip.innerText()).replace(/\s+/g, ' ');
      expect(text).toMatch(/Max/i);
      expect(text).toMatch(/Min/i);
      expect(text).toMatch(/Demain/i);
      const boxed = await page.evaluate(() => {
        const dock = document.getElementById('masthead-weather-dock');
        const chip = dock?.querySelector('.weather-chip');
        const radio = document.querySelector('.radar-radio-slot');
        const sports = document.querySelector('.masthead-sports-strip');
        const d = dock?.getBoundingClientRect();
        const r = radio?.getBoundingClientRect();
        const s = sports?.getBoundingClientRect();
        return {
          docked: dock?.contains(chip),
          dockTop: d?.top, radioBottom: r?.bottom, sportsTop: s?.top,
          chipHeight: chip?.getBoundingClientRect().height,
        };
      });
      expect(boxed.docked).toBe(true);
      expect(boxed.chipHeight).toBeGreaterThan(28);
      if (boxed.radioBottom && boxed.dockTop) {
        expect(boxed.dockTop).toBeGreaterThanOrEqual(boxed.radioBottom - 2);
      }
      if (boxed.sportsTop && boxed.dockTop) {
        expect(boxed.sportsTop).toBeGreaterThanOrEqual(boxed.dockTop);
      }
      await ctx.close();
    });
  }
}
