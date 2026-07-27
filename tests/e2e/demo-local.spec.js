import { expect, test } from '@playwright/test';

test('configurer, rédiger, prévisualiser, publier, persister et exporter sans serveur', async ({ page, context }) => {
  await page.goto('/autre-nom/configurer/');
  await page.getByRole('button', { name: 'Commencer' }).click();
  await page.getByLabel('Nom du journal').fill('La Relève locale');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.locator('[data-key="accent"]').fill('#005a78');
  await page.getByLabel('Typographie').selectOption('editorial-classic');
  await page.getByLabel('Logo facultatif').setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#005a78"/></svg>') });
  for (let click = 0; click < 7; click++) await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Voir les prochaines étapes' }).click();

  await expect(page.getByRole('heading', { name: 'Votre prochaine étape est concrète.' })).toBeVisible();
  await page.getByRole('link', { name: 'Ouvrir /admin/' }).click();
  await expect(page.getByText('Mode démonstration local — les données sont conservées uniquement dans ce navigateur')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('#publication-name')).toHaveText('La Relève locale');

  await page.getByRole('button', { name: 'Médias de démonstration' }).click();
  await expect(page.locator('.media-card')).toHaveCount(6);
  await page.getByLabel('Rechercher un établissement, un campus ou un mot-clé').fill('Jonquière');
  await expect(page.locator('.media-card:visible')).toHaveCount(2);
  await page.getByRole('button', { name: 'Tableau de bord' }).click();

  await page.getByRole('button', { name: 'Créer un article' }).click();
  await page.getByLabel('Titre').fill('Un article créé dans le navigateur');
  await page.getByLabel('Résumé').fill('Une validation complète du mode local.');
  await page.getByLabel('Date et heure de publication').fill('2026-07-27T08:45');
  await page.getByLabel('Texte de l’article').fill('## Une vraie prévisualisation\n\nLe contenu demeure dans **ce navigateur**.');
  await page.getByLabel('Marie Tremblay').check();
  await page.getByRole('button', { name: 'Choisir dans la banque de démonstration' }).click();
  const articlePicker = page.locator('.media-picker');
  await articlePicker.getByLabel('Rechercher un établissement, un campus ou un mot-clé').fill('Limoilou');
  await articlePicker.getByRole('button', { name: 'Choisir cette photo' }).click();
  await expect(page.locator('#article-lead-preview .crop-preview')).toHaveCount(3);
  await page.getByLabel('Point focal X').fill('71');
  await page.getByLabel('Point focal Y').fill('38');
  await page.getByRole('button', { name: 'Prévisualiser sans publier' }).click();
  await expect(page.getByText('Une vraie prévisualisation')).toBeVisible();
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  const row = page.locator('.entity-list li').filter({ hasText: 'Un article créé dans le navigateur' });
  const front = await context.newPage();
  await front.goto('/autre-nom/demo/');
  await front.waitForFunction(() => document.documentElement.dataset.editorialReady === 'true', null, { timeout: 45_000 });
  await expect(front.locator('.publication-logo')).toBeVisible();
  await expect(front.locator('html')).toHaveAttribute('data-typography', 'editorial-classic');
  await expect(front.getByText('Un article créé dans le navigateur')).toHaveCount(0);

  await row.getByRole('button', { name: 'Modifier' }).click();
  await page.getByLabel('Statut').selectOption('in-review');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(front.getByText('Un article créé dans le navigateur')).toHaveCount(0);

  await page.locator('.entity-list li').filter({ hasText: 'Un article créé dans le navigateur' }).getByRole('button', { name: 'Modifier' }).click();
  await page.getByLabel('Statut').selectOption('published');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(front.getByText('Un article créé dans le navigateur')).toBeVisible();
  await front.getByText('Un article créé dans le navigateur').click();
  await expect(front.getByRole('heading', { level: 1, name: 'Un article créé dans le navigateur' })).toBeVisible();
  await expect(front.locator('.post-meta time')).toHaveAttribute('datetime', new Date('2026-07-27T08:45').toISOString());

  await page.locator('.entity-list li').filter({ hasText: 'Un article créé dans le navigateur' }).getByRole('button', { name: 'Modifier' }).click();
  await page.getByLabel('Titre').fill('Un article local mis à jour');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(front.getByRole('heading', { level: 1, name: 'Un article local mis à jour' })).toBeVisible();
  await front.reload();
  await front.waitForFunction(() => document.documentElement.dataset.editorialReady === 'true', null, { timeout: 45_000 });
  await expect(front.getByRole('heading', { level: 1, name: 'Un article local mis à jour' })).toBeVisible();

  await page.getByRole('button', { name: 'Tableau de bord' }).click();
  await page.getByLabel('Afficher les exemples publiés dans le front end').uncheck();
  await expect(front.getByText('La radio de campus souffle ses cinquante bougies')).toHaveCount(0);
  await expect(front.getByRole('heading', { level: 1, name: 'Un article local mis à jour' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Supprimer les exemples non modifiés' }).click();
  await page.getByRole('button', { name: 'Articles' }).click();
  await expect(page.getByText('Exemple local')).toHaveCount(0);
  await expect(page.getByText('Un article local mis à jour')).toBeVisible();
  await page.getByRole('button', { name: 'Tableau de bord' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Restaurer Le Quorum' }).click();
  await expect(page.getByText('Les exemples du Quorum sont restaurés.')).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('#publication-name')).toHaveText('La Relève locale');
  await page.getByRole('button', { name: 'Articles' }).click();
  await expect(page.getByText('Exemple local').first()).toBeVisible();

  await page.getByRole('button', { name: 'Configuration' }).click();
  await page.getByRole('button', { name: 'Choisir dans la banque de démonstration' }).click();
  const mastheadPicker = page.locator('.media-picker');
  await mastheadPicker.getByLabel('Rechercher un établissement, un campus ou un mot-clé').fill('Rimouski');
  await mastheadPicker.getByRole('button', { name: 'Choisir cette photo' }).click();
  await page.getByLabel('Point focal X').fill('73');
  await page.getByLabel('Point focal Y').fill('42');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(front.locator('.masthead-background')).toHaveAttribute('src', /cegep-rimouski\.jpg/);

  await page.getByRole('button', { name: 'Exporter et poursuivre' }).click();
  const jsonEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger la sauvegarde JSON' }).click();
  const jsonDownload = await jsonEvent;
  const jsonPath = await jsonDownload.path();
  const json = JSON.parse((await (await jsonDownload.createReadStream()).toArray()).map((chunk) => chunk.toString()).join(''));
  expect(json.format).toBe('kiosque-editorial-backup');
  expect(json.bundle.media).toHaveLength(6);
  expect(json.bundle.publication.masthead.backgrounds.images[0].institution).toBe('Cégep de Rimouski');
  expect(json.bundle.publication.masthead.backgrounds.images[0].focalPoint).toEqual({ x: 73, y: 42 });
  expect(json.bundle.articles.find((article) => article.title === 'Un article local mis à jour').lead.institution).toBe('Cégep Limoilou');
  expect(json.bundle.articles.find((article) => article.title === 'Un article local mis à jour').lead.focalPoint).toEqual({ x: 71, y: 38 });
  expect(JSON.stringify(json)).not.toMatch(/token|password|secret/i);
  const zipEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger le journal Markdown' }).click();
  const zip = await zipEvent;
  const chunks = await (await zip.createReadStream()).toArray();
  expect(Buffer.concat(chunks).subarray(0, 2).toString()).toBe('PK');

  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Réinitialiser Le Quorum' }).click();
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();
  await page.getByRole('button', { name: 'Exporter et poursuivre' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importer une sauvegarde' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await (await chooser).setFiles(jsonPath);
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible();
  await page.getByRole('button', { name: 'Articles' }).click();
  await expect(page.getByText('Un article local mis à jour')).toBeVisible();
  await page.getByRole('button', { name: 'Configuration' }).click();
  await expect(page.locator('#masthead-crop-preview img').first()).toHaveAttribute('src', /cegep-rimouski\.jpg/);
});

test('l’alias admin redirige et le bandeau ne promet aucun service distant', async ({ page }) => {
  await page.goto('/autre-nom/demo/admin/');
  await expect(page).toHaveURL(/\/autre-nom\/admin\//);
  await expect(page.getByText('Mode démonstration local')).toBeVisible({ timeout: 45_000 });
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/authentification réelle|sauvegarde distante|publication automatique dans GitHub/i);
});
