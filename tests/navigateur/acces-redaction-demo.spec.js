import { expect, test } from '@playwright/test';

/**
 * Accès à l’espace de rédaction depuis la démo Le Quorum : pastille dans le
 * mât et lien explicite au pied, sans chevauchement, en clair et en sombre.
 */
const largeurs = [390, 768, 1440];

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

for (const theme of ['light', 'dark']) {
  for (const largeur of largeurs) {
    test(`pastille de démo visible et sans chevauchement à ${largeur} px (${theme})`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: largeur, height: 900 },
        colorScheme: theme,
        isMobile: largeur <= 390,
        hasTouch: largeur <= 390,
      });
      await fauxRadar(ctx);
      const page = await ctx.newPage();
      await page.goto('/autre-nom/demo/');
      const pastille = page.locator('.masthead-demo-editorial');
      await expect(pastille).toBeVisible();
      await expect(pastille).toHaveAttribute('href', '/autre-nom/admin/');
      const label = largeur <= 720 ? 'Espace de rédaction (démo)' : 'Essayer l’espace de rédaction (démo)';
      await expect(pastille).toHaveAccessibleName('Essayer l’espace de rédaction (démo)');
      await expect(pastille.locator(largeur <= 720 ? '.masthead-demo-editorial__short' : '.masthead-demo-editorial__full')).toBeVisible();
      await expect(pastille.locator(largeur <= 720 ? '.masthead-demo-editorial__full' : '.masthead-demo-editorial__short')).toBeHidden();
      await expect(pastille).toContainText(label);
      const pied = page.locator('.site-foot__redaction');
      await expect(pied).toBeVisible();
      await expect(pied).toHaveAttribute('href', '/autre-nom/admin/');
      await expect(pied).toContainText(label);

      const choc = await page.evaluate(() => {
        const pill = document.querySelector('.masthead-demo-editorial');
        if (!pill) return ['pastille absente'];
        const pr = pill.getBoundingClientRect();
        const coupe = pill.scrollWidth > pill.clientWidth + 1 || pr.bottom > window.innerHeight;
        const rogne = pr.top < 0 || pr.right > window.innerWidth + 1 || pr.left < -1;
        const cibles = [
          '.masthead-clock',
          '.masthead-tools',
          '.masthead-tools .masthead-tool',
          '.wordmark',
          '.masthead-tagline',
          '.masthead-meta',
          '.masthead-social',
          '.radar-radio-slot',
        ];
        const msgs = [];
        if (coupe) msgs.push('pastille tronquée');
        if (rogne) msgs.push('pastille hors de l’écran');
        for (const sel of cibles) {
          for (const el of document.querySelectorAll(sel)) {
            const b = el.getBoundingClientRect();
            if (!b.width || !b.height) continue;
            const ix = Math.min(pr.right, b.right) - Math.max(pr.left, b.left);
            const iy = Math.min(pr.bottom, b.bottom) - Math.max(pr.top, b.top);
            if (ix > 1 && iy > 1) msgs.push(`${sel} chevauche la pastille (${Math.round(ix)}×${Math.round(iy)} px)`);
          }
        }
        return msgs;
      });
      expect(choc).toEqual([]);
      const debordement = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(debordement, 'défilement horizontal').toBeLessThanOrEqual(1);
      await ctx.close();
    });
  }
}

test('la pastille du mât ouvre l’espace de rédaction en mode démonstration', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await fauxRadar(ctx);
  const page = await ctx.newPage();
  await page.goto('/autre-nom/demo/');
  await page.locator('.masthead-demo-editorial').click();
  await expect(page).toHaveURL(/\/autre-nom\/admin\/$/);
  await expect(page.getByText('Mode démonstration local — données conservées dans ce navigateur')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible({ timeout: 45_000 });
  await ctx.close();
});
