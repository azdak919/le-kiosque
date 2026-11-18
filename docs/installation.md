# Installer un journal KIOSQUE

KIOSQUE est une plateforme libre et expérimentale. Il ne fournit ni hébergement, ni
domaine, ni compte d’administration. Chaque journal reste propriétaire et
responsable de ces ressources. L’accompagnement est bénévole, selon les
disponibilités.

**Le chemin recommandé est le [guide étudiant](guide-etudiant.md)** : le
paquet complet (site et rédaction dans un seul ZIP) sur un hébergement PHP
(serveur du cégep ou hébergeur mutualisé), ou, chemin B, la rédaction sur
l'hébergement PHP et le site sur GitHub Pages, sans terminal. Cette page couvre le reste : un journal qui vit
**seulement dans GitHub**, en Markdown, et les réglages communs aux deux
chemins (Pages, domaine, sauvegardes, passation). Le guide du serveur est
[adopter le socle](https://github.com/azdak919/le-socle/blob/main/docs/adoption.md).

## Installation rapide (Markdown seul, sans hébergement)

1. Connectez-vous à GitHub et ouvrez le dépôt `azdak919/le-kiosque`.
2. Choisissez **Use this template**, puis **Create a new repository**. Cette
   méthode est recommandée. Un fork désactive les Actions par défaut et exige
   un clic supplémentaire pour les autoriser.
3. Ouvrez la vitrine GitHub Pages du KIOSQUE et choisissez **Configurer mon
   journal**.
4. Remplacez toutes les valeurs marquées « exemple fictif ». N’inscrivez jamais
   de mot de passe, jeton GitHub, clé privée ou autre secret.
5. À l’étape « C’est prêt », choisissez **Dans GitHub, en fichiers Markdown**. À la
   dernière étape, téléchargez **Fichiers du dépôt**, puis, dans votre dépôt,
   **Add file → Upload files** : glissez le contenu du ZIP décompressé.
6. Pour partir des exemples, copiez aussi `template/content/auteurs/`,
   `template/content/articles/` et `template/media/` à la racine ; sinon
   ajoutez votre premier article avec `AJOUTER-UN-ARTICLE.md`.
7. Enregistrez les changements dans GitHub.

Le configurateur peut d’abord ouvrir le **mode démonstration local** à
`/admin/`. Vous pouvez y créer, réviser et publier des articles immédiatement.
Ces changements restent dans IndexedDB, dans ce navigateur seulement. Ils ne
sont ni partagés ni publiés dans GitHub.

Quand le résultat vous convient, exportez le ZIP Markdown depuis
« Exporter et poursuivre ». Une page statique ne peut pas écrire elle-même dans
un dépôt sans authentification : vous confirmez donc vous-même l’import dans
GitHub avant de passer à Sveltia.

## Activer GitHub Pages et les Actions

Dans **Settings → Pages**, choisissez **GitHub Actions** comme source. Ouvrez
ensuite l’onglet **Actions** et autorisez les workflows si GitHub l’exige. Cette
autorisation est toujours manuelle dans un fork.

Le workflow lance les tests avant chaque publication. Le délai de file et de
déploiement de GitHub Pages est incompressible; une modification n’apparaît pas
instantanément.

Avec GitHub Pages, `deploy.basePath` doit être `/<nom-du-depot>`. Avec un domaine
personnalisé, laissez-le vide et renseignez `deploy.cname`.

## Premiers administrateurs

Les personnes indiquées dans le configurateur ne sont pas des comptes. Dans
**Settings → Collaborators and teams**, invitez leurs comptes GitHub réels.
Utilisez une organisation plutôt qu’un compte personnel et conservez au moins
deux personnes capables de récupérer les accès. Une adresse institutionnelle
facilite la passation entre cohortes.

En mode `demo-local`, `/admin/` ne demande aucun compte et ne donne aucun droit
réel. En mode `git-sveltia`, l’interface `/admin/` est générée avec le site, mais sa connexion GitHub exige
un service `sveltia-cms-auth` séparé. Suivez
[`brancher-sveltia.md`](brancher-sveltia.md), puis ajoutez son URL dans
`cms.authBaseUrl`. Tant que cette valeur est absente, ne présentez pas
l’administration comme fonctionnelle.

## Publier le premier article

1. Dans la démonstration, ouvrez `/admin/` immédiatement. Dans un journal Git,
   ouvrez-la une fois l’authentification branchée, ou ajoutez un fichier
   Markdown en suivant `AJOUTER-UN-ARTICLE.md`.
2. Gardez le statut `draft` pendant l’écriture, puis `in-review` pendant la
   révision. Seul `published` apparaît publiquement.
3. Ajoutez une signature, une section et `publishedAt` avant de publier.
4. Confirmez le changement. Le workflow reconstruit le site depuis `content/`
   et `media/`, jamais depuis le CMS.

## Retirer le contenu de démonstration

Dans `kiosque.config.ts`, passez `demoContent` à `false`. Les articles portant
`demo: true` deviennent invisibles sans être supprimés du dépôt. Ne retirez ce
marqueur que d’un article devenu réellement le vôtre.

## Ajouter ou retirer la barre radio

La configuration se trouve dans `content/publication.yml` :

```yaml
radio:
  enabled: true
  station: station-exemple
  theme: auto
  position: top
```

Passez `enabled` à `false` pour la retirer. Le lecteur de LE-RADAR ne traite pas
encore le paramètre `station`, et la synchronisation du thème est limitée à la
même origine. KIOSQUE émet déjà les paramètres; ils seront pris en compte quand
LE-RADAR les acceptera. Aucun changement du dépôt LE-RADAR n’est requis.

## Site sur GitHub Pages, socle à part

Le site peut rester sur GitHub Pages pendant que la rédaction vit dans un
[socle](https://github.com/azdak919/le-socle/blob/main/docs/adoption.md)
hébergé ailleurs : hébergement PHP (voir le [guide étudiant](guide-etudiant.md)),
serveur Node, ou Worker Cloudflare sur D1 (ligne de commande obligatoire).

1. Le configurateur l’écrit pour vous (étape « C’est prêt », « Dans le socle ») :
   `source: { adapter: 'socle', options: { baseUrl: 'https://<adresse du socle>' } }`
   et `editorial: { mode: 'external' }` dans `kiosque.config.ts`.
2. On écrit dans l’admin du socle (`https://<adresse du socle>/redaction/`).
3. Le workflow **Publier le journal** lance `kiosque sync` : il lit les
   articles publiés du socle (`/v1/editorial/snapshot`) et les écrit dans
   `content/` en Markdown, chaque fichier marqué `miroir: socle`. Le dépôt
   garde donc toujours une copie complète, lisible sans le socle.
4. `kiosque build` construit le site depuis ce miroir, comme d’habitude.

Un article retiré du socle quitte le miroir à la synchronisation complète
suivante ; un fichier écrit à la main dans `content/` n’est jamais retiré.
Si le socle ne répond pas, le site reste en ligne, tel qu’il était.

## Domaine personnalisé

Achetez ou obtenez le domaine auprès du fournisseur choisi par votre équipe,
puis suivez la documentation de cet hébergeur pour les enregistrements DNS.
Renseignez `deploy.cname`, videz `deploy.basePath`, et inscrivez le domaine ainsi
que sa date d’expiration dans les documents de gouvernance. KIOSQUE ne vend, ne
renouvelle et ne garantit aucun domaine.

## Sauvegarde, restauration et passation

- En démonstration locale, téléchargez régulièrement la sauvegarde JSON et le
  ZIP Markdown. Vider les données du navigateur efface la base locale.
- L’import JSON remplace atomiquement l’état local; exportez l’état courant
  avant de confirmer.
- Sauvegardez le dépôt complet, surtout `content/` et `media/`, sur au moins un
  support indépendant. Le dépôt Git est l’archive de référence, pas l’unique
  copie souhaitable.
- Pour restaurer, clonez ou téléchargez le dépôt, exécutez `npm ci`, puis
  `node packages/pipeline/src/cli.ts build`. Aucun compte CMS ni secret n’est
  requis pour relire l’archive.
- Suivez `RESTAURATION.md`, `RELEVE.md` et `OWNERS.md` du gabarit.
- Avant chaque changement de cohorte, vérifiez le propriétaire du dépôt, deux
  contacts de récupération, l’échéance du domaine et les droits GitHub.

## Limites actuelles

- GitHub Pages doit être activé dans les paramètres du dépôt.
- Les Actions doivent être activées à la main dans un fork.
- Une page statique ne peut pas enregistrer dans GitHub sans authentification.
- Le mode démo locale (sql.js) n’est ni une authentification, ni une rédaction collaborative,
  ni une sauvegarde distante, ni une publication GitHub automatique.
- La publication GitHub Pages a un délai incompressible.
- WordPress/Newspack et les autres backends sont une feuille de route, pas des
  intégrations disponibles.
- Le projet est expérimental, développé avec des ressources limitées, sans
  garantie d’hébergement, de maintenance ou de soutien permanent.

## KIOSQUE et LE-RADAR

KIOSQUE produit un journal que l’équipe possède : domaine, hébergement, comptes
et contenus. LE-RADAR est un projet distinct de découverte et d’agrégation des
médias étudiants. KIOSQUE n’héberge rien, et l’inscription éventuelle à LE-RADAR
ne transfère aucune propriété.
