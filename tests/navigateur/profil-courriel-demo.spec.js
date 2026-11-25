import { expect, test } from '@playwright/test';

/**
 * Sur la démo Le Quorum, « Mon profil » ne doit plus afficher le HTML de la
 * page d’accueil lorsqu’on demande la confirmation d’un nouveau courriel.
 * Le changement reste local, sans appel à /v1/auth/. Un seul texte à la fois :
 * l’aide avant le clic, le statut après, sans répétition. L’adresse fictive
 * du compte de démonstration s’affiche dès l’ouverture.
 */
const PAGE_ACCUEIL = `<!doctype html><html lang="fr-CA"><head><title>Le Quorum — On vote, on débat, on imprime</title></head><body></body></html>`;

const AIDE = 'Dans cette démonstration, aucun lien n’est envoyé : il n’y a pas de serveur d’envoi.';
const STATUT = 'Le courriel a été mis à jour uniquement dans votre navigateur.';
const ADRESSE_DEMO = 'Adresse actuelle : redaction@exemple.ca';
const ADRESSE_NOUVELLE = 'Adresse actuelle : lea@exemple.ca';

async function ouvrirProfil(page) {
  const authCalls = [];
  await page.route('**/v1/auth/**', async (route) => {
    authCalls.push(`${route.request().method()} ${route.request().url()}`);
    await route.fulfill({ status: 404, contentType: 'text/html; charset=utf-8', body: PAGE_ACCUEIL });
  });
  await page.goto('/autre-nom/admin/');
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible({ timeout: 45_000 });
  await page.locator('.admin-nav').getByRole('link', { name: 'Mon profil', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mon profil' })).toBeVisible();
  await expect(page.getByLabel('Nouveau courriel')).toBeVisible();
  return authCalls;
}

test('en démo, demander la confirmation ne montre pas le HTML de la page d’accueil', async ({ page }) => {
  const authCalls = await ouvrirProfil(page);
  const aide = page.locator('#profile-email-aide');
  const status = page.locator('#profile-status');
  const adresse = page.locator('#profile-email');
  const pastille = page.locator('#profile-email-etat');
  await expect(status).toBeHidden();
  await expect(aide).toBeVisible();
  await expect(aide).toHaveText(AIDE);
  await expect(adresse).toHaveText(ADRESSE_DEMO);
  await expect(pastille).toBeVisible();
  await expect(pastille).toHaveText('État : Non confirmée');
  const alignement = await page.evaluate(() => {
    const heading = [...document.querySelectorAll('h3')].find((el) => el.textContent.trim() === 'Courriel');
    const line = document.getElementById('profile-email');
    const chip = document.getElementById('profile-email-etat');
    const hr = heading.getBoundingClientRect();
    const lr = line.getBoundingClientRect();
    const cr = chip.getBoundingClientRect();
    return { headingLeft: hr.left, lineLeft: lr.left, chipLeft: cr.left, lineWidth: lr.width, lineEmpty: !line.textContent.trim() };
  });
  expect(alignement.lineEmpty, 'la ligne d’adresse ne doit pas être vide').toEqual(false);
  expect(Math.abs(alignement.lineLeft - alignement.headingLeft), 'l’adresse s’aligne à gauche, sous le titre').toBeLessThan(2);
  expect(alignement.chipLeft, 'la pastille suit l’adresse, sans vide à gauche').toBeGreaterThan(alignement.lineLeft + alignement.lineWidth);
  await expect(page.getByText(STATUT)).toHaveCount(0);

  await page.getByLabel('Nouveau courriel').fill('lea@exemple.ca');
  await page.getByRole('button', { name: 'Demander la confirmation' }).click();
  await expect(status).toBeVisible();
  await expect(status).toHaveText(STATUT);
  await expect(aide).toBeHidden();
  await expect(page.getByText(AIDE)).toBeHidden();
  await expect(adresse).toHaveText(ADRESSE_NOUVELLE);
  await expect(pastille).toBeVisible();
  await expect(status).not.toContainText('<!doctype');
  await expect(status).not.toContainText('Le Quorum');
  await expect(status).not.toContainText('On vote, on débat');
  expect(authCalls, 'aucun appel à /v1/auth/ en démonstration').toEqual([]);
});
