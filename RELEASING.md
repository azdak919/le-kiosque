# Publier une version

Une **version** du Kiosque (étiquette `vX.Y.Z` et Release GitHub) fabrique le
**paquet complet** `kiosque-journal.zip` : le site Web du journal et l'espace
de rédaction (le socle épinglé). Les journaux installés le reçoivent par la
page **Mise à jour** (mise à jour en un clic). Tant qu'une PR est seulement
fusionnée dans `main`, aucun journal installé ne la voit.

Ce guide vaut pour le dépôt du Kiosque (`azdak919/le-kiosque`). Un journal
créé depuis ce modèle ne publie rien : les workflows de publication ne
tournent pas chez lui.

## Quand publier

L'issue **« Prochaine version »** (étiquette `prochaine-version`) se tient à
jour toute seule à chaque fusion dans `main` : elle liste les PR fusionnées
depuis la dernière étiquette et affiche un avis quand des changements
**visibles** attendent (site Web, thème, configurateur, paquet, socle épinglé).

Publiez quand :

- un correctif touche les journaux installés : **le jour même** ;
- le socle a publié une version (correctif ou nouveautés) : épinglez-la
  (`node tools/maj-socle.mjs <sha>`) puis publiez ;
- des changements visibles s'accumulent depuis plus d'une semaine, ou un
  ensemble cohérent est prêt.

Pas besoin de publier pour des changements internes seulement (tests,
documentation, CI) : l'issue le dit.

## Numéro

- **correctif** (0.2.1 → 0.2.2) : rien ne change pour l'utilisateur, sauf ce qui était cassé ;
- **nouveautés** (0.2.2 → 0.3.0) : nouvel écran, nouveau réglage, nouveau socle avec nouveautés ;
- **changement majeur** (0.x → 1.0.0) : un journal installé doit faire une opération à la main (rare ; à annoncer).

## Liste de contrôle

1. **Socle à jour** : si le socle a une version plus récente, épinglez-la dans
   une PR (`node tools/maj-socle.mjs <sha complet>`, puis `rm -rf sauvegardes`).
2. **CI entièrement verte** sur `main` : les tâches « test » **et**
   « navigateur ».
3. **Captures avant/après** jointes aux PR qui changent ce que l'on voit
   (ordinateur et mobile, clair et sombre ; site Web et rédaction).
4. **Nouveautés rédigées** dans `CHANGELOG.md`, rubrique « Non publié », en
   français clair. Elles deviennent les nouveautés affichées sur la page
   Mise à jour des journaux.
5. **PR de version** : `npm version X.Y.Z --no-git-tag-version` et une ligne
   « Version X.Y.Z. » en tête de « Non publié » dans `CHANGELOG.md`. CI verte,
   fusion locale signée, comme toute PR.
6. **Bouton de publication** : onglet *Actions* → **Publier une version** →
   *Run workflow* → tapez le numéro (`0.2.2`). Le workflow refuse si « test »
   ou « navigateur » n'est pas vert sur `main`, si le numéro tapé n'est pas
   celui de `package.json`, si `CHANGELOG.md` ne le mentionne pas ou si
   l'étiquette existe déjà. Sinon, il pose l'étiquette `vX.Y.Z` et lance le
   workflow **Paquet complet**, qui joint `kiosque-journal.zip`.
7. **Vérification sans compte** :
   `curl -sIL https://github.com/azdak919/le-kiosque/releases/latest/download/kiosque-journal.zip`
   doit finir par `200` ; installez le ZIP sur une copie d'essai et testez la
   mise à jour en un clic depuis la version précédente. Ne touchez pas à un
   journal en service pour ce test.

L'issue « Prochaine version » se ferme toute seule quand tout est publié.

## À la main (si le bouton est indisponible)

```sh
git checkout main && git pull
git tag -a vX.Y.Z -m "Version X.Y.Z"
git push origin vX.Y.Z      # déclenche le workflow Paquet complet
```

Ne jamais déplacer ni supprimer une étiquette publiée : publiez plutôt la
version suivante.
