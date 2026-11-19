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
