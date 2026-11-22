# Guide étudiant : créer son journal de A à Z

Ce guide est **le** chemin recommandé. Il suppose un navigateur et un
hébergement PHP. Ni terminal, ni compte GitHub, ni configurateur ne sont
nécessaires. Comptez une vingtaine de minutes la première fois.

Le principe : **un seul fichier ZIP**, le *paquet complet*, contient le site
du journal **et** la rédaction (articles, banque de photos, comptes et rôles,
sauvegardes, mises à jour). Vous le déposez chez un hébergeur PHP, vous
remplissez l'assistant d'installation, et le journal est en ligne. Chaque
installation est autonome : aucun serveur central, rien ne dépend du Kiosque
après le téléchargement.

Vous préférez un site servi par GitHub Pages, avec l'archive des articles dans
un dépôt Git ? C'est le chemin B, plus bas (section B).

## 1. Ce qu'il vous faut

- Un hébergement **PHP 8.1 ou plus récent avec SQLite**, sous Apache ou
  LiteSpeed, où l'on peut envoyer des fichiers (gestionnaire de fichiers,
  FTP, SFTP). Par ordre de préférence :
  1. le serveur web du cégep ou de l'association étudiante (demandez un
     dossier et un accès FTP ou un gestionnaire de fichiers) ;
  2. un hébergeur mutualisé PHP ordinaire (cPanel, Plesk, hPanel…) ;
  3. pour un essai gratuit : voir [Essai chez un hébergeur gratuit](hebergeur-gratuit.md).
- Une adresse courriel pour le compte administrateur du journal.

## 2. Télécharger le paquet complet

<https://github.com/azdak919/le-kiosque/releases/latest/download/kiosque-journal.zip>

