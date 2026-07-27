# Démonstration en cinq minutes

## Avant la classe

1. Activez GitHub Pages sur le dépôt et vérifiez que le workflow Pages est vert.
2. Ouvrez dans trois onglets la vitrine, `/demo/` et `/configurer/`.
3. Gardez la page GitHub du dépôt ouverte sur le bouton **Use this template**.

## 0:00 — Le problème

Dites : « Un journal étudiant disparaît souvent avec une cohorte. KIOSQUE garde
les articles et les médias en formats ouverts dans le dépôt de l’équipe. »

Montrez la signature : **Publier aujourd’hui. Transmettre demain.**

## 1:00 — Le résultat

Ouvrez **Voir la démonstration**. Montrez le fil du Quorum, un article avec
image, une section, une signature et le flux. Dites que tout est fictif et que
le brouillon et l’article en révision n’existent dans aucune sortie publique.

## 2:00 — Créer le dépôt

Une personne crée un compte GitHub gratuit, choisit **Use this template**, puis
crée son dépôt. Expliquez qu’un fork demeure possible, mais qu’il désactive les
Actions par défaut.

## 2:40 — Personnaliser sans terminal

Ouvrez le configurateur. À l’étape 2, changez **Le Quorum** pour le nom choisi.
À l’étape 4, changez la couleur et montrez la prévisualisation ainsi que
l’avertissement de contraste. À l’étape 6, montrez l’interrupteur du contenu
fictif; à l’étape 7, celui de la barre radio.

## 3:50 — Produire les fichiers

Avancez à la révision, puis à la génération. Téléchargez le ZIP. Montrez les
cinq formats : `kiosque.config.ts`, `content/publication.yml`, les sections,
`content/taxonomies.yml` et `theme/tokens.css`.

Ouvrez le lien `github.dev` et dites : « La page statique ne peut pas écrire
dans le dépôt sans votre authentification; vous confirmez donc vous-même les
fichiers. Aucun mot de passe ni jeton n’est demandé par KIOSQUE. »

## 4:35 — Terminer honnêtement

Montrez l’étape 12. N’ouvrez `/admin/` comme fonctionnel que si
`cms.authBaseUrl` a réellement été configuré. Nommez les limites : Pages et les
Actions demandent une activation, le déploiement prend un délai, KIOSQUE ne
fournit pas l’hébergement, et l’accompagnement est bénévole selon les
disponibilités.

Terminez : « Le CMS peut tomber. L’écriture s’arrête; la lecture et l’archive
restent. »
