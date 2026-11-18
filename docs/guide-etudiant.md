# Guide étudiant : créer son journal de A à Z

Ce guide est **le** chemin recommandé. Il suppose un navigateur, un compte
GitHub et un hébergement PHP. Aucun terminal n'est nécessaire. Comptez
environ une heure la première fois.

Le principe : la **rédaction** (l'admin, les comptes, les photos) vit sur
votre hébergement PHP ; le **site public** est construit par GitHub et servi
gratuitement par GitHub Pages. Si l'hébergement tombe, le site reste en ligne.

## 0. Ce qu'il vous faut

- Un compte GitHub (gratuit). Idéalement une **organisation** au nom du
  journal, pour que le dépôt survive aux cohortes.
- Un hébergement **PHP 8.1 ou plus récent avec SQLite**, sous Apache ou
  LiteSpeed. Par ordre de préférence :
  1. le serveur web du cégep ou de l'association étudiante (demandez un
     dossier et un accès FTP ou un gestionnaire de fichiers) ;
  2. un hébergeur mutualisé PHP ordinaire (cPanel, Plesk, hPanel…).
  Un hébergeur uniquement sous nginx demande une règle de réécriture que
  seul l'hébergeur peut ajouter ; voir `LISEZMOI.txt` dans le paquet.
- Une adresse courriel de contact pour le journal.

Cloudflare : voir la section 10. Ce n'est **pas** faisable sans ligne de
commande aujourd'hui.

## 1. Créer le dépôt du journal