Adresse fixe, toujours la dernière version, sans compte GitHub (nouveautés sur
<https://github.com/azdak919/le-kiosque/releases/latest>). Décompressez
`kiosque-journal.zip` : le ZIP contient un dossier `kiosque-journal/`
(avec `index.php`, `admin/`, `site/`, `php/`, `donnees/`, `.htaccess`, et le
fichier `INSTALLER-A-LA-RACINE.txt`). C’est le contenu de ce dossier qu’il
faut déposer, pas le dossier lui-même.

## 3. Le déposer chez l'hébergeur

Avec le gestionnaire de fichiers de l'hébergeur (ou FTP/SFTP), décompressez
le ZIP, puis envoyez le **contenu** du dossier `kiosque-journal/` à la racine
de votre espace web, par exemple `public_html/` (ou `www/`). N’envoyez pas le
dossier `kiosque-journal/` lui-même. Gardez les fichiers cachés (`.htaccess`,
`.user.ini`). Si une page d'accueil de l'hébergeur s'y trouve déjà, remplacez-la.
Si le gestionnaire sait décompresser, envoyez le ZIP, choisissez **Extraire**,
puis déplacez le contenu du dossier obtenu d’un niveau vers le haut.

Le journal sera à `https://<votre-site>/`, la rédaction à
`https://<votre-site>/redaction/`.

Pour l'installer dans un sous-dossier (par exemple `public_html/journal/`),
déposez le contenu du dossier `kiosque-journal/` dans ce dossier : le programme détecte le préfixe
tout seul, sans casser les liens. L'adresse devient alors
`https://<votre-site>/journal/`, et la rédaction `https://<votre-site>/journal/redaction/`.

## 4. L'assistant d'installation

Ouvrez `https://<votre-site>/redaction/`. La première visite affiche
**Installer le journal** :

- **Le journal** : nom, établissement, organisme responsable (par exemple
  l'association étudiante), courriel de la rédaction (affiché sur le site),
  signature, sections (séparées par des virgules) ;
- **Apparence** : couleur principale, logo (facultatif, 500 ko au plus) ;
- **Options** : radio étudiante (oui ou non, puis la station), **Cacher le
  journal des moteurs de recherche** (cochée : gardez-la tant que c'est un
  essai) et **Afficher le bandeau « Journal étudiant fictif »** (pour un
  exercice ou une démonstration) ;
- **Compte administrateur** : votre courriel et un mot de passe d'au moins
  10 caractères (ce courriel n'est pas affiché sur le site). Notez le mot de
  passe dans le gestionnaire de mots de passe de l'équipe.

**Installer le journal** ouvre la rédaction ; attendez le message « Le journal
est installé » avant de fermer l'onglet (les sections s'écrivent à ce moment). Le site public prend tout de
suite le nom, le logo, les couleurs et les sections. Tout se change ensuite
dans **Configuration**. L'assistant ne s'affiche qu'une fois : ensuite, seuls
les comptes existants se connectent. Il faut le code d'installation, qui se
trouve dans le fichier `donnees/code-installation.txt` sur le serveur (créé à
la première ouverture de la page). Sans ce code, personne ne peut créer le
compte administrateur.

Les données (base SQLite, photos) vont dans `donnees/` si le journal est à la
racine de l'espace web, ou dans `journal/donnees/` s'il est dans un dossier
`journal/`. Ce dossier est fermé au public. Pour un essai sur votre ordinateur,
lancez le serveur intégré de PHP depuis le dossier du journal :
`php -S 127.0.0.1:8080 routeur.php`.

Vous avez déjà rempli le configurateur en ligne ? **Configuration → Importer
le fichier du configurateur** reprend `kiosque-config.json` ; c'est facultatif.

## 5. L'équipe et les rôles

**Auteurs → Équipe : comptes et rôles** (visible par l'administrateur) ajoute
un compte : courriel, rôle, mot de passe provisoire à transmettre, et au
besoin des rubriques. **Modifier** change le rôle ou les rubriques d'un
compte. Le serveur applique ces droits, quoi qu'affiche le navigateur.

| Rôle | Ce qu'il peut faire |
|---|---|
| Auteur | écrit ses articles et les met **En révision** ; ne publie pas |
| Photographe | gère la banque de photos (ajout, crédit, licence, retrait) ; n'écrit pas d'articles |
| Réviseur ou réviseure | relit, publie et retire tous les articles |
| Chef de pupitre | relit, publie et retire les articles **de ses rubriques** |
| Éditeur ou éditrice | tout le contenu, plus les sections et la configuration |
| Administrateur | tout, plus l'équipe, la sauvegarde et les mises à jour |

Un auteur ou un chef de pupitre peut être limité à des **rubriques** (les
sections du journal) : hors de celles-ci, le serveur refuse même un
brouillon. Rien de coché = toutes les rubriques.

L'ancien nom « responsable » s'appelle maintenant **administrateur**. Un
compte créé sous l'ancien nom est lu comme administrateur : rien à refaire.

**Nouvelle signature** (plus bas dans **Auteurs**) crée le nom que le public
voit sous les articles ; une signature n'est pas un compte.

## 6. Écrire et publier un article

1. **Articles → Nouvel article** : titre, chapeau, texte (l'éditeur visuel
   enregistre ce que vous voyez), section, signature(s).
2. **Photo** : placez le curseur à l'endroit voulu et insérez l'image. Le
   **crédit** est obligatoire ; inscrivez toujours la **licence** à côté
   (le site l'affiche avec le crédit). Pour des photos libres,
   prenez-les sur <https://commons.wikimedia.org> : la page de chaque fichier
   donne l'auteur (crédit) et la licence (ex. CC BY-SA 4.0) à recopier tels
   quels.
3. Statut **En révision** pour la relecture, puis **Publié** : l'article
   paraît **tout de suite** sur le site.

## 7. Sauvegarde

**Sauvegarde → Télécharger la sauvegarde complète** (administrateur) : un ZIP
avec les articles, les photos, les signatures, les sections, l'équipe (sans les
mots de passe) et les réglages. Il s'ouvre comme n'importe quel ZIP. Faites-le chaque fin
de session et avant toute opération délicate, et gardez-le hors du serveur.
La même page restaure une archive.

## 8. Mises à jour en un clic

**Mise à jour** (administrateur) → **Vérifier s'il y a une nouvelle
version**. S'il y en a une, la page montre les nouveautés et le bouton
**Mettre à jour vers la version …**. Avant d'installer, le journal garde une
copie du programme et de la base dans `donnees/mises-a-jour/` ; les
articles, les photos et les comptes ne sont pas touchés. Si l'installation
casse en route, la version d'avant est remise toute seule.

Un souci après la mise à jour ? **Revenir à la version …** réinstalle la
sauvegarde, sans perdre les articles écrits depuis.

Si l'hébergeur bloque les connexions sortantes (le bouton dit alors
« Vérification impossible »), la page donne la marche à la main : sauvegarde,
téléchargement du dernier paquet, fichiers envoyés par-dessus
les anciens **sans remplacer `donnees/`**.

## 9. Passation entre cohortes

- Deux administrateurs au moins.
- Téléchargez une sauvegarde chaque fin de session.
- Notez quelque part de durable (par exemple un document de l'association) :
  l'accès à l'hébergement, le compte administrateur, le domaine et sa date
  d'expiration.

## Problèmes fréquents

| Symptôme | Cause probable |
|---|---|
| `/redaction/` donne 404 ou 500 | `.htaccess` non envoyé, ou PHP < 8.1 sans SQLite |
| Le site dit « Journal en préparation » | l'assistant d'installation n'a pas encore été rempli |
| « trop d'essais » à la connexion | 10 essais ratés : attendre 15 minutes |
| « Vérification impossible » sur Mise à jour | l'hébergeur bloque les connexions sortantes : marche à la main (section 8) |

---

# Chemin B : site sur GitHub Pages

Ici, la **rédaction** vit sur votre hébergement PHP ; le **site public** est
construit par GitHub et servi gratuitement par GitHub Pages. Si l'hébergement
tombe, le site reste en ligne, et les articles sont archivés dans le dépôt.
Il faut un compte GitHub. Comptez environ une heure.

## B0. Ce qu'il vous faut

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

Cloudflare Pages peut servir le site public (fichiers statiques), comme GitHub Pages. Voir la section B10.

## B1. Créer le dépôt du journal

1. Ouvrez <https://github.com/azdak919/le-kiosque>.
2. **Use this template → Create a new repository**. Choisissez le propriétaire
   (l'organisation du journal), un nom court (ex. `la-boussole`) et
   **Public** (GitHub Pages gratuit l'exige).
3. Dans le nouveau dépôt : **Settings → Pages → Source : GitHub Actions**.

N'utilisez pas « Fork » : GitHub y coupe les Actions.

## B2. Installer la rédaction sur l'hébergement

1. Téléchargez le paquet de la rédaction : <https://github.com/azdak919/le-socle/releases/latest/download/le-socle-php.zip>
   (adresse fixe, toujours la dernière version, sans compte GitHub ; les
   nouveautés sont sur <https://github.com/azdak919/le-socle/releases/latest>). Décompressez `le-socle-php.zip` : vous
   obtenez un dossier `socle/`.
2. Avec le gestionnaire de fichiers de l'hébergeur (ou FTP), envoyez le dossier
   `socle/` **tel quel** dans votre espace web, par exemple
   `public_html/socle/`. Gardez les fichiers cachés (`.htaccess`,
   `.user.ini`).
3. Ouvrez `https://<votre-site>/socle/redaction/`. La première visite
   affiche l'assistant d'installation (section 4) : remplissez au moins le nom
   et le **compte administrateur** (votre courriel et un mot de passe d'au
   moins 10 caractères). Notez-le dans le gestionnaire de mots de passe de
   l'équipe, jamais dans le dépôt.

Ce formulaire ne s'affiche qu'une fois : ensuite, seuls les comptes existants
se connectent. Les données (base SQLite, photos) vont dans `socle/donnees/`,
protégé contre la lecture publique.

Notez l'**adresse de Le Socle** : `https://<votre-site>/socle`.

## B3. Configurer le journal

1. Ouvrez le configurateur : <https://kiosque.le-radar.ca/configurer/>.
2. Étapes **Votre journal**, **Apparence** et **Sections** : nom,
   établissement, couleurs, logo, sections, radio (facultative). Rien n'est
   prérempli : ce qui est vide reste vide.
3. Étape **C'est prêt** :
   - Où s'écrivent les articles : **Dans Le Socle — recommandé** ;
   - Adresse de Le Socle : celle notée à l'étape B2 ;
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
   - **2. Réglages de Le Socle** (`kiosque-config.json`).

Vos réponses restent dans ce navigateur : vous pouvez revenir corriger sans
tout ressaisir.

## B4. Déposer les fichiers dans GitHub

1. Décompressez le ZIP **Fichiers du dépôt** sur votre ordinateur.
2. Dans votre dépôt : **Add file → Upload files**, glissez **le contenu** du
   dossier décompressé (les dossiers `content/`, `theme/`, éventuellement
   `media/`, et les fichiers `kiosque.config.ts`, `kiosque-config.json`), puis
   **Commit changes**. Ils remplacent les fichiers d'exemple de même nom.
3. L'onglet **Actions** montre « Publier le journal » qui démarre. Au premier
   passage, autorisez les workflows si GitHub le demande.

## B5. Régler la rédaction

1. Dans l'admin de Le Socle : **Configuration → Importer le fichier du
   configurateur** et choisissez `kiosque-config.json`. Vérifiez l'adresse du site et l'organisme responsable,
   puis **Enregistrer** (une seule fois suffit).
2. **Auteurs → Équipe : comptes et rôles** ajoute les comptes de l'équipe
   (rôles et rubriques : voir la section 5). Plus bas, **Nouvelle
   signature** crée le nom que le public voit sous les articles.

## B6. Écrire et publier un article

Comme à la section 6, mais l'article paraît sur GitHub Pages à la prochaine
publication (section B7), pas tout de suite.

## B7. Mettre le site à jour

Le site se reconstruit tout seul **chaque heure** et à chaque changement du
dépôt. Pour ne pas attendre : **Actions → Publier le journal → Run workflow**.
Le site est à `https://<organisation>.github.io/<depot>/` après une à deux
minutes.

La publication copie les articles dans `content/` et les photos dans `media/`
du dépôt : c'est l'archive du journal, lisible même si l'hébergement disparaît.
Si vous modifiez aussi le dépôt depuis votre ordinateur, faites `git pull`
avant `git push` : le robot a pu ajouter un article entre-temps.

## B8. Mises à jour

Chaque lundi, GitHub vérifie s'il existe une nouvelle version. Si oui, une
**issue** « Mise à jour disponible » apparaît dans le dépôt avec un lien :
cliquez **Create pull request**, puis **Merge pull request**. Rien à régler.
Pour revenir en arrière : bouton **Revert** de la pull request.

La rédaction installée sur l'hébergement se met à jour en retéléchargeant
<https://github.com/azdak919/le-socle/releases/latest/download/le-socle-php.zip> et en renvoyant le nouveau dossier `socle/` par-dessus l'ancien
**sans toucher à `donnees/`**. La page **Mise à jour** de la rédaction donne
le même lien.
Faites d'abord une sauvegarde (**Exporter et poursuivre → Télécharger la
sauvegarde JSON**).

## B9. Passation entre cohortes

- Deux administrateurs au moins, dans Le Socle et dans l'organisation GitHub.
- Téléchargez une sauvegarde chaque fin de session.
- Remplissez `OWNERS.md` : propriétaire du dépôt, accès à l'hébergement,
  domaine et date d'expiration.

## B10. Autres hébergements

- **Cloudflare Pages** : pour le site public seulement (fichiers statiques), comme GitHub Pages. Ce n’est pas un Worker du Socle. La rédaction reste sur un serveur PHP, ou sur Node pour essayer. Guide : [adopter Le Socle](https://github.com/azdak919/le-socle/blob/main/docs/adoption.md).
- **Serveur Node** (VPS, serveur du département) : utile pour le développement et les tests. Le chemin habituel d’un journal en ligne reste le PHP. Même guide.
- **Sans hébergement du tout** : le journal peut vivre seulement dans GitHub
  (articles en Markdown), voir [installation.md](installation.md). L'équipe
  écrit alors dans des fichiers, pas dans une admin.

## Problèmes fréquents (chemin B)

| Symptôme | Cause probable |
|---|---|
| `/socle/redaction/` donne 404 ou 500 | `.htaccess` non envoyé, ou PHP < 8.1 sans SQLite |
| Le site est vide ou sans photos | adresse de Le Socle absente de `kiosque.config.ts` (refaire l'étape B3) |
| Le site affiche la page d'accueil du Kiosque | Pages non activé (étape B1.3) ou workflow pas encore passé |
| « trop d'essais » à la connexion | 10 essais ratés : attendre 15 minutes |
| `git push` refusé | faire `git pull` d'abord (voir section B7) |
