# LE KIOSQUE

> *Kit d'Infrastructure Ouverte, Souveraine et de Qualité pour les Usages Éditoriaux.*
>
> **« Publier aujourd'hui. Transmettre demain. »**

Socle libre pour les journaux étudiants, les médias de campus et les équipes
éditoriales. Conçu pour survivre à ses fondateurs.

**LE RADAR** est l'agrégateur et le réseau de découverte des médias étudiants.
**LE KIOSQUE** est le kit qui permet d'en créer un. Deux projets distincts : un
journal sous LE KIOSQUE reste propriétaire de son domaine, de son hébergement,
de ses comptes et de ses contenus.

Un journal étudiant ne meurt presque jamais par manque de talent. Il meurt parce
que le domaine a expiré, que l'hébergement n'est plus payé, que le compte
d'administration appartient à quelqu'un qui a gradué, et que dix ans d'archives
sont partis avec.

Le Kiosque est une réponse à ce problème-là — pas à celui de fabriquer un joli
site, qui est le problème facile.

> **Agents et personnes qui reprennent le projet :** lire
> **[`AGENTS.md`](AGENTS.md)** (architecture, invariants, pièges déjà payés)
> puis **[`SUITE.md`](SUITE.md)** (la mission en cours et son prompt d'amorçage).

**État : jalon 2.** Le socle, la chaîne complète et l'interface de rédaction
fonctionnent. Voir la [feuille de route](#feuille-de-route).

---

## Le principe

> **La génération du site ne parle jamais au CMS.**
> Seule l'étape `sync` le fait. Le CMS alimente un miroir portable dans Git ; le
> site se construit *uniquement* depuis ce miroir.

```
CMS au choix ──sync──► content/*.md + media/ ──build──► site statique
(peut mourir)          (l'archive, dans Git)           (ne meurt pas)
```

Un backend qui meurt casse l'écriture, **jamais** la lecture. Tout le reste du
projet découle de cette seule frontière :

- **Vous n'êtes prisonnier de rien.** Markdown/Git par défaut ; WordPress,
  Ghost, Superdesk ou Drupal si vous préférez. Le site ne change pas.
- **Le site ne peut pas se vider tout seul.** Un quota dépassé ou un jeton
  expiré fait échouer `sync` bruyamment — le site publié reste intact.
- **Les archives sont récupérables sans rien.** Du Markdown et des images dans
  Git. `npm ci && kiosque build` reconstruit tout, sans aucun compte ni secret.
- **Trois ans de sommeil ne cassent rien.** Le site est statique : il n'y a
  rien à redémarrer.

---

## Démarrer

**Faites un fork.** Vous héritez ainsi du bouton « Sync fork » et des
propositions de mise à jour de la plateforme.

```bash
git clone https://github.com/<votre-organisation>/<votre-journal>.git
cd <votre-journal>
npm ci

node packages/pipeline/src/cli.ts sync
node packages/pipeline/src/cli.ts build
```

Activez GitHub Pages (Settings → Pages → GitHub Actions) : le site est en ligne,
gratuitement, sur `https://<organisation>.github.io/<depot>/`.

Servi dans un sous-dossier ? Renseignez-le, sinon les liens pointent à côté :

```ts
// kiosque.config.ts
deploy: { basePath: '/<depot>' }   // laisser vide avec un domaine dédié
```

**Deux fichiers à éditer, pas plus :**

| Fichier | Rôle |
|---|---|
| `theme/tokens.css` | vos couleurs, votre typographie |
| `kiosque.config.ts` | votre backend, votre déploiement |

**Trois fichiers à lire :** [`AJOUTER-UN-ARTICLE.md`](template/AJOUTER-UN-ARTICLE.md) ·
[`OWNERS.md`](template/OWNERS.md) · [`RESTAURATION.md`](template/RESTAURATION.md)

**Pour que votre équipe écrive sans jamais voir Git :**
[`docs/brancher-sveltia.md`](docs/brancher-sveltia.md)

---

## Mises à jour de la plateforme

Personne ne peut écrire dans votre dépôt — pas même nous. Le workflow
`maj-plateforme.yml` va chercher les améliorations en amont et vous les **propose
en pull request**. Vous mergez, ou vous ignorez.

Ça reste sans conflit parce que la frontière est stricte :

```
À VOUS, jamais touché par l'amont
  content/  media/  theme/tokens.css  kiosque.config.ts  OWNERS.md

À LA PLATEFORME, ne pas modifier à la main
  packages/  tools/  .github/workflows/
```

---

## Structure

```
packages/
  core/            modèle commun + contrats — zéro dépendance
  adapters/
    markdown/      adaptateur de référence
    wordpress/     squelette (jalon 4)
  pipeline/        sync · build · verify · cms:config
  theme-radar/     identité éditoriale : jetons + gabarits
template/          ce que vous éditez
examples/          journal de démonstration
docs/              guides
```

Deux dépendances en tout (`yaml`, `marked`), aucune étape de compilation :
Node exécute le TypeScript directement. Chaque dépendance est une dette de
survie.

---

## Feuille de route

| Jalon | Contenu | État |
|---|---|---|
| **1** | Noyau, adaptateur Markdown, thème, chaîne complète, test de continuité | **fait** |
| **2** | Sveltia CMS, statut éditorial, identifiants permanents | **fait** |
| 3 | Barre radio LE RADAR + API publique | à venir |
| 4 | `doctor`, `adopt`, passation, `export` | à venir |
| 5 | Adaptateur WordPress/Newspack | à venir |
| 6 | Premier pilote avec une vraie équipe | à venir |

---

## Ce que Le Kiosque fournit — et ce qu'il ne fournit pas

**Fourni gratuitement, selon les ressources disponibles :** le gabarit libre, la
documentation d'installation et de reprise, une aide bénévole au déploiement
initial, des recommandations d'hébergeur / domaine / CMS, l'architecture
multi-backend, les guides de passation, la procédure de restauration, la barre
radio, l'inscription à l'annuaire [LE RADAR](https://le-radar.ca), et lorsque
possible une orientation vers des fournisseurs partenaires ou des solutions
d'économie sociale.

**Chaque journal demeure responsable de :** son hébergement, son domaine, ses
comptes d'administration, ses sauvegardes, sa sécurité, ses dépenses, et la
gestion et la publication de son contenu.

**Le Kiosque et LE RADAR n'hébergent pas les sites** et ne garantissent aucune
infrastructure, aucune maintenance permanente, aucun niveau de service ni aucun
service commercial. L'accompagnement est bénévole et offert selon les
disponibilités.

L'architecture laisse la porte ouverte à des partenariats, des services payants
facultatifs ou une coopérative — **sans qu'aucun journal ne devienne dépendant
du Kiosque pour conserver ou migrer ses contenus.** Le référencement dans
l'annuaire signifie seulement que LE RADAR lit un flux RSS public et conserve
les métadonnées nécessaires à l'agrégation.

---

## Licence

**GNU GPL v2** ([`LICENSE`](LICENSE)), comme
[LE RADAR](https://github.com/azdak919/le-radar), dont ce projet reprend
l'identité visuelle (valeurs **copiées** dans
`packages/theme-radar/assets/tokens.css`, pas liées — chaque projet garde sa
liberté d'évoluer).

Sveltia CMS est redistribué sous licence MIT
(`packages/theme-radar/assets/admin/SVELTIA-LICENSE.txt`).

Les contenus publiés par chaque journal appartiennent à leurs autrices et
auteurs.
