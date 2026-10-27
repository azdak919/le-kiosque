import { expect, test } from '@playwright/test';

/**
 * Mise en page du mât (t343u) : la date, la météo, les sports et les outils
 * ne doivent jamais se chevaucher, et la barre radio ne doit jamais
 * recouvrir la navigation, de 390 px à 1920 px, en clair et en sombre.
 */
const largeurs = [390, 820, 1024, 1280, 1920];
const paires = [
  ['.masthead-clock', '.masthead-status'],
  ['.masthead-clock', '.masthead-tools'],
  ['.masthead-status', '.masthead-tools'],
  ['.masthead-weather', '.masthead-sports'],
  ['.radar-tuner', '.nav-wrap'],
];

for (const theme of ['light', 'dark']) for (const largeur of largeurs) {
  test(`mât sans chevauchement à ${largeur} px (${theme})`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: largeur, height: 900 }, colorScheme: theme });
    const page = await ctx.newPage();
    const erreurs = [];
    page.on('pageerror', (e) => erreurs.push(e.message));
    page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith('http://127.0.0.1')) erreurs.push(`${r.status()} ${r.url()}`); });
    await page.goto('/autre-nom/demo/');
    await page.waitForTimeout(800);
    const chevauchements = await page.evaluate((liste) => liste.flatMap(([x, y]) => {
      const A = document.querySelector(x), B = document.querySelector(y);
      if (!A || !B) return [];
      const a = A.getBoundingClientRect(), b = B.getBoundingClientRect();
      if (!a.width || !b.width || !a.height || !b.height) return [];
      const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      return ix > 1 && iy > 1 ? [`${x} × ${y} (${Math.round(ix)}×${Math.round(iy)} px)`] : [];
    }), paires);
    expect(chevauchements).toEqual([]);
    const horloge = page.locator('.masthead-clock');
    if (await horloge.count()) {
      const tronquee = await horloge.evaluate((e) => e.scrollWidth > e.clientWidth + 1);
      expect(tronquee, 'date et heure tronquées').toBe(false);
    }
    const debordement = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(debordement, 'défilement horizontal').toBeLessThanOrEqual(1);
    expect(erreurs).toEqual([]);
    await ctx.close();
  });
}
