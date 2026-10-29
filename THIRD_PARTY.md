# Composants tiers

Le Kiosque est sous GPL-2.0-only. Les interfaces d'outil (vitrine du projet,
configurateur, administration locale) reprennent les projets libres suivants.
Le rendu du journal produit (thème `packages/theme-radar`, hérité de LE-RADAR)
n'en dépend pas.

| Projet | Licence | Usage | Où |
| --- | --- | --- | --- |
| [Basecoat](https://github.com/hunvreus/basecoat) (`basecoat-css`) © hunvreus | MIT | Jetons et composants style shadcn/ui (bouton, badge, carte, alerte, kbd) | `ui/vendor/basecoat-subset.css` (extrait généré), `site/assets/kiosque-ui.css`, `packages/theme-radar/assets/editorial/admin.css` |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) v4 © Tailwind Labs | MIT | Compilation des feuilles ci-dessus (`npm run ui`) | dépendance de développement |
| [AstroWind](https://github.com/arthelokyo/astrowind) © arthelokyo | MIT | Inspiration de structure pour la vitrine (en-tête, héros, sections, appel à l'action). Aucun code copié. | `site/index.html` |
| [Sveltia CMS](https://github.com/sveltia/sveltia-cms) | MIT | CMS facultatif | `packages/theme-radar/assets/admin/` (voir `SVELTIA-LICENSE.txt`) |
| [PGlite](https://github.com/electric-sql/pglite) © ElectricSQL | Apache-2.0 | PostgreSQL dans le navigateur, chargé seulement par `/admin/` | dépendance |

Les textes de licence MIT de Basecoat et Tailwind CSS sont fournis avec leurs
paquets npm (`node_modules/basecoat-css/LICENSE.md`, `node_modules/tailwindcss/LICENSE`).