1. Ouvrez <https://github.com/azdak919/le-kiosque>.
2. **Use this template → Create a new repository**. Choisissez le propriétaire
   (l'organisation du journal), un nom court (ex. `la-boussole`) et
   **Public** (GitHub Pages gratuit l'exige).
3. Dans le nouveau dépôt : **Settings → Pages → Source : GitHub Actions**.

N'utilisez pas « Fork » : GitHub y coupe les Actions.

## 2. Installer la rédaction sur l'hébergement

1. Ouvrez <https://github.com/azdak919/le-socle/actions/workflows/verification.yml>,
   cliquez sur la dernière exécution réussie de la branche `main`, puis, en bas,
   sur l'artefact **le-socle-php** (il faut être connecté à GitHub). Le fichier
   téléchargé contient `le-socle-php.zip` : décompressez-le, vous obtenez un
   dossier `socle/`.
2. Avec le gestionnaire de fichiers de l'hébergeur (ou FTP), envoyez le dossier
   `socle/` **tel quel** dans votre espace web, par exemple
   `public_html/journal/socle/`. Gardez les fichiers cachés (`.htaccess`,
   `.user.ini`).
3. Ouvrez `https://<votre-site>/journal/socle/redaction/`. La première visite
   propose de **créer le compte responsable** : votre courriel et un mot de
   passe d'au moins 10 caractères. Notez-le dans le gestionnaire de mots de
   passe de l'équipe, jamais dans le dépôt.

Ce formulaire ne s'affiche qu'une fois : ensuite, seuls les comptes existants
se connectent. Les données (base SQLite, photos) vont dans `socle/donnees/`,
protégé contre la lecture publique.

Notez l'**adresse du socle** : `https://<votre-site>/journal/socle`.

## 3. Configurer le journal

1. Ouvrez le configurateur : <https://azdak919.github.io/le-kiosque/configurer/>.
2. Étapes **Votre journal**, **Apparence** et **Sections** : nom,
   établissement, couleurs, logo, sections, radio (facultative). Rien n'est
   prérempli : ce qui est vide reste vide.
3. Étape **C'est prêt** :
   - Où s'écrivent les articles : **Dans le socle — recommandé** ;
   - Adresse du socle : celle notée à l'étape 2 ;
   - Dépôt GitHub : `organisation/nom-du-depot` ;
   - Adresse du site public : laissez la valeur déduite du dépôt, sauf
     domaine à vous ;
   - Courriel de la rédaction et Qui publie ;
   - laissez **Garder les articles fictifs** décoché pour un vrai journal ;
   - cochez **Cacher le journal des moteurs de recherche** tant que c'est un
     essai.
4. La liste **À vérifier** dit ce qui manque. Quand elle affiche
   « Tout est prêt. », téléchargez :
   - **1. Fichiers du dépôt** (un ZIP) ;
   - **2. Réglages du socle** (`kiosque-config.json`).

Vos réponses restent dans ce navigateur : vous pouvez revenir corriger sans
tout ressaisir.

## 4. Déposer les fichiers dans GitHub

1. Décompressez le ZIP **Fichiers du dépôt** sur votre ordinateur.
2. Dans votre dépôt : **Add file → Upload files**, glissez **le contenu** du
   dossier décompressé (les dossiers `content/`, `theme/`, éventuellement
   `media/`, et les fichiers `kiosque.config.ts`, `kiosque-config.json`), puis
   **Commit changes**. Ils remplacent les fichiers d'exemple de même nom.
3. L'onglet **Actions** montre « Publier le journal » qui démarre. Au premier
   passage, autorisez les workflows si GitHub le demande.

## 5. Régler la rédaction

1. Dans l'admin du socle : **Configuration → Importer le fichier du
   configurateur** et choisissez `kiosque-config.json`. Vérifiez l'adresse du site et les responsables,
   puis **Enregistrer** (une seule fois suffit).
2. **Auteurs** : le panneau **Accès à la rédaction** ajoute les comptes de
   l'équipe (courriel, rôle : auteur, réviseur, éditeur ou responsable, et un
   mot de passe provisoire à leur transmettre). Plus bas, **Nouvelle
   signature** crée le nom que le public voit sous les articles.

## 6. Écrire et publier un article

1. **Articles → Nouvel article** : titre, chapeau, texte (l'éditeur visuel
   enregistre ce que vous voyez), section, signature(s).
2. **Photo** : placez le curseur à l'endroit voulu et insérez l'image. Le
   **crédit** est obligatoire ; inscrivez toujours la **licence** à côté
   (le site l'affiche avec le crédit). Pour des photos libres,
   prenez-les sur <https://commons.wikimedia.org> : la page de chaque fichier
   donne l'auteur (crédit) et la licence (ex. CC BY-SA 4.0) à recopier tels
   quels.
3. Statut **En révision** pour la relecture, puis **Publié**.

## 7. Mettre le site à jour

Le site se reconstruit tout seul **chaque heure** et à chaque changement du
dépôt. Pour ne pas attendre : **Actions → Publier le journal → Run workflow**.
Le site est à `https://<organisation>.github.io/<depot>/` après une à deux
minutes.

La publication copie les articles dans `content/` et les photos dans `media/`
du dépôt : c'est l'archive du journal, lisible même si l'hébergement disparaît.
Si vous modifiez aussi le dépôt depuis votre ordinateur, faites `git pull`
avant `git push` : le robot a pu ajouter un article entre-temps.

## 8. Mises à jour

Chaque lundi, GitHub vérifie s'il existe une nouvelle version. Si oui, une
**issue** « Mise à jour disponible » apparaît dans le dépôt avec un lien :
cliquez **Create pull request**, puis **Merge pull request**. Rien à régler.
Pour revenir en arrière : bouton **Revert** de la pull request.

La rédaction installée sur l'hébergement se met à jour en renvoyant le
nouveau dossier `socle/` par-dessus l'ancien **sans toucher à `donnees/`**.
Faites d'abord une sauvegarde (**Exporter et poursuivre → Télécharger la
sauvegarde JSON**).

## 9. Passation entre cohortes

- Deux responsables au moins, dans le socle et dans l'organisation GitHub.
- Téléchargez une sauvegarde chaque fin de session.
- Remplissez `OWNERS.md` : propriétaire du dépôt, accès à l'hébergement,
  domaine et date d'expiration.

## 10. Autres hébergements

- **Cloudflare (Worker et D1)** : possible, mais **pas sans ligne de
  commande**. Il faut l'outil `wrangler`, créer une base D1 et protéger
  l'admin avec Cloudflare Access (Zero Trust), car la connexion par mot de
  passe dépasse le temps de calcul du forfait gratuit. Guide :
  [adopter le socle](https://github.com/azdak919/le-socle/blob/main/docs/adoption.md).
- **Serveur Node** (VPS, serveur du département) : même guide.
- **Sans hébergement du tout** : le journal peut vivre seulement dans GitHub
  (articles en Markdown), voir [installation.md](installation.md). L'équipe
  écrit alors dans des fichiers, pas dans une admin.

## Problèmes fréquents

| Symptôme | Cause probable |
|---|---|
| `/journal/socle/redaction/` donne 404 ou 500 | `.htaccess` non envoyé, ou PHP < 8.1 sans SQLite |
| Le site est vide ou sans photos | adresse du socle absente de `kiosque.config.ts` (refaire l'étape 3) |
| Le site affiche la page d'accueil du Kiosque | Pages non activé (étape 1.3) ou workflow pas encore passé |
| « trop d'essais » à la connexion | 10 essais ratés : attendre 15 minutes |
| `git push` refusé | faire `git pull` d'abord (voir section 7) |
