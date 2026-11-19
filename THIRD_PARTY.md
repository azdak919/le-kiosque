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
| Bandeau sportif de [LE-RADAR](https://github.com/azdak919/le-radar) (`genderMark`, défilement continu de la sous-ligne, voies scores / en cours / à venir ; notamment les PR 394, 404 et 408) | même auteur, GPL-2.0-only | Reprise adaptée au mât du Kiosque (équipes saisies dans Le Socle, pas moissonnées) : pastilles « (F) » / « (H) », rien si mixte ; libellés longs sur Au tableau ; boucle lente de la sous-ligne ; deux voies sur ordinateur | `packages/theme-radar/assets/kiosque.js`, `packages/theme-radar/src/sports-freshness.js`, `packages/theme-radar/assets/theme.css` |
| [sql.js](https://github.com/sql-js/sql.js) 1.16.0 © 2017 sql.js authors (SQLite : domaine public) | MIT | SQLite dans le navigateur pour la démo, chargé seulement par `/admin/` et le configurateur | fourni par `le-socle/admin/assets/` (`sql-wasm.js`, `sql-wasm.wasm`), copié dans `assets/editorial/` ; licence recopiée dans `le-socle/THIRD_PARTY.md` |
| Icônes des réseaux sociaux, les mêmes que [LE-RADAR](https://github.com/azdak919/le-radar) (`nav-shell.js`, `assets/social-icons/`) : [Simple Icons](https://github.com/simple-icons/simple-icons) v16.36.0 (Facebook, Instagram, X, Bluesky, Mastodon, TikTok, YouTube, Threads) et [Bootstrap Icons](https://github.com/twbs/icons) v1.13.2 © 2019-2024 The Bootstrap Authors (LinkedIn, courriel `envelope-fill`) | CC0 1.0 (Simple Icons) ; MIT (Bootstrap Icons), toutes deux compatibles avec la GPL-2.0-only | Icônes du mât et du pied de page, tracés copiés sans modification, monochromes (`currentColor`). Les marques restent la propriété de leurs détenteurs. | `packages/theme-radar/src/social.js`, copié dans `assets/editorial/` |
| Logo du Kiosque : dessin original (kiosque à auvent rayé), même auteur que le projet | GPL-2.0-only, comme le projet | Logo et icônes d’onglet du Kiosque : pages de présentation, guide, configurateur, icône d’onglet de la démonstration, README. Posé sur le carreau sombre de LE-RADAR (même auteur), avec un filet clair en mode sombre, et réduit en 16, 32, 180 et 512 px. Couleurs prises dans la palette de Twemoji, sans reprendre de dessin. Jamais sur le site public d’un journal, qui garde son logo ou son nom. | `site/assets/logo/` |
| Logo du Socle : emoji « brique » (U+1F9F1) de [Twemoji](https://github.com/jdecked/twemoji) (dépôt `jdecked/twemoji`, commit `b6b55fef1e`), © Twitter, Inc. et autres contributeurs | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.fr), compatible avec la GPL | Espace de rédaction de la démonstration `/admin/`, fourni par le socle épinglé et crédité dans `le-socle/THIRD_PARTY.md` ; visible aussi dans les captures de la page de présentation | `assets/editorial/` du site construit (en ligne dans la page), `site/assets/captures/` |
| Icône « tomate » (U+1F345) du bouton Pomodoro du mât, de [Twemoji](https://github.com/jdecked/twemoji), © Twitter, Inc. et autres contributeurs, reprise de LE-RADAR | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.fr), compatible avec la GPL | Image 72 px sans modification | `packages/theme-radar/assets/emoji/tomato.png` |

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
