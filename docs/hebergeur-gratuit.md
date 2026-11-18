# Essai chez un hébergeur PHP gratuit

Pour essayer le paquet complet sans payer. Un hébergeur gratuit convient à un
essai ou à un petit journal ; pour un vrai journal, préférez le serveur du
cégep ou de l'association, ou un hébergeur payant ordinaire. Limites relevées
en novembre 2026 : vérifiez-les sur la page de l'hébergeur avant de vous
inscrire.

## Comparatif

| | alwaysdata (Free) — recommandé | HelioHost (Johnny) | InfinityFree |
|---|---|---|---|
| Espace disque | 1 Go | 1 000 Mo | 5 Go |
| PHP et SQLite | oui | oui | oui |
| Envoi des fichiers | SFTP, FTP, WebDAV, SSH dans le navigateur | gestionnaire de fichiers Plesk (sait extraire un ZIP), FTP | gestionnaire de fichiers en ligne, FTP |
| HTTPS | oui, `https://<compte>.alwaysdata.net` | oui | oui (certificat gratuit à activer) |
| Robots, GitHub Actions, `curl` | joignable | joignable | **bloqués** : contrôle JavaScript (aes.js) imposé à tout visiteur non navigateur, impossible à couper |
| Conditions | usage non commercial, une offre gratuite par personne, adresse `alwaysdata.net` seulement (pas de domaine à soi) ; se connecter à l'administration au moins tous les 120 jours la première année | inscriptions gratuites ouvertes seulement à 00 h 00 et 12 h 00 UTC (19 h et 7 h à Montréal en hiver) ; activation jusqu'à 2 h ; se connecter tous les 30 jours ; un compte par personne | API et usages « non site web » interdits par les conditions ; pas de tâches planifiées |

**Recommandation : alwaysdata.** Rien ne bloque les visiteurs automatiques,
l'HTTPS est immédiat, et SSH dans le navigateur permet de télécharger et
décompresser le paquet sans rien installer. HelioHost est la solution de
rechange (son gestionnaire de fichiers décompresse un ZIP). InfinityFree
marche pour des lecteurs humains, mais son contrôle anti-robots empêche
toute vérification automatique et les aperçus de liens (réseaux sociaux).

Avec le paquet complet, le site est fabriqué par l'hébergeur lui-même :
GitHub n'a pas besoin de le joindre.

## alwaysdata, pas à pas (navigateur seulement)

1. Ouvrez <https://www.alwaysdata.com/fr/inscription/>. Choisissez l'offre
   **Free** (gratuite), entrez un courriel et un mot de passe, acceptez les
   conditions, validez. Confirmez le courriel reçu.
2. Le nom du **compte** choisi (par exemple `phare-essai`) donne l'adresse du
   site : `https://phare-essai.alwaysdata.net`. Le site par défaut sert le
   dossier `www/` en PHP (menu **Web → Sites**).
3. Dans l'administration (<https://admin.alwaysdata.com>), menu **Accès
   distant → SSH** : un utilisateur SSH portant le nom du compte existe déjà
   (essai de novembre 2026 : c'est bien le cas, PHP 8.4, racine `www/`).
   Modifiez-le pour lui donner un mot de passe (et cochez la connexion par mot
   de passe si la case est proposée).
4. Ouvrez `https://ssh-phare-essai.alwaysdata.net` (remplacez par votre
   compte) : une console s'ouvre dans le navigateur. Identifiant : le nom du
   compte ; mot de passe : celui de l'étape 3. Tapez, ligne par ligne :

   ```
   cd ~/www
   wget https://github.com/azdak919/le-kiosque/releases/latest/download/kiosque-journal.zip
   unzip -o kiosque-journal.zip
   rm kiosque-journal.zip
   ```

   La commande remplace la page d'accueil par défaut d'alwaysdata (`www/index.html`)
   par le journal, à la racine du domaine. (Sans console : décompressez le ZIP sur
   votre ordinateur et envoyez son contenu par SFTP avec FileZilla, hôte
   `ssh-phare-essai.alwaysdata.net`, port 22, dans `www/`.) Pour installer dans un
   sous-dossier, créez ce dossier et déposez-y les mêmes fichiers : le programme
   détecte le préfixe tout seul, sans casser les liens.
5. **Tout de suite**, ouvrez `https://phare-essai.alwaysdata.net/admin/` et
   remplissez l'assistant d'installation (guide, section 4) : tant qu'il n'est
   pas rempli, la première personne qui ouvre la page peut créer le compte
   administrateur. Gardez **Cacher le journal des moteurs de recherche**
   cochée pendant l'essai, et cochez **Afficher le bandeau « Journal étudiant
   fictif »** si le journal est un exercice. Attendez le message « Le journal
   est installé » avant de fermer l'onglet.
6. Le journal est à `https://phare-essai.alwaysdata.net/`. Pendant l'essai, vous pouvez
   aussi fermer tout le domaine aux moteurs : `printf 'User-agent: *\nDisallow: /\n' > ~/www/robots.txt`
   (le journal envoie de toute façon l'en-tête « noindex » quand la case est cochée).
7. Mise à jour : page **Mise à jour** de la rédaction (alwaysdata permet les
   connexions sortantes vers GitHub).

## HelioHost, pas à pas

1. À 00 h 00 ou 12 h 00 UTC, ouvrez <https://heliohost.org/signup/>, choisissez
   le serveur **Johnny**, un nom d'utilisateur, un domaine
   `<nom>.helioho.st`, un courriel et un mot de passe. Attendez le courriel
   d'activation (jusqu'à 2 h).
2. Connectez-vous à **Plesk** depuis <https://heliohost.org/login/>, ouvrez
   **Fichiers**, entrez dans `httpdocs/`.
3. **Téléverser** `kiosque-journal.zip`, puis sur le fichier : **Extraire les
   fichiers**. Les fichiers du journal sont dans `httpdocs/` (à la racine du site).
4. Ouvrez `https://<nom>.helioho.st/admin/` et remplissez l'assistant.

## InfinityFree, pas à pas

1. <https://www.infinityfree.com> → **Register**, puis **Create Account**
   (sous-domaine gratuit). Activez le certificat **SSL** gratuit dans le
   panneau du compte.
2. **File Manager** → dossier `htdocs/` → envoyez le contenu du ZIP
   décompressé (ou le ZIP, puis **Extract** s'il est proposé), à la racine
   de `htdocs/`.
3. Ouvrez `https://<sous-domaine>/admin/` et remplissez l'assistant. Si la
   page Mise à jour dit « Vérification impossible », suivez la marche à la
   main qu'elle affiche.
