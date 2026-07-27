# Publier un article

Deux façons de faire. La première ne demande aucune compétence technique — c'est
celle que la plupart des rédactions utiliseront.

---

## A. Avec l'interface d'édition — **à venir (jalon 2)**

```
votrejournal.ca/admin
  → « Se connecter avec GitHub »
  → « Nouvel article »
  → titre · texte · photo · auteur · section · catégories
  → « Enregistrer le brouillon »
  → « Soumettre en révision »   (la rédaction en chef reçoit une notification)
  → « Publier »                  → le site est à jour en ~40 secondes
```

Aucun Git, aucun terminal, aucun fichier à éditer à la main.

> **Statut actuel :** cette interface n'est pas encore livrée. Le format des
> fichiers décrit ci-dessous est cependant **exactement** celui qu'elle
> produira — quand elle arrivera, il n'y aura rien à migrer.

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
| `status` | oui | `draft`, `in-review`, `published`, `archived` |
| `publishedAt` | si publié | format `AAAA-MM-JJTHH:MM:SSZ`, en UTC |
| `authors` | recommandé | doit correspondre à un fichier de `content/auteurs/` |
| `section` | non | doit correspondre à un fichier de `content/sections/` |
| `excerpt` | non | déduit du premier paragraphe si absent |
| `lead.alt` | **oui si image** | voir ci-dessous |
| `lead.credit` | recommandé | le ou la photographe |
| `previousUrls` | non | anciennes adresses, pour ne pas casser les liens |

**`id` :** ne l'écrivez pas à la main. `sync` en génère un et le fige. Une fois
écrit, **ne le changez jamais** — c'est lui qui identifie l'article à travers
tout changement de CMS.

---

## Deux règles qui bloquent la publication

**1. Toute image doit avoir un `alt`.** Ce n'est pas une formalité : c'est ce
que lisent les personnes aveugles, et ce qui s'affiche quand l'image ne charge
pas. Décrivez ce qu'on voit, pas ce que ça signifie.

- ✅ `alt: "Une assemblée étudiante dans un auditorium bondé"`
- ❌ `alt: "photo"` · ❌ `alt: "IMG_4837"`

**2. Un article publié ne peut pas être vide** et doit porter une date.

`sync` refusera d'écrire et vous dira quoi corriger. Il émet aussi des
avertissements non bloquants — article sans signature, photo sans crédit,
catégorie non déclarée. Ils ne vous empêchent pas de publier, mais une archive
sans crédits photo devient un problème juridique dans cinq ans.

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
