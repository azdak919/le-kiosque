# Reprendre ce journal

> À lire si vous arrivez sur ce projet sans que personne ne soit là pour vous
> l'expliquer. C'est le scénario prévu, pas un accident.

Prenez trente secondes pour la seule chose qui compte vraiment :

**Le site n'est pas tombé.** Il est statique. Aucun serveur à redémarrer, aucune
base de données à réparer, aucun certificat applicatif à renouveler. Même si
plus personne n'y a touché depuis trois ans, il répond encore.

Ce que vous avez à faire n'est donc pas de le *ressusciter*, mais d'en
**reprendre les clés**.

---

## 1. Reconstruire le site — 5 minutes, sans aucun accès

Ce test répond à la seule question qui compte : les archives sont-elles
récupérables ? Il ne demande **aucun mot de passe, aucun jeton, aucun compte**.

```bash
git clone <l-url-du-depot>
cd <le-depot>
npm ci
node packages/pipeline/src/cli.ts build
```

Ouvrez `dist/index.html`. Si le journal s'affiche, **tout est là** : chaque
article, chaque photo, chaque signature. Le reste n'est que de l'administration.

Pourquoi ça marche sans rien : les articles sont des fichiers Markdown dans
`content/`, les images des fichiers dans `media/`, et `build` ne parle à aucun
service extérieur. Le CMS qu'utilisait l'équipe précédente peut avoir fermé
depuis longtemps — ça ne change rien.

---

## 2. Vérifier que l'archive est intacte

```bash
node packages/pipeline/src/cli.ts verify
```

Chaque image a été enregistrée avec son empreinte au moment de sa publication.
Cette commande les recalcule et signale tout fichier disparu ou corrompu.

- **« aucun média manquant ni corrompu »** → l'archive est saine.
- **média manquant** → récupérable dans l'historique Git :
  `git log --all --diff-filter=D -- media/` puis `git checkout <commit>^ -- <fichier>`
- **média corrompu** → même méthode, en remontant jusqu'à une version valide.

---

## 3. Reprendre les accès

Ouvrez [`OWNERS.md`](OWNERS.md) : il liste qui détient quoi. Suivez-le dans cet
ordre — le premier point est de loin le plus urgent.

| Ordre | Ressource | Pourquoi c'est urgent |
|---|---|---|
| 1 | **Nom de domaine** | Cause de mort n°1. Une fois expiré et racheté, il ne revient pas. Vérifiez l'échéance **aujourd'hui**. |
| 2 | **Organisation GitHub** | Si le dépôt appartient à un compte personnel, transférez-le vers une organisation. |
| 3 | **Hébergement** | GitHub Pages ne se facture pas. Un autre hébergeur, oui. |
| 4 | **Accès au CMS** | Le moins pressé : le site fonctionne sans. |

**Plus personne n'a les accès ?** Écrivez à l'entité permanente inscrite dans
`OWNERS.md` (association étudiante, coopérative, OBNL, direction de
l'établissement). C'est précisément pour cette situation qu'elle y figure.

**Le domaine est perdu ?** Le journal survit quand même : republiez sur l'URL
GitHub Pages par défaut (`https://<organisation>.github.io/<depot>/`), en
mettant `deploy.basePath` dans `kiosque.config.ts`. Vous perdrez les liens
externes, jamais le contenu.

---

## 4. Republier

```bash
node packages/pipeline/src/cli.ts build
git add -A && git commit -m "Reprise par la cohorte <année>" && git push
```

Le workflow `publier.yml` s'occupe du déploiement.

Si `build` s'arrête sur un message de ce genre :

```
Le site publié perdrait des articles : 47 → 0
```

**c'est le garde-fou, et il vient de vous éviter une catastrophe.** Il refuse
de publier un site plus vide que l'archive. La cause est presque toujours un
jeton expiré ou un CMS qui répond « 0 article ». Réglez la cause. N'ajoutez
`--allow-deletions` que si la suppression est réellement voulue.

---

## 5. Rebrancher un CMS — ou s'en passer

Le site n'a **pas besoin** d'un CMS pour fonctionner. Ne vous précipitez pas.

- **Reprendre l'interface d'édition existante** : voir `kiosque.config.ts`,
  section `source`.
- **Changer de CMS** : exportez d'abord l'archive
  (`kiosque export --format=wxr` pour WordPress), importez-la dans le nouveau,
  puis changez `source.adapter`. Les identifiants d'articles et les URL
  canoniques sont conservés — aucun doublon, aucun lien mort.
- **Rester en Markdown** : c'est une option parfaitement viable. Beaucoup de
  rédactions écrivent très bien ainsi.

---

## Ce qui continue de fonctionner, et ce qui s'arrête

Quand le backend éditorial tombe :

| Continue | S'arrête |
|---|---|
| Tout le site publié | Créer un article |
| Les archives, jusqu'au premier numéro | Modifier un article |
| Le flux RSS | Publier |
| La recherche par moteur | Téléverser une image |
| L'agrégation par LE-RADAR | |
| La reconstruction complète du site | |

**Un journal peut rester lisible pendant des années sans que personne ne
l'administre.** C'est la propriété pour laquelle tout le reste a été conçu.

---

## Et après

Une fois le journal repris, remplissez [`RELEVE.md`](RELEVE.md) pour la
prochaine équipe. Vous venez de vivre exactement ce qu'elle vivra.
