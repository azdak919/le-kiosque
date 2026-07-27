# Démonstration en cinq minutes

## Avant la classe

1. Activez GitHub Pages sur le dépôt et vérifiez que le workflow Pages est vert.
2. Ouvrez dans trois onglets la vitrine, `/demo/` et `/configurer/`. Le premier
   chargement PGlite télécharge environ 17 Mio de ressources locales.
3. Gardez la page GitHub du dépôt ouverte sur le bouton **Use this template**.

## 0:00 — Le problème

Dites : « Un journal étudiant disparaît souvent avec une cohorte. KIOSQUE garde
les articles et les médias en formats ouverts dans le dépôt de l’équipe. »

Montrez la signature : **Publier aujourd’hui. Transmettre demain.**

## 1:00 — Le résultat

Ouvrez **Voir la démonstration**. Montrez le fil du Quorum, un article avec
image, une section, une signature et le flux. Dites que tout est fictif et que
le brouillon et l’article en révision n’existent dans aucune sortie publique.

## 2:00 — Personnaliser sans terminal

Ouvrez le configurateur. À l’étape 2, changez **Le Quorum** pour le nom choisi.
À l’étape 4, changez la couleur et montrez la prévisualisation ainsi que
l’avertissement de contraste. À l’étape 6, montrez l’interrupteur du contenu
fictif; à l’étape 7, celui de la barre radio.

## 3:00 — Rédiger réellement

À l’étape 12, ouvrez l’administration locale. Créez un brouillon et montrez
qu’il reste absent de `/demo/`; passez-le à « Publié » et montrez son apparition
immédiate dans le second onglet. Rafraîchissez : IndexedDB conserve l’article.

Lisez le bandeau à voix haute : les données restent dans ce navigateur, sans
authentification réelle, collaboration, sauvegarde distante ou publication Git.

## 4:00 — Exporter et poursuivre

Dans « Exporter et poursuivre », téléchargez le JSON de sauvegarde puis le ZIP
Markdown. Montrez `content/publication.yml`, les sections, les auteurs et les
articles.

Ouvrez le lien `github.dev` et dites : « La page statique ne peut pas écrire
dans le dépôt sans votre authentification; vous confirmez donc vous-même les
fichiers. Aucun mot de passe ni jeton n’est demandé par KIOSQUE. »

## 4:35 — Terminer honnêtement

Montrez les trois suites : conserver l’export, créer un dépôt avec
**Use this template** et Sveltia, ou consulter la future option PocketBase.
Nommez les limites : le mode local ne partage et ne déploie rien; Pages et les
Actions demandent une activation; KIOSQUE ne fournit pas l’hébergement.

Terminez : « Le CMS peut tomber. L’écriture s’arrête; la lecture et l’archive
restent. »
