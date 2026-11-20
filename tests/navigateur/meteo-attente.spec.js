import { test, expect } from '@playwright/test';

// Puce météo d'attente (Open-Meteo lent ou muet) : même gabarit que la vraie
// puce, nom abrégé s'il le faut, rien de coupé dans le mât.
for (const [largeur, mobile] of [[1024, false], [1280, false], [360, true], [430, true]]) {
  test(`puce météo d'attente sans texte coupé à ${largeur} px`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: largeur, height: 900 }, isMobile: mobile, hasTouch: mobile });
    await ctx.route('https://le-radar.ca/**', (route) => route.abort());
    await ctx.route(/open-meteo\.com/, () => {}); // jamais de réponse
    const page = await ctx.newPage();
    await page.goto('/autre-nom/demo/');
    await expect(page.locator('.weather-chip--attente').first()).toBeVisible();
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const chips = [...document.querySelectorAll('.weather-chip--attente')];
      const horloge = document.querySelector('.masthead-clock').getBoundingClientRect().height;
      return {
        n: chips.length,
        hauteurs: chips.map((c) => Math.abs(c.getBoundingClientRect().height - horloge)),
        coupe: [...document.querySelectorAll('.weather-chip__name')].some((e) => e.scrollWidth > e.clientWidth + 1),
        hscroll: document.documentElement.scrollWidth > innerWidth + 1,
        icone: chips.every((c) => c.querySelector('.weather-icon-attente')),
      };
    });
    expect(m.n).toBeGreaterThanOrEqual(1);
    expect(m.icone).toBe(true);
    for (const h of m.hauteurs) expect(h, 'même hauteur que la date').toBeLessThanOrEqual(1);
    expect(m.coupe, 'nom de ville coupé').toBe(false);
    expect(m.hscroll).toBe(false);
    await ctx.close();
  });
}

// Téléphone : puce pleine largeur avec max/min du jour et « Demain » (même
// appel Open-Meteo), même hauteur que la puce d'attente et que la date.
// Ordinateur : la même puce élargie, dans le mât, à côté de la date.
const FAUX_GEO = { results: [{ name: 'Québec', latitude: 46.81, longitude: -71.21 }] };
const FAUX_METEO = {
  current: { temperature_2m: 5.6, weather_code: 2, is_day: 1 },
  daily: { weather_code: [2, 61], temperature_2m_max: [9.6, 4.2], temperature_2m_min: [-1.4, -3] },
};
async function fausseMeteo(ctx, retard = 0) {
  const appels = [];
  await ctx.route('https://le-radar.ca/**', (route) => route.abort());
  await ctx.route(/open-meteo\.com/, async (route) => {
    const url = route.request().url();
    appels.push(url);
    if (retard) await new Promise((r) => setTimeout(r, retard));
    const body = url.includes('geocoding') ? FAUX_GEO : FAUX_METEO;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return appels;
}
for (const largeur of [360, 390]) {
  test(`puce météo du téléphone pleine largeur avec prévisions à ${largeur} px`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: largeur, height: 900 }, isMobile: true, hasTouch: true });
    const appels = await fausseMeteo(ctx, 600);
    const page = await ctx.newPage();
    await page.goto('/autre-nom/demo/');
    const attente = page.locator('.masthead-weather-dock .weather-chip--attente').first();
    await expect(attente).toBeVisible();
    const hAttente = await attente.evaluate((e) => e.getBoundingClientRect().height);
    const puce = page.locator('.masthead-weather-dock .weather-chip:not(.weather-chip--attente)').first();
    await expect(puce).toBeVisible({ timeout: 10000 });
    await expect(puce.locator('.weather-chip__temp')).toHaveText('6°');
    await expect(puce.locator('.weather-chip__max')).toHaveText('Max 10°');
    await expect(puce.locator('.weather-chip__min')).toHaveText('Min -1°');
    await expect(puce.locator('.weather-chip__tomorrow')).toHaveText('Demain4°');
    await expect(puce.locator('.weather-chip__tomorrow img')).toHaveAttribute('src', /\.svg$/);
    const m = await puce.evaluate((e) => {
      const r = e.getBoundingClientRect();
      const dock = document.querySelector('.masthead-weather-dock .masthead-status').getBoundingClientRect();
      const coupe = [...e.querySelectorAll('span')].some((s) => s.scrollWidth > s.clientWidth + 1)
        || [...e.children].some((c) => c.getBoundingClientRect().right > r.right + 1);
      return { h: r.height, w: r.width, dockW: dock.width, coupe, horloge: document.querySelector('.masthead-clock').getBoundingClientRect().height };
    });
    expect(Math.abs(m.h - hAttente), 'même hauteur que la puce d’attente').toBeLessThanOrEqual(0.5);
    expect(Math.abs(m.h - m.horloge), 'même hauteur que la date').toBeLessThanOrEqual(1);
    expect(Math.abs(m.w - m.dockW), 'pleine largeur').toBeLessThanOrEqual(1);
    expect(m.coupe, 'rien de coupé').toBe(false);
    const meteo = appels.filter((u) => u.includes('/v1/forecast'));
    expect(meteo.length, 'un seul appel de prévisions').toBe(1);
    expect(meteo[0]).toMatch(/daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=2/);
    await ctx.close();
  });
}
test('ordinateur : la puce météo élargie (max/min et demain) est à côté de la date', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await fausseMeteo(ctx);
  const page = await ctx.newPage();
  await page.goto('/autre-nom/demo/');
  const puce = page.locator('.masthead-utility .weather-chip:not(.weather-chip--attente)').first();
  await expect(puce).toBeVisible({ timeout: 10000 });
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  await expect(puce.locator('.weather-chip__max')).toBeVisible();
  await expect(puce.locator('.weather-chip__tomorrow')).toBeVisible();
  await expect(page.locator('#masthead-weather-dock .weather-chip')).toHaveCount(0);
  await expect(page.locator('.weather-chip:not(.weather-chip--attente)')).toHaveCount(1);
  const rangee = await page.evaluate(() => {
    const puce = document.querySelector('.masthead-utility .weather-chip');
    const date = document.querySelector('.masthead-clock');
    const boutons = document.querySelector('.masthead-tools');
    const a = puce.getBoundingClientRect();
    const d = date.getBoundingClientRect();
    const b = boutons.getBoundingClientRect();
    return { memeRangee: Math.abs((a.top + a.height / 2) - (d.top + d.height / 2)) <= 2, avantBoutons: a.right <= b.left - 8 };
  });
  expect(rangee.memeRangee).toBe(true);
  expect(rangee.avantBoutons).toBe(true);
  await ctx.close();
});
