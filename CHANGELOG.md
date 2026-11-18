# Journal

## Non publié

- Barre radio native : le journal sert son propre lecteur (un `<audio>` lisible sans JavaScript, habillé par le thème) au lieu de l’iframe de le-radar.ca. Bande pleine largeur alignée sur la colonne, bouton lecture/arrêt, volume mémorisé (bureau), état en direct, émission en cours ou à venir quand LE-RADAR répond. Un direct arrêté coupe vraiment le flux. Une station hors du répertoire se décrit par `radio.stream` (https), `name`, `frequency` et `website` ; sans flux https, la barre n’apparaît pas.
- Page `admin/mise-a-jour/` : une ligne Socle 1.0.0 et une ligne Kiosque. Aucune version n’est proposée, donc le bouton reste caché. La sauvegarde du programme ne contient pas `content/`, `media/`, `theme/tokens.css`, `kiosque.config.ts` ni `OWNERS.md`. Une majeure attend un oui de plus.
- Adaptateur `socle`, éteint. Le gabarit et la démo restent sur Markdown. Le configurateur note la langue, l’hébergement et qui publie. Ces réponses ne sont pas des secrets et ne sont pas redemandées à la mise à jour.
- Lecture d’une archive ZIP de journal : années absentes, session (articles seulement). Les courriels des membres ne sont pas affichés.
