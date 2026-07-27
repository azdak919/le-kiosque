# Mode démonstration local PGlite

Le mode `demo-local` permet d’essayer un journal complet sur GitHub Pages sans
serveur, terminal, compte d’administration, OAuth ou jeton. PostgreSQL s’exécute
dans le navigateur avec PGlite et conserve ses données dans IndexedDB.

## Ce qui fonctionne

- création, modification, suppression et prévisualisation d’articles;
- statuts Brouillon, En révision et Publié;
- auteurs, sections, catégories, mots-clés, identité et barre radio;
- mise à jour du front end dans les autres onglets;
- logo local, trois typographies et couleurs;
- masquage, suppression et restauration du contenu fictif;
- export JSON portable, export ZIP Markdown et import JSON.

Seuls les articles publiés apparaissent dans le front end. Un brouillon ou un
article en révision reste visible uniquement dans `/admin/`.

## Où se trouvent les données

Les données restent uniquement dans IndexedDB, pour l’origine et le chemin du
journal ouverts. Elles ne sont pas partagées entre appareils, navigateurs,
profils ou personnes. Un nettoyage des données du navigateur peut les effacer.
Téléchargez un JSON avant toute réinitialisation et un ZIP Markdown avant de
passer à GitHub.

## Ce que ce mode n’est pas

Ce mode ne fournit pas d’authentification réelle, de permissions, de rédaction
collaborative, de sauvegarde distante, de serveur ou de publication GitHub
automatique. Les rôles d’auteur, de révision et d’édition sont descriptifs.

## Passer à GitHub et Sveltia

1. Dans `/admin/`, ouvrez « Exporter et poursuivre ».
2. Téléchargez le ZIP Markdown et la sauvegarde JSON.
3. Créez un dépôt avec « Use this template ».
4. Copiez les fichiers exportés en conservant leurs chemins.
5. Activez GitHub Actions et Pages.
6. Branchez Sveltia en suivant [`brancher-sveltia.md`](brancher-sveltia.md).

Cette transition est volontairement explicite : KIOSQUE ne reçoit jamais votre
mot de passe ou votre jeton et ne prétend pas avoir publié à votre place.
