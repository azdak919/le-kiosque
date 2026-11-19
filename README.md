<picture>
  <source media="(prefers-color-scheme: dark)" srcset="site/assets/logo/icone-sombre.svg">
  <img src="site/assets/logo/icone-clair.svg" alt="Logo du Kiosque" width="72" height="72">
</picture>

# Le Kiosque

*Kit d’Infrastructure Ouverte, Souveraine et de Qualité pour les Usages Éditoriaux.*

**Plateforme libre pour les journaux étudiants.** Elle fournit le site Web public du journal et l’espace de rédaction, livrés ensemble dans un seul paquet.

Un journal étudiant ne disparaît presque jamais par manque de talent. Il disparaît parce que le domaine a expiré, que l’hébergement n’est plus payé, ou que le compte d’administration est parti avec quelqu’un qui a gradué. Le Kiosque répond à ce problème : chaque journal installe sa propre copie, sans dépendre d’aucun serveur central, et garde ses archives.

[![Page d’accueil du Quorum, journal de démonstration](site/assets/captures/quorum-accueil-ordi.jpg)](https://azdak919.github.io/le-kiosque/demo/)

<p align="center"><em>Le Quorum, journal de démonstration — météo, sports, barre radio et fil d’articles.</em></p>

- **Page de présentation :** <https://azdak919.github.io/le-kiosque/>
- **Démonstration :** <https://azdak919.github.io/le-kiosque/demo/>
- **Guide d’une page :** <https://azdak919.github.io/le-kiosque/guide/>
- **Paquet complet :** <https://github.com/azdak919/le-kiosque/releases/latest/download/kiosque-journal.zip>

Le Radar est l’agrégateur des médias étudiants. Le Kiosque est la plateforme qui permet d’en faire paraître un. Les deux projets sont distincts : un journal sous le Kiosque reste maître de son domaine, de son hébergement, de ses comptes et de ses contenus.

---

## À qui ça s’adresse

Aux équipes de journaux étudiants et de médias de campus qui veulent un site à elles, simple à transmettre d’une cohorte à l’autre. L’installation se fait dans le navigateur. Il ne faut ni ligne de commande, ni compte GitHub.

---

## Installer un journal

1. **Téléchargez** [`kiosque-journal.zip`](https://github.com/azdak919/le-kiosque/releases/latest/download/kiosque-journal.zip) — toujours la dernière version, à une adresse fixe.
2. **Déposez** le contenu du dossier `kiosque-journal/` à la racine de l’espace Web d’un hébergeur **PHP 8.1 ou plus récent, avec SQLite** (serveur du cégep ou de l’association, hébergeur habituel, ou essai gratuit chez [alwaysdata](docs/hebergeur-gratuit.md)). Un sous-dossier reste possible si vous le souhaitez.
3. **Ouvrez** `https://votre-journal.com/redaction/` et remplissez l’assistant : nom, rubriques, logo au besoin, compte administrateur. Attendez le message « Le journal est installé ».
4. **Écrivez**, relisez, publiez. L’article paraît tout de suite. Téléchargez une sauvegarde à chaque fin de session.

Le détail, pour un étudiant, tient dans le [guide d’une page](https://azdak919.github.io/le-kiosque/guide/). Le [guide étudiant complet](docs/guide-etudiant.md) couvre aussi les autres chemins : site public sur GitHub Pages, serveur de l’établissement, auto-hébergement.

---

## Ce que fait la plateforme

**Sur le site Web public**

- Le mât affiche le nom du journal en grand ; s’il y a un logo, le logo remplace le nom.
- Rubriques, pages d’articles, pages des signatures, recherche dans la page, mode sombre.
- Météo locale, résultats sportifs et barre radio, au choix. La radio est un module du [Radar](https://le-radar.ca), chargé depuis le-radar.ca.
- Chaque article porte toutes ses signatures ; chaque photo porte son crédit et sa licence.
- Sur la démonstration et sur un site statique (par exemple GitHub Pages) : archives, plan du site et fil RSS.

**Dans l’espace de rédaction** (c’est [le Socle](https://azdak919.github.io/le-socle/) : l’interface d’administration et son serveur)

- Assistant d’installation dans le navigateur.
- Rôles : auteur, photographe, réviseur, chef de pupitre, éditeur, administrateur. Un auteur ou un chef de pupitre peut être limité à certaines rubriques.
- Banque de photos, avec crédit obligatoire.
- Aperçu de l’article dans le thème, sans le publier.
- Sauvegarde complète en un fichier ZIP, et restauration.
- Mise à jour en un clic, quand une version de la plateforme est publiée.

![Assistant d’installation](site/assets/captures/assistant-installation.jpg)

<p align="center"><em>L’assistant, à la première visite de l’espace de rédaction.</em></p>

![Banque de photos](site/assets/captures/banque-photos.jpg)

<p align="center"><em>La banque de photos, avec crédit et licence.</em></p>

---

## Travailler sur le code

```bash
git clone https://github.com/azdak919/le-kiosque.git
cd le-kiosque
npm ci
npm test
npm run site
```

`npm run site` construit la page de présentation, le configurateur et la démonstration Le Quorum dans `dist/`. Le guide de contribution et les invariants du projet sont dans [`AGENTS.md`](AGENTS.md).

---

## Licence et crédits

Le logiciel est sous [GPL version 2 seulement](LICENSE). Les contenus publiés par chaque journal appartiennent à leurs autrices, auteurs et à l’équipe. Les composants tiers sont listés dans [`THIRD_PARTY.md`](THIRD_PARTY.md). Le logo du Kiosque, un kiosque à auvent rayé, est un dessin original publié sous la même licence que le logiciel.

L’identité visuelle reprend celle du [Radar](https://github.com/azdak919/le-radar), sans y être liée : chaque projet peut évoluer de son côté.
