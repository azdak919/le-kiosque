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

/**
 * Mât uniforme (t346u) : toutes les pastilles ont la même hauteur, le même
 * rayon et la même taille de texte; les boutons ronds ont un diamètre égal à
 * la hauteur des pastilles, sur la même ligne; aucun texte n'est coupé.
 */
for (const theme of ['light', 'dark']) for (const largeur of [390, 1024, 1280, 1440, 1920]) {
  test(`pastilles du mât uniformes à ${largeur} px (${theme})`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: largeur, height: 900 }, colorScheme: theme });
    const page = await ctx.newPage();
    await page.goto('/autre-nom/demo/');
    await page.waitForTimeout(1200);
    const m = await page.evaluate(() => {
      const mesure = (e) => { const r = e.getBoundingClientRect(), c = getComputedStyle(e);
        return { h: r.height, w: r.width, milieu: r.top + r.height / 2, rayon: parseFloat(c.borderTopLeftRadius), fs: c.fontSize, fond: c.backgroundColor }; };
      const pastilles = ['.masthead-clock', '.masthead-status .weather-chip', '.masthead-status .sports-chip']
        .map((s) => document.querySelector(s)).filter((e) => e && e.getBoundingClientRect().width);
      const boutons = [...document.querySelectorAll('.masthead-tools .masthead-tool')].filter((e) => e.getBoundingClientRect().width);
      const coupe = [...document.querySelectorAll('.masthead-clock, .weather-chip__name, .sports-chip__line')].some((e) => e.scrollWidth > e.clientWidth + 1)
        || [...document.querySelectorAll('.masthead-status .sports-chip__line-inner')].some((e) => e.scrollWidth > e.closest('.sports-chip__body').clientWidth + 1);
      return { p: pastilles.map(mesure), b: boutons.map(mesure), horloge: mesure(document.querySelector('.masthead-clock')), coupe };
    });
    expect(m.p.length).toBeGreaterThanOrEqual(1);
    const h = m.p[0].h;
    for (const p of m.p) {
      expect(Math.abs(p.h - h), 'hauteur des pastilles').toBeLessThanOrEqual(1);
      expect(Math.abs(p.rayon - h / 2), 'rayon des pastilles').toBeLessThanOrEqual(1);
      expect(p.fs).toBe(m.p[0].fs);
      expect(p.fond).toBe(m.p[0].fond);
    }
    for (const b of m.b) {
      expect(Math.abs(b.h - h), 'diamètre des boutons').toBeLessThanOrEqual(1);
      expect(Math.abs(b.w - h)).toBeLessThanOrEqual(1);
      expect(Math.abs(b.milieu - m.horloge.milieu), 'boutons alignés sur la date').toBeLessThanOrEqual(1);
    }
    expect(m.coupe, 'texte coupé dans le mât').toBe(false);
    await ctx.close();
  });
}
