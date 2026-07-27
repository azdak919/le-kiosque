# Publier un article

Deux façons de faire. La première ne demande aucune compétence technique — c'est
celle que la plupart des rédactions utiliseront.

---

## A. Avec l'interface d'édition

Rendez-vous sur **`votrejournal.ca/admin`** et connectez-vous avec GitHub.

Aucun Git, aucun terminal, aucun fichier à éditer à la main.

### Rédiger

**« Nouvel article »**, puis remplissez : titre, adresse, texte, photo,
signature, section, catégories.

Deux champs méritent une seconde d'attention :

- **Adresse (slug)** — elle apparaît dans l'URL. Une fois l'article publié,
  ne la changez plus : tous les liens partagés cesseraient de fonctionner.
  (Si vous devez vraiment la changer, voir *Corriger un article publié*.)
- **Description de l'image** — obligatoire. C'est ce que lisent les personnes
  aveugles, et ce qui s'affiche quand l'image ne charge pas. Décrivez ce qu'on
  voit : « Une assemblée étudiante dans un auditorium bondé », pas « photo ».

Le statut par défaut est **Brouillon**. Enregistrez aussi souvent que vous
voulez : un brouillon n'apparaît nulle part sur le site.

### Soumettre en révision

Passez le statut à **En révision**, puis enregistrez.

L'article reste invisible du public. Il est simplement marqué comme prêt à être
relu. Prévenez la rédaction en chef — le CMS n'envoie pas de notification.

### Corriger

La personne qui révise ouvre l'article, corrige, puis :

- **remet en Brouillon** si le texte demande encore du travail ;
- **passe à Publié** si tout est bon.

### Publier

Statut à **Publié**, enregistrer. Le site est à jour en une quarantaine de
secondes.

La publication est refusée tant qu'il manque : un titre, une adresse, **une
signature**, **une section**, une **date de publication** ou du texte. Ce n'est
pas de la rigidité administrative : un article de journal sans signature ni date
n'est pas citable, et une archive qui en est pleine perd sa valeur.

### Ce qui se passe derrière

Chaque enregistrement crée un commit dans le dépôt Git — l'historique complet du
journal, qui date, horodate et attribue chaque modification. Vous n'avez jamais
à le voir ni à le comprendre. Il est là le jour où quelqu'un demande « qui a
changé quoi, et quand », et le jour où il faut restaurer une version.

### Les trois statuts, en résumé

| Statut | Enregistré | Visible du public |
|---|---|---|
| **Brouillon** | oui | non |
| **En révision** | oui | non |
| **Publié** | oui | oui |

> **Une limite à connaître :** ces statuts sont une convention d'équipe, pas une
> barrière technique. Toute personne ayant accès en écriture au dépôt peut
> publier directement. La révision par validation obligatoire n'existe pas encore
> dans Sveltia CMS — voir [`docs/brancher-sveltia.md`](../docs/brancher-sveltia.md).

Mise en service de l'interface : [`docs/brancher-sveltia.md`](../docs/brancher-sveltia.md).

---

## B. En écrivant le fichier

Créez `content/articles/2026/09/mon-article.md` :

```markdown
---
title: "Le titre de l'article"
slug: mon-article
status: published
publishedAt: 2026-09-12T14:30:00Z
updatedAt: 2026-09-12T14:30:00Z
authors: [prenom-nom]
section: actualites
categories: [vie-etudiante]
tags: [assemblee-generale]
lang: fr-CA
lead:
  src: /media/2026/09/photo.jpg
  alt: "Description de l'image pour qui ne la voit pas"
  credit: "Prénom Nom"
---

Le texte de l'article, en Markdown.

## Un intertitre

Un paragraphe. On met un [lien](https://exemple.ca) comme ceci, du **gras**
comme cela.
```

Puis :

```bash
node packages/pipeline/src/cli.ts sync    # valide et normalise
node packages/pipeline/src/cli.ts build   # produit le site
git add -A && git commit -m "Article : le titre" && git push
```

---

## Les champs

| Champ | Obligatoire | Notes |
|---|---|---|
| `title` | oui | |
| `slug` | non | déduit du nom de fichier |
| `status` | oui | `draft`, `in-review`, `published` — `archived` en plus, pour retirer du fil sans casser les liens |
| `publishedAt` | **si publié** | format `AAAA-MM-JJTHH:MM:SSZ`, en UTC |
| `authors` | **si publié** | doit correspondre à un fichier de `content/auteurs/` |
| `section` | **si publié** | doit correspondre à un fichier de `content/sections/` |
| `excerpt` | non | déduit du premier paragraphe si absent |
| `lead.alt` | **oui si image** | voir ci-dessous |
| `lead.credit` | recommandé | le ou la photographe |
| `previousUrls` | non | anciennes adresses, pour ne pas casser les liens |

**`id` :** ne l'écrivez pas à la main. `sync` en génère un et le fige. Une fois
écrit, **ne le changez jamais** — c'est lui qui identifie l'article à travers
tout changement de CMS.

---

## Ce qui bloque la publication

Un **brouillon** peut être aussi incomplet que vous voulez — c'est le propre
d'un brouillon. Ce sont les articles **publiés** qui doivent tenir debout :

| Exigence | Pourquoi |
|---|---|
| `title` et `slug` | sans quoi il n'y a ni page ni adresse |
| `authors` — au moins une | un article de journal non signé n'est pas citable |
| `section` | sinon il n'apparaît dans aucune rubrique |
| `publishedAt` | une archive sans dates est inexploitable |
| un corps non vide | |
| `alt` sur chaque image | c'est ce que lisent les personnes aveugles, et ce qui s'affiche quand l'image ne charge pas |

Pour le texte alternatif :
- ✅ `alt: "Une assemblée étudiante dans un auditorium bondé"`
- ❌ `alt: "photo"` · ❌ `alt: "IMG_4837"`

`sync` refuse d'écrire et vous dit exactement quoi corriger, avec le chemin du
fichier fautif.

Il émet aussi des **avertissements non bloquants** : extrait absent, photo sans
crédit, catégorie non déclarée, gouvernance incomplète. Ils ne vous empêchent
pas de publier — mais une archive sans crédits photo devient un problème
juridique dans cinq ans, et une gouvernance incomplète tue le journal à la
prochaine graduation.

---

## Corriger un article publié

Modifiez le fichier, mettez `updatedAt` à jour, republiez. La mention « Mis à
jour le… » apparaît automatiquement sur la page.

**Ne changez pas le `slug` d'un article déjà publié** sans ajouter l'ancienne
adresse dans `previousUrls` — sinon tous les liens partagés vers cet article
meurent :

```yaml
slug: nouveau-slug
previousUrls:
  - https://votrejournal.ca/articles/ancien-slug/
```

Le site générera une redirection. Un lien partagé il y a cinq ans continuera de
fonctionner.

---

## Dépublier

Passez `status` à `archived` (l'article reste accessible par son URL, sort du
fil) ou `draft` (il disparaît du site publié).

Pour un retrait complet, supprimez le fichier — mais lisez d'abord la politique
éditoriale du journal. Une archive de presse qu'on peut réécrire n'est plus une
archive.
