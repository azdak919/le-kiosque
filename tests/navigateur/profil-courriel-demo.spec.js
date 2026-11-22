import { expect, test } from '@playwright/test';

/**
 * Sur la démo Le Quorum, « Mon profil » ne doit plus afficher le HTML de la
 * page d’accueil lorsqu’on demande la confirmation d’un nouveau courriel.
 * Le changement reste local, sans appel à /v1/auth/. Un seul texte à la fois :
 * l’aide avant le clic, le statut après, sans répétition.
 */
const PAGE_ACCUEIL = `<!doctype html><html lang="fr-CA"><head><title>Le Quorum — On vote, on débat, on imprime</title></head><body></body></html>`;

const AIDE = 'Dans cette démonstration, aucun lien n’est envoyé : il n’y a pas de serveur d’envoi.';
const STATUT = 'Le courriel a été mis à jour uniquement dans votre navigateur.';

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
  await expect(status).toBeHidden();
  await expect(aide).toBeVisible();
  await expect(aide).toHaveText(AIDE);
  await expect(page.getByText(STATUT)).toHaveCount(0);

  await page.getByLabel('Nouveau courriel').fill('redaction@exemple.ca');
  await page.getByRole('button', { name: 'Demander la confirmation' }).click();
  await expect(status).toBeVisible();
  await expect(status).toHaveText(STATUT);
  await expect(aide).toBeHidden();
  await expect(page.getByText(AIDE)).toBeHidden();
  await expect(status).not.toContainText('<!doctype');
  await expect(status).not.toContainText('Le Quorum');
  await expect(status).not.toContainText('On vote, on débat');
  await expect(page.getByText('Adresse actuelle : redaction@exemple.ca')).toBeVisible();
  expect(authCalls, 'aucun appel à /v1/auth/ en démonstration').toEqual([]);
});
