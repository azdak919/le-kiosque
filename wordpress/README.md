# Extension WordPress « Le Kiosque »

Configure un WordPress **neuf** en quelques clics à partir du fichier
`kiosque-config.json` téléchargé à la dernière étape du
[configurateur](https://azdak919.github.io/le-kiosque/configurer/).

1. Compressez le dossier `le-kiosque/` en `le-kiosque.zip` (ou prenez celui de la trousse).
2. WordPress → **Extensions → Ajouter → Téléverser une extension** → choisir le zip → **Installer** → **Activer**.
3. On arrive sur l’écran **Le Kiosque** : déposer `kiosque-config.json` → **Configurer**.

Mesuré sur un WordPress 7.1 vierge (Playground CLI) : **8 clics, ~8 s**.

## Ce qui est créé
- Thème de blocs « Le Kiosque » aux couleurs du journal, logo, bandeau de l’établissement.
- Rubriques (catégories) et menu; pages Équipe, À propos, Politique de correction, Déontologie.
- Rôles : **Journaliste** (écrit, soumet à la relecture), **Chef de pupitre** (relit et corrige, ne publie pas), **Rédacteur en chef** (publie). Flux natif « En attente de relecture » : aucune extension tierce.
- Champs : chapeau, signatures multiples, crédit photo (panneau « Le Kiosque » de l’éditeur, exposés dans l’API REST pour la synchro du jalon 5).
- Liens permanents `/%year%/%monthnum%/%postname%/`, RSS complet (chapeau en résumé, `dc:creator` par signataire, image en `enclosure`), fuseau America/Toronto, inscriptions et commentaires anonymes fermés.

## Sûr
- **Idempotent** : réimporter ne crée aucun doublon.
- **Réversible** : bouton « Annuler la configuration » (ou `wp kiosque annuler`) : réglages et thème d’origine rétablis, pages créées à la corbeille, personnes ramenées au rôle WordPress de base.
- WP-CLI : `wp kiosque importer kiosque-config.json`.

## Essayer sans rien installer
`blueprint.json` (WordPress Playground) installe l’extension depuis ce dépôt et applique `exemple-kiosque-config.json`.
