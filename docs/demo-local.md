# Mode démonstration local

Le mode `demo-local` permet d’essayer un journal complet sur GitHub Pages sans
serveur, terminal, compte d’administration, OAuth ou jeton. SQLite s’exécute
dans le navigateur avec sql.js (MIT) et conserve ses données dans IndexedDB.
La base (environ 0,7 Mo) vient de l’admin du socle et ne se charge que pour
`/admin/` ou le configurateur.

## Comment y entrer depuis la démo publique

Sur la démonstration Le Quorum, une pastille d’accent dans le mât et un lien
au pied de page portent le libellé « Essayer l’espace de rédaction (démo) »
(au téléphone : « Espace de rédaction (démo) »). Les deux mènent à `/admin/`.
Rien n’est enregistré sur un serveur : les données restent dans ce navigateur
et se réinitialisent. Ce bouton n’existe que si le drapeau de configuration
`demoEditorialEntry` est activé, ce qui n’est le cas que de la vitrine. Un
journal installé n’a jamais cette pastille.

## Ce qui fonctionne

- création, modification, suppression et prévisualisation d’articles;
- statuts Brouillon, En révision, Programmé, Publié et Archivé;
- banque de photos : ses propres photos, avec crédit obligatoire, réutilisables;
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
