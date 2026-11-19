import { expect, test } from '@playwright/test';

test('annuler une signature revient à la liste sans enregistrer', async ({ page }) => {
  await page.goto('/autre-nom/admin/');
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible({ timeout: 45_000 });
  await page.locator('.admin-nav').getByRole('link', { name: 'Équipe', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Signatures', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Modifier' }).first().click();
  await expect(page.getByRole('heading', { name: 'Modifier une signature' })).toBeVisible();
  const name = page.getByLabel('Nom', { exact: true });
  const original = await name.inputValue();
  await name.fill('Nom qui ne doit pas rester');
  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('heading', { name: 'Signatures', exact: true })).toBeVisible();
  await expect(page.getByText('Nom qui ne doit pas rester')).toHaveCount(0);
  await expect(page.getByText(original).first()).toBeVisible();
});

test('une section se colore dans la page, et Annuler ne change rien', async ({ page }) => {
  await page.goto('/autre-nom/admin/');
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible({ timeout: 45_000 });
  await page.locator('.admin-nav').getByRole('link', { name: 'Sections et catégories', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sections et catégories', level: 1 })).toBeVisible();
  const row = () => page.locator('.entity-list li').filter({ hasText: 'Actualités' }).first();
  const picker = () => row().getByLabel('Couleur : Actualités');
  await expect(picker()).toHaveValue('#c45c26');
  await row().getByRole('button', { name: 'Modifier' }).click();
  await expect(page.getByRole('heading', { name: 'Modifier une section' })).toBeVisible();
  await expect(page.locator('#taxonomy-color')).toHaveValue('#c45c26');
  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('heading', { name: 'Sections et catégories', level: 1 })).toBeVisible();
  await expect(picker()).toHaveValue('#c45c26');
  await expect(row()).toContainText('#c45c26');

  await picker().fill('#123456');
  await expect(row()).toContainText('#123456');
  await expect(picker()).toHaveValue('#123456');
});

test('un lien et une photo se décrivent dans la page', async ({ page }) => {
  await page.goto('/autre-nom/admin/');
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible({ timeout: 45_000 });
  await page.locator('.admin-nav').getByRole('link', { name: 'Articles', exact: true }).click();
  await page.getByRole('button', { name: 'Modifier' }).first().click();
  await expect(page.getByRole('heading', { name: 'Modifier un article' })).toBeVisible();
  await page.getByLabel('Format du texte').selectOption('html');
  await page.getByRole('button', { name: 'Visuel' }).click();
  await page.getByRole('button', { name: 'Lien' }).click();
  await expect(page.getByRole('heading', { name: 'Adresse du lien' })).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('heading', { name: 'Adresse du lien' })).toHaveCount(0);

  await page.locator('#article-inline-file').setInputFiles({
    name: 'note.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'),
  });
  await expect(page.getByRole('heading', { name: 'Photo dans le texte' })).toBeVisible();
  await page.getByLabel('Ce que montre la photo').fill('Un pixel de test');
  await page.getByLabel('Crédit photo (qui l’a prise)').fill('Équipe de test');
  await page.getByRole('dialog').getByRole('button', { name: 'Ajouter' }).click();
  await expect(page.getByRole('heading', { name: 'Photo dans le texte' })).toHaveCount(0);
  await expect(page.locator('#toast')).toContainText('Photo ajoutée');
});
