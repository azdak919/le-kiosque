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

### Photos de la démonstration Le Quorum

Ces photos n’entrent pas dans le paquet d’installation : la banque d’un journal
neuf reste vide. Elles illustrent seulement la démonstration (`examples/demo-journal/media/demo-library/`)
et les captures des pages publiques. Fichiers JPEG tirés de l’original Wikimedia
Commons, long côté au plus 2400 px, proportions conservées. Licences CC0, CC BY
ou CC BY-SA. Le code du Kiosque reste GPL-2.0-only ; ces photos gardent leur
propre licence et ne sont pas fondues dans le programme.

| Fichier | Crédit | Licence | Source |
| --- | --- | --- | --- |
| `campus-sainte-foy.jpg` | Khayman | CC BY-SA 3.0 | [source](https://commons.wikimedia.org/wiki/File:Campus_du_C%C3%A9gep_de_Sainte-Foy01.JPG) |
| `interieur-sainte-foy.jpg` | Khayman | CC BY-SA 3.0 | [source](https://commons.wikimedia.org/wiki/File:C%C3%A9gep_de_Sainte-Foy_(int%C3%A9rieur).JPG) |
| `football-jonquiere.jpg` | Khayman | CC BY-SA 3.0 | [source](https://commons.wikimedia.org/wiki/File:Terrain_de_football_du_C%C3%A9gep_de_Jonqui%C3%A8re.JPG) |
| `campus-limoilou.jpg` | Pierre-Paul Beaumont | CC BY 2.0 ca | [source](https://commons.wikimedia.org/wiki/File:Campus_de_Qu%C3%A9bec.jpg) |
| `mcgill-roddick.jpg` | Gene.arboit | CC BY-SA 3.0 | [source](https://commons.wikimedia.org/wiki/File:Roddick_Gates_(McGill_University)_2005-09-02.jpg) |
| `uqam-jasmin.jpg` | Great11 | CC BY-SA 4.0 | [source](https://commons.wikimedia.org/wiki/File:Pavillon_Judith-Jasmin_UQAM_1.jpg) |
| `ulaval-campus.jpg` | Wilfredor | CC0 | [source](https://commons.wikimedia.org/wiki/File:Universit%C3%A9_Laval%2C_Quebec%2C_Canada_02.jpg) |
| `ulaval-parc.jpg` | Wilfredor | CC BY-SA 4.0 | [source](https://commons.wikimedia.org/wiki/File:Park_in_Universit%C3%A9_Laval.jpg) |
| `concordia-hall.jpg` | Jeangagnon | CC BY-SA 3.0 | [source](https://commons.wikimedia.org/wiki/File:Henry_F._Hall_Building_07.JPG) |
| `udem-gaudry.jpg` | Funke | CC BY-SA 4.0 | [source](https://commons.wikimedia.org/wiki/File:Pavillon_Roger-Gaudry_II.jpg) |
| `bishops-campus.jpg` | Balcer | CC BY 3.0 | [source](https://commons.wikimedia.org/wiki/File:Bishop's_University_campus_2011.jpg) |
| `mcgill-campus.jpg` | Jeangagnon | CC BY-SA 3.0 | [source](https://commons.wikimedia.org/wiki/File:McGill_University_downtown_campus_31.JPG) |
| `sherbrooke-longueuil.jpg` | Jeangagnon | CC BY-SA 3.0 | [source](https://commons.wikimedia.org/wiki/File:Campus_de_Longueuil_-_Universite_de_Sherbrooke_09.jpg) |
| `uqtr-boucher.jpg` | Lëa-Kim Châteauneuf | CC BY-SA 4.0 | [source](https://commons.wikimedia.org/wiki/File:Campus_de_l'UQTR_%C3%A0_Drummondville.jpg) |
| `cegep-vieux-montreal.jpg` | Khayman | CC BY-SA 3.0 | [source](https://commons.wikimedia.org/wiki/File:C%C3%A9gep_du_Vieux_Montr%C3%A9al01.JPG) |
| `mcgill-arts.jpg` | Gene.arboit | CC BY-SA 3.0 | [source](https://commons.wikimedia.org/wiki/File:Arts_Building%2C_McGill_University.jpg) |
| `bishops-mcgreer.jpg` | Balcer | CC BY 3.0 | [source](https://commons.wikimedia.org/wiki/File:Bishop's_University_McGreer_Hall.jpg) |
| `articles/soccer.jpg` | Noah Riffe | CC0 | [source](https://commons.wikimedia.org/wiki/File:Stoney_Brook_vs._Penn_State_Women's_Soccer.jpg) |
| `articles/basketball.jpg` | Bama in ATL | CC BY-SA 4.0 | [source](https://commons.wikimedia.org/wiki/File:2016_Auburn_at_Alabama_NCAAM_Basketball_Game.jpg) |
| `articles/course.jpg` | Isaacvp | CC BY-SA 4.0 | [source](https://commons.wikimedia.org/wiki/File:2018_Orizaba_Running_race_01.jpg) |
| `articles/serre.jpg` | Rodrigo.Argenton | CC BY-SA 4.0 | [source](https://commons.wikimedia.org/wiki/File:Estufa_principal_do_Jardim_Bot%C3%A2nico_de_Curitiba_02.jpg) |
| `articles/labo.jpg` | Horia Varlan | CC BY 2.0 | [source](https://commons.wikimedia.org/wiki/File:Chemistry_laboratory.jpg) |
| `articles/radio.jpg` | Arielinson | CC BY-SA 4.0 | [source](https://commons.wikimedia.org/wiki/File:Kol_Israel_Heleni_Hamalka_DSC0094.jpg) |
| `articles/campus-vie.jpg` | Tulane Public Relations | CC BY 2.0 | [source](https://commons.wikimedia.org/wiki/File:Students_enjoy_springtime_weather._(5554288570).jpg) |
| `articles/velo.jpg` | Briana18091440 | CC BY-SA 4.0 | [source](https://commons.wikimedia.org/wiki/File:Bike_repair_station.jpg) |
| `articles/compost.jpg` | fir0002  flagstaffotos [at] gmail.com
		Canon 20D + Tamron 28-75mm f/2.8 | GFDL 1.2 | [source](https://commons.wikimedia.org/wiki/File:Compost_bin.jpg) |
| `articles/biblio-pc.jpg` | Tulane Public Relations | CC BY 2.0 | [source](https://commons.wikimedia.org/wiki/File:2012_-_studying_in_Howard-Tilton_Library_New_Orleans.jpg) |
| `articles/amphi.jpg` | Kannan5645 | CC BY-SA 3.0 | [source](https://commons.wikimedia.org/wiki/File:Lecture_hall.jpg) |
| `articles/caf.jpg` | Tanvir Hussain | CC BY-SA 3.0 | [source](https://commons.wikimedia.org/wiki/File:Cafeteria.jpg) |
| `articles/cinema.jpg` | Mr N | CC BY-SA 4.0 | [source](https://commons.wikimedia.org/wiki/File:Kinolino-Kellerkino_02.jpg) |
| `articles/livres.jpg` | w:it:Utente:OrbiliusMagister | Public domain | [source](https://commons.wikimedia.org/wiki/File:Bookshelves.jpg) |
| `articles/bus.jpg` | Bouchecl | CC BY-SA 3.0 | [source](https://commons.wikimedia.org/wiki/File:Qu%C3%A9bec_RTC_-_Nova_Bus_LFS.jpg) |
| `articles/calme.jpg` | Mourial | CC BY-SA 3.0 | [source](https://commons.wikimedia.org/wiki/File:Grande_Bibliotheque_Quebec_Interieur.JPG) |
| `articles/arts.jpg` | YessMendez | CC BY-SA 4.0 | [source](https://commons.wikimedia.org/wiki/File:Art_exhibition.jpg) |
| `articles/parking.jpg` | David Shay | CC BY-SA 2.5 | [source](https://commons.wikimedia.org/wiki/File:Bicycle_parking.jpg) |
| `articles/hockey.jpg` | Daniel Case | CC BY-SA 3.0 | [source](https://commons.wikimedia.org/wiki/File:Shot_on_goal_during_youth_hockey_tournament_at_West_Edmonton_Mall_Ice_Palace.jpg) |
| `articles/hockey-interieur.jpg` | U.S. Navy photo by Mass Communication Specialist 2nd Class Joshua Scott | Public domain | [source](https://commons.wikimedia.org/wiki/File:Championship_floor_hockey_game_150303-N-GT589-067.jpg) |
| `articles/volleyball.jpg` | Zorro2212 | CC BY-SA 3.0 | [source](https://commons.wikimedia.org/wiki/File:Volleyball_match_-_shakehands_before_the_match.jpg) |
| `articles/chess.jpg` | Wilfredor | CC0 | [source](https://commons.wikimedia.org/wiki/File:Chess_game_Staunton_No._6_perfil_view_8.jpg) |
| `articles/blood.jpg` | Staff Sgt. Stephanie Rubi, U.S. Air Force | Public domain | [source](https://commons.wikimedia.org/wiki/File:Patient_gets_blood_drawn_to_be_screened_as_a_blood_donor.jpg) |
| `articles/mural.jpg` | Coastal Elite from Halifax, Canada | CC BY-SA 2.0 | [source](https://commons.wikimedia.org/wiki/File:Montreal_Street_Art_Graffiti_(29241125286).jpg) |
| `articles/tutoring.jpg` | JBouchez | CC BY-SA 4.0 | [source](https://commons.wikimedia.org/wiki/File:Formation_condens%C3%A9e_%C3%A0_Wikip%C3%A9dia_lors_du_cours_IPMSH_du_C%C3%A9gep_du_Vieux_Montr%C3%A9al.jpg) |
| `articles/resume.jpg` | HeatherKatz001 | CC BY-SA 4.0 | [source](https://commons.wikimedia.org/wiki/File:What_to_Expect_at_a_Job_Interview_at_a_Teaching_School.jpg) |
| `articles/nursing.jpg` | Pambelle12 | CC BY-SA 4.0 | [source](https://commons.wikimedia.org/wiki/File:Checking_blood_pressure.jpg) |
| `articles/career.jpg` | German Embassy London | CC BY 2.0 | [source](https://commons.wikimedia.org/wiki/File:Exhibitors_at_the_Career_Fair_(30983205220).jpg) |
| `articles/stage.jpg` | art_inthecity from Montréal, CA | CC BY 2.0 | [source](https://commons.wikimedia.org/wiki/File:Le_chant_des_cageux%2C_C%C3%A9g%C3%A9p_du_Vieux_Montr%C3%A9al%2C_2020._(49623021442).jpg) |
| `articles/trail.jpg` | Jean Gagnon | CC BY-SA 3.0 | [source](https://commons.wikimedia.org/wiki/File:Parc_du_Mont-Royal_015.jpg) |
| `articles/graduation.jpg` | Stewart Oak, Imperial College London | CC BY 4.0 | [source](https://commons.wikimedia.org/wiki/File:Imperial_College_London_graduation_gowns.jpg) |
| `articles/participatory.jpg` | Khayman | CC BY-SA 3.0 | [source](https://commons.wikimedia.org/wiki/File:C%C3%A9gep_de_Sainte-Foy_(int%C3%A9rieur).JPG) |
| `articles/photo-club.jpg` | Coastal Elite from Halifax, Canada | CC BY-SA 2.0 | [source](https://commons.wikimedia.org/wiki/File:Montreal_Street_Art_Graffiti_(29241125286).jpg) |
