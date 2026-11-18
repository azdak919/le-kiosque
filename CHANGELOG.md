# Journal

## Non publié

- Administration locale : Annuler revient à la liste sans enregistrer. La couleur d’une section ou d’une catégorie se choisit dans la liste. Un lien ou une photo dans le texte se décrit dans la page, au lieu d’une fenêtre du navigateur.
- Dépôt : un lien `node_modules` (vers une machine de travail) avait été versionné par erreur. Il est retiré, et `.gitignore` ignore maintenant `node_modules` qu’il soit un dossier ou un lien.
- Barre radio native : le journal sert son propre lecteur (un `<audio>` lisible sans JavaScript, habillé par le thème) au lieu de l’iframe de le-radar.ca. Bande pleine largeur alignée sur la colonne, bouton lecture/arrêt, volume mémorisé (bureau), état en direct, émission en cours ou à venir quand LE-RADAR répond. Un direct arrêté coupe vraiment le flux. Une station hors du répertoire se décrit par `radio.stream` (https), `name`, `frequency` et `website` ; sans flux https, la barre n’apparaît pas.
- Page Mise à jour intégrée à l’administration : même barre latérale, mêmes cartes, entrée active. Elle explique comment une mise à jour arrive vraiment (pull request de plateforme pour le Kiosque, page du socle pour le Socle) et dit, dans la démo, que le bouton ne fait qu’une simulation dans ce navigateur. La vitrine a maintenant sa page `/admin/mise-a-jour/` (le lien menait à un 404).
- Admin : la navigation est faite de vrais liens (`/admin/#articles`). Un clic avant l’ouverture de la base ne fige plus l’écran sur « Ouverture du journal… », et un rechargement garde l’écran.
- Gabarit : la mise à jour de plateforme visait un dépôt amont qui n’existe pas (`kiosque/kiosque`). Elle vise maintenant `azdak919/le-kiosque`.
- Page `admin/mise-a-jour/` : une ligne Socle 1.0.0 et une ligne Kiosque. Aucune version n’est proposée, donc le bouton reste caché. La sauvegarde du programme ne contient pas `content/`, `media/`, `theme/tokens.css`, `kiosque.config.ts` ni `OWNERS.md`. Une majeure attend un oui de plus.
- Adaptateur `socle`, éteint. Le gabarit et la démo restent sur Markdown. Le configurateur note la langue, l’hébergement et qui publie. Ces réponses ne sont pas des secrets et ne sont pas redemandées à la mise à jour.
- Lecture d’une archive ZIP de journal : années absentes, session (articles seulement). Les courriels des membres ne sont pas affichés.
