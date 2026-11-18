# Composants tiers

Le Kiosque est sous GPL-2.0-only. Les interfaces d'outil (vitrine du projet,
configurateur, administration locale) reprennent les projets libres suivants.
Le rendu du journal produit (thème `packages/theme-radar`, hérité de LE-RADAR)
n'en dépend pas.

| Projet | Licence | Usage | Où |
| --- | --- | --- | --- |
| Admin de rédaction de [le-socle](https://github.com/azdak919/le-socle) (`le-socle/admin/`) | GPL-2.0-only, même auteur | Écrans de l’admin, client du socle, démo en mode navigateur ; copiés dans le site par le build | `assets/editorial/` du site construit |
| [Basecoat](https://github.com/hunvreus/basecoat) (`basecoat-css`) © hunvreus | MIT | Jetons et composants style shadcn/ui (bouton, badge, carte, alerte, kbd) | `ui/vendor/basecoat-subset.css` (extrait généré), `site/assets/kiosque-ui.css` ; la feuille de l’admin est compilée dans le socle (`le-socle/admin/assets/admin.css`) |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) v4 © Tailwind Labs | MIT | Compilation des feuilles ci-dessus (`npm run ui`) | dépendance de développement |
| [AstroWind](https://github.com/arthelokyo/astrowind) © arthelokyo | MIT | Inspiration de structure pour la vitrine (en-tête, héros, sections, appel à l'action). Aucun code copié. | `site/index.html` |
| [Sveltia CMS](https://github.com/sveltia/sveltia-cms) | MIT | CMS facultatif | `packages/theme-radar/assets/admin/` (voir `SVELTIA-LICENSE.txt`) |
| Barre radio de [LE-RADAR](https://github.com/azdak919/le-radar) (`radio-barre.js`, `radios.json`) | même auteur, GPL-2.0-only | Appelée depuis le-radar.ca, jamais copiée : stations, lecteur et style restent chez LE-RADAR | `packages/theme-radar/src/radio.js` (ligne d’appel seulement) |
| [sql.js](https://github.com/sql-js/sql.js) 1.16.0 © 2017 sql.js authors (SQLite : domaine public) | MIT | SQLite dans le navigateur pour la démo, chargé seulement par `/admin/` et le configurateur | fourni par `le-socle/admin/assets/` (`sql-wasm.js`, `sql-wasm.wasm`), copié dans `assets/editorial/` ; licence recopiée dans `le-socle/THIRD_PARTY.md` |
| Icônes des réseaux sociaux, les mêmes que [LE-RADAR](https://github.com/azdak919/le-radar) (`nav-shell.js`, `assets/social-icons/`) : [Simple Icons](https://github.com/simple-icons/simple-icons) v16.36.0 (Facebook, Instagram, X, Bluesky, Mastodon, TikTok, YouTube, Threads) et [Bootstrap Icons](https://github.com/twbs/icons) v1.13.2 © 2019-2024 The Bootstrap Authors (LinkedIn, courriel `envelope-fill`) | CC0 1.0 (Simple Icons) ; MIT (Bootstrap Icons), toutes deux compatibles avec la GPL-2.0-only | Icônes du mât et du pied de page, tracés copiés sans modification, monochromes (`currentColor`). Les marques restent la propriété de leurs détenteurs. | `packages/theme-radar/src/social.js`, copié dans `assets/editorial/` |

Les textes de licence MIT de Basecoat et Tailwind CSS sont fournis avec leurs
paquets npm (`node_modules/basecoat-css/LICENSE.md`, `node_modules/tailwindcss/LICENSE`).

### Bootstrap Icons (MIT)

```
The MIT License (MIT)

Copyright (c) 2019-2024 The Bootstrap Authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

Simple Icons est sous CC0 1.0 (dédication au domaine public) : aucune
condition, crédit donné par courtoisie.
