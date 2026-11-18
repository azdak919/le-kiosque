# Composants tiers

Le Kiosque est sous GPL-2.0-only. Les interfaces d'outil (vitrine du projet,
configurateur, administration locale) reprennent les projets libres suivants.
Le rendu du journal produit (thème `packages/theme-radar`, hérité de LE-RADAR)
n'en dépend pas.

| Projet | Licence | Usage | Où |
| --- | --- | --- | --- |
| Admin de rédaction de [le-socle](https://github.com/azdak919/le-socle) (`le-socle/admin/`) | GPL-2.0-only, même auteur | Écrans de l’admin, client du socle, démo PGlite ; copiés dans le site par le build | `assets/editorial/` du site construit |
| [Basecoat](https://github.com/hunvreus/basecoat) (`basecoat-css`) © hunvreus | MIT | Jetons et composants style shadcn/ui (bouton, badge, carte, alerte, kbd) | `ui/vendor/basecoat-subset.css` (extrait généré), `site/assets/kiosque-ui.css` ; la feuille de l’admin est compilée dans le socle (`le-socle/admin/assets/admin.css`) |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) v4 © Tailwind Labs | MIT | Compilation des feuilles ci-dessus (`npm run ui`) | dépendance de développement |
| [AstroWind](https://github.com/arthelokyo/astrowind) © arthelokyo | MIT | Inspiration de structure pour la vitrine (en-tête, héros, sections, appel à l'action). Aucun code copié. | `site/index.html` |
| [Sveltia CMS](https://github.com/sveltia/sveltia-cms) | MIT | CMS facultatif | `packages/theme-radar/assets/admin/` (voir `SVELTIA-LICENSE.txt`) |
| Barre radio de [LE-RADAR](https://github.com/azdak919/le-radar) (`radio-barre.js`, `radios.json`) | même auteur, GPL-2.0-only | Appelée depuis le-radar.ca, jamais copiée : stations, lecteur et style restent chez LE-RADAR | `packages/theme-radar/src/radio.js` (ligne d’appel seulement) |
| [PGlite](https://github.com/electric-sql/pglite) © ElectricSQL | Apache-2.0 | PostgreSQL dans le navigateur, chargé seulement par `/admin/` | dépendance |

Les textes de licence MIT de Basecoat et Tailwind CSS sont fournis avec leurs
paquets npm (`node_modules/basecoat-css/LICENSE.md`, `node_modules/tailwindcss/LICENSE`).
