import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

const ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

/**
 * Nombre de médias de la banque démo embarquée dans le seed du site servi
 * par Playwright (`npm run site` avec BASE=/autre-nom → dist/demo/…/seed.json).
 * Ne JAMAIS figer ce chiffre dans le test : chaque photo ajoutée cassait la CI
 * (ex. 50 vs 51). Source de vérité = seed généré au build.
 */
function demoSeedMediaCount() {
  const seedPath = path.join(ROOT, 'dist/demo/assets/editorial/seed.json');
  const seed = JSON.parse(readFileSync(seedPath, 'utf8'));
  const n = Array.isArray(seed.media) ? seed.media.length : 0;
  if (n < 40) {
    throw new Error(`seed démo trop court (${n} médias) — rebuild site avant le test navigateur`);
  }
  return n;
}

test('configurer, rédiger, prévisualiser, publier, persister et exporter sans serveur', async ({ page, context }) => {
  // Ce parcours exerce la base sql.js, deux téléchargements et une réimportation ; il
  // reste volontairement intégral. La banque élargie allonge reset/import —
  // 4 min sur un CI saturé.
  test.setTimeout(240_000);
  const expectedMediaCount = demoSeedMediaCount();
  await page.goto('/autre-nom/configurer/');
  await page.locator('[data-key="name"]').fill('La Relève locale');
  await page.locator('[data-key="institution"]').fill('Cégep de démonstration');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.locator('[data-key="accent"]').fill('#005a78');
  await page.locator('section[data-step="2"] .avance > summary').click();
  await page.getByLabel('Typographie').selectOption('editorial-classic');
  await page.getByLabel('Logo facultatif').setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#005a78"/></svg>') });
  await expect(page.locator('#preview-logo')).toBeVisible();
  // Le texte alternatif reste vide (exemple pâle) : le nom du journal en tient lieu.
  await expect(page.locator('[data-key="logoAlt"]')).toHaveValue('');
  await expect(page.locator('[data-key="logoAlt"]')).toHaveAttribute('placeholder', 'La Relève locale');
  await page.getByRole('button', { name: 'Continuer' }).click();
  // Les sections ne sont plus préremplies : sans section, l'étape le signale ; on part des sections proposées.
  await page.getByRole('button', { name: 'Terminer' }).click();
  await expect(page.locator('section[data-step="3"] .step-error')).toHaveText('Gardez au moins une section.');
  await page.getByRole('button', { name: 'Partir des sections proposées' }).click();
  await page.getByRole('button', { name: 'Terminer' }).click();
  await expect(page.getByRole('heading', { name: 'C’est prêt.' })).toBeVisible();
  await page.getByRole('link', { name: 'Ouvrir /admin/' }).click();
  await expect(page.getByText('Mode démonstration local — données conservées dans ce navigateur')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('.admin-brand').getByRole('img', { name: 'La Relève locale' })).toBeVisible();
  await expect(page).toHaveTitle('Tableau de bord — La Relève locale');

  await page.locator('.admin-nav').getByRole('link', { name: 'Photos', exact: true }).click();
  // Banque démo = seed (pas un entier magique 50/51).
  await expect(page.locator('.media-card')).toHaveCount(expectedMediaCount);
  await page.getByLabel('Rechercher une photo (lieu, sujet, mot-clé)').fill('Jonquière');
  await expect(page.locator('.media-card:visible')).toHaveCount(2);
  await page.locator('.admin-nav').getByRole('link', { name: 'Tableau de bord', exact: true }).click();

  await page.getByRole('button', { name: 'Créer un article' }).click();
  await page.getByLabel('Titre').fill('Un article créé dans le navigateur');
  await page.getByLabel('Résumé').fill('Une validation complète du mode local.');
  await page.getByLabel('Date et heure de publication').fill('2026-07-27T08:45');
  await page.getByLabel('Texte de l’article').fill('## Une vraie prévisualisation\n\nLe contenu demeure dans **ce navigateur**.');
  await page.getByLabel('Marie Tremblay').check();
  await page.getByRole('button', { name: 'Choisir une photo' }).click();
  const articlePicker = page.locator('.media-picker');
  await articlePicker.getByLabel('Rechercher une photo (lieu, sujet, mot-clé)').fill('Limoilou');
  await articlePicker.getByRole('button', { name: 'Choisir cette photo' }).click();
  await expect(page.locator('#article-lead-preview .crop-preview')).toHaveCount(3);
  await page.getByLabel('Cadrage horizontal').fill('71');
  await page.getByLabel('Cadrage vertical').fill('38');
  await page.getByRole('button', { name: 'Prévisualiser sans publier' }).click();
  await expect(page.getByText('Une vraie prévisualisation')).toBeVisible();
  await page.getByRole('button', { name: 'Enregistrer' }).click();

  const row = page.locator('.entity-list li').filter({ hasText: 'Un article créé dans le navigateur' });
  const front = await context.newPage();
  await front.goto('/autre-nom/demo/');
  await front.waitForFunction(() => document.documentElement.dataset.editorialReady === 'true', null, { timeout: 45_000 });
  await expect(front.locator('.publication-logo')).toBeVisible();
  await expect(front.locator('html')).toHaveAttribute('data-typography', 'editorial-classic');
  // La démo (sql.js) doit employer le même noyau de carte que le HTML statique :
  // vignettes en bref, mais aucune image réintroduite dans la suite du fil.
  await expect(front.locator('article.article--brief.has-image .article-media').first()).toBeVisible();
  await expect(front.locator('article.article--tail .article-media')).toHaveCount(0);
  await expect(front.getByText('Un article créé dans le navigateur')).toHaveCount(0);

  await row.getByRole('button', { name: 'Modifier' }).click();
  await page.getByLabel('Statut').selectOption('in-review');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(front.getByText('Un article créé dans le navigateur')).toHaveCount(0);

  await page.locator('.entity-list li').filter({ hasText: 'Un article créé dans le navigateur' }).getByRole('button', { name: 'Modifier' }).click();
  await page.getByLabel('Statut').selectOption('published');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  const createdArticleLink = front.getByRole('link', { name: 'Un article créé dans le navigateur', exact: true });
  await expect(createdArticleLink).toBeVisible();
  await createdArticleLink.click();
  await expect(front.getByRole('heading', { level: 1, name: 'Un article créé dans le navigateur' })).toBeVisible();
  await expect(front.locator('.post-meta time')).toHaveAttribute('datetime', new Date('2026-07-27T08:45').toISOString());

  await page.locator('.entity-list li').filter({ hasText: 'Un article créé dans le navigateur' }).getByRole('button', { name: 'Modifier' }).click();
  await page.getByLabel('Titre').fill('Un article local mis à jour');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(front.getByRole('heading', { level: 1, name: 'Un article local mis à jour' })).toBeVisible();
  await front.reload();
  await front.waitForFunction(() => document.documentElement.dataset.editorialReady === 'true', null, { timeout: 45_000 });
  await expect(front.getByRole('heading', { level: 1, name: 'Un article local mis à jour' })).toBeVisible();

  await page.locator('.admin-nav').getByRole('link', { name: 'Tableau de bord', exact: true }).click();
  await page.getByLabel('Afficher les exemples publiés sur le site').uncheck();
  await expect(front.getByText('La radio de campus souffle ses cinquante bougies')).toHaveCount(0);
  await expect(front.getByRole('heading', { level: 1, name: 'Un article local mis à jour' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Supprimer les exemples non modifiés' }).click();
  await page.locator('.admin-nav').getByRole('link', { name: 'Articles', exact: true }).click();
  await expect(page.getByText('Exemple local')).toHaveCount(0);
  await expect(page.getByText('Un article local mis à jour')).toBeVisible();
  await page.locator('.admin-nav').getByRole('link', { name: 'Tableau de bord', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Restaurer Le Quorum' }).click();
  // Import banque + sql.js : long en CI. Le toast (#toast) est éphémère (CSS/timing) —
  // attendre le bouton redevenu utilisable puis les exemples en liste.
  await expect(page.getByRole('button', { name: 'Restaurer Le Quorum' })).toBeEnabled({ timeout: 90_000 });
  await expect(page.locator('.admin-brand').getByRole('img', { name: 'La Relève locale' })).toBeVisible();
  await page.locator('.admin-nav').getByRole('link', { name: 'Articles', exact: true }).click();
  await expect(page.getByText('Exemple local').first()).toBeVisible({ timeout: 60_000 });

  await page.locator('.admin-nav').getByRole('link', { name: 'Configuration', exact: true }).click();
  await page.getByRole('button', { name: 'Choisir une photo' }).click();
  const mastheadPicker = page.locator('.media-picker');
  await mastheadPicker.getByLabel('Rechercher une photo (lieu, sujet, mot-clé)').fill('McGill');
  await mastheadPicker.getByRole('button', { name: 'Choisir cette photo' }).first().click();
  await page.getByLabel('Cadrage horizontal').fill('73');
  await page.getByLabel('Cadrage vertical').fill('42');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(front.locator('.masthead-background')).toHaveAttribute('src', /mcgill-(roddick|campus|arts)\.jpg/);

  await page.locator('.admin-nav').getByRole('link', { name: 'Exporter', exact: true }).click();
  const jsonEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger la sauvegarde JSON' }).click();
  const jsonDownload = await jsonEvent;
  const jsonPath = await jsonDownload.path();
  const json = JSON.parse((await (await jsonDownload.createReadStream()).toArray()).map((chunk) => chunk.toString()).join(''));
  expect(json.format).toBe('kiosque-editorial-backup');
  expect(json.bundle.media.length).toBeGreaterThanOrEqual(40);
  expect(json.bundle.publication.masthead.backgrounds.images[0].institution).toBe('Université McGill');
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
  // Reset complet + rechargement sql.js de la banque démo : long sur CI.
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible({ timeout: 60_000 });
  await page.locator('.admin-nav').getByRole('link', { name: 'Exporter', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Importer une sauvegarde' }).click();
  // Le handler de fichier est asynchrone : attendre explicitement le dialogue
  // évite de rater la confirmation lorsque la base répond plus vite qu’un CI.
  const importDialog = page.waitForEvent('dialog');
  await (await chooser).setFiles(jsonPath);
  await importDialog.then((dialog) => dialog.accept());
  await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible({ timeout: 60_000 });
  await page.locator('.admin-nav').getByRole('link', { name: 'Articles', exact: true }).click();
  await expect(page.getByText('Un article local mis à jour')).toBeVisible({ timeout: 30_000 });
  await page.locator('.admin-nav').getByRole('link', { name: 'Configuration', exact: true }).click();
  await expect(page.locator('#masthead-crop-preview img').first()).toHaveAttribute('src', /mcgill-(roddick|campus|arts)\.jpg/, { timeout: 30_000 });
});

test('l’alias admin redirige et le bandeau ne promet aucun service distant', async ({ page }) => {
  await page.goto('/autre-nom/demo/admin/');
  await expect(page).toHaveURL(/\/autre-nom\/admin\//);
  await expect(page.getByText('Mode démonstration local')).toBeVisible({ timeout: 45_000 });
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/authentification réelle|sauvegarde distante|publication automatique dans GitHub/i);
});

test('un lecteur de la démo ne télécharge pas la base sql.js (réservée à /admin/)', async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const base = [];
  ctx.on('request', (r) => { if (/pglite|sql-wasm|\.wasm$|\.data$/.test(r.url())) base.push(r.url()); });
  await page.goto('/autre-nom/demo/');
  await page.waitForFunction(() => document.documentElement.dataset.editorialReady === 'true');
  await page.waitForTimeout(1500);
  expect(base).toEqual([]);
  await ctx.close();
});

test('la page Mise à jour garde la coquille de l’admin et y ramène', async ({ page }) => {
  await page.goto('/autre-nom/admin/');
  // Un clic avant l’ouverture de la base ne doit plus figer l’admin.
  await page.locator('.admin-nav').getByRole('link', { name: 'Photos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Photos', level: 1 })).toBeVisible({ timeout: 60_000 });
  await expect(page).toHaveURL(/\/admin\/#media$/);
  await page.locator('.admin-nav').getByRole('link', { name: 'Mise à jour' }).click();
  await expect(page).toHaveURL(/\/autre-nom\/admin\/mise-a-jour\/$/);
  await expect(page.getByRole('heading', { name: 'Mise à jour', level: 2 })).toBeVisible();
  await expect(page.locator('.admin-nav [aria-current="page"]')).toHaveText('Mise à jour');
  await expect(page.locator('.update-line')).toHaveCount(2);
  await page.locator('.admin-nav').getByRole('link', { name: 'Articles', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/#articles$/);
  await expect(page.getByRole('heading', { name: 'Articles', level: 1 })).toBeVisible({ timeout: 60_000 });
});

test('l’éditeur programme et archive un article', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/autre-nom/admin/#articles');
  await expect(page.getByRole('heading', { name: 'Articles', level: 1 })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Nouvel article' }).click();
  await page.getByLabel('Titre').fill('Article programmé');
  await page.getByLabel('Adresse de l’article').fill('article-programme');
  await page.getByLabel('Résumé').fill('Sortira demain.');
  await page.locator('input[name="authors"]').first().check();
  await expect(page.locator('[data-scheduled-field]')).toBeHidden();
  await page.getByLabel('Statut').selectOption('scheduled');
  await expect(page.locator('[data-scheduled-field]')).toBeVisible();
  // Une heure passée est refusée.
  await page.getByLabel('Programmer pour').fill('2020-01-01T08:00');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.locator('#toast')).toContainText('déjà passée');
  const demain = new Date(Date.now() + 24 * 3600_000);
  const local = new Date(demain.getTime() - demain.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  await page.getByLabel('Programmer pour').fill(local);
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  const row = page.locator('.entity-list li', { hasText: 'Article programmé' });
  await expect(row).toContainText('Programmé');
  await row.getByRole('button', { name: 'Modifier' }).click();
  await expect(page.getByLabel('Statut')).toHaveValue('scheduled');
  await page.getByLabel('Statut').selectOption('archived');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.locator('.entity-list li', { hasText: 'Article programmé' })).toContainText('Archivé');
});
