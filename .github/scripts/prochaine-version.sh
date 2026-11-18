#!/usr/bin/env bash
# Tient à jour l'issue « Prochaine version » : ce qui est fusionné dans main
# depuis la dernière étiquette vX.Y.Z, et un avis quand des changements
# visibles (rédaction, site Web, paquet) attendent d'être publiés.
# Variables : GH_TOKEN, GITHUB_REPOSITORY, VISIBLES (chemins séparés par des espaces).
set -euo pipefail
repo="$GITHUB_REPOSITORY"
label="prochaine-version"
last=$(git describe --tags --abbrev=0 --match 'v[0-9]*' 2>/dev/null || true)
range="${last:+$last..}HEAD"
version=$(node -p "require('./package.json').version")
since=${last:-"(aucune étiquette)"}

# PR fusionnées : commits de fusion « Fusion de <branche> : <titre> (#N) » sur main.
git log --first-parent --merges --format='%cs%x09%s' "$range" \
  | sed -n 's/^\([0-9-]*\)\tFusion de [^:]* : \(.*\) (#\([0-9]*\))$/- #\3 \2 (fusionnée le \1)/p' > prs.txt || true
count=$(wc -l < prs.txt | tr -d ' ')
# shellcheck disable=SC2086
visibles=$(git diff --name-only "$range" -- $VISIBLES | wc -l | tr -d ' ')
oldest=$(git log --first-parent --merges --reverse --format='%cs' "$range" | head -1)

gh label create "$label" --repo "$repo" --color FBCA04 --description "Changements fusionnés, pas encore publiés" >/dev/null 2>&1 || true
issue=$(gh issue list --repo "$repo" --label "$label" --state open --json number --jq '.[0].number // empty')

if [ "$count" = "0" ]; then
  echo "Rien à publier : tout ce qui est dans main est dans $since." >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  if [ -n "$issue" ]; then
    gh issue close "$issue" --repo "$repo" --comment "Tout est publié dans $since. Cette issue se rouvrira (nouvelle issue) à la prochaine PR fusionnée."
  fi
  exit 0
fi

{
  echo "Cette issue se met à jour toute seule à chaque fusion dans \`main\` (workflow « Prochaine version »). Ne la modifiez pas à la main."
  echo
  echo "**Dernière version publiée :** $since · **version dans package.json :** $version"
  echo
  if [ "$visibles" != "0" ]; then
    echo "> [!WARNING]"
    echo "> **Des changements visibles attendent une version** ($visibles fichier(s) de la rédaction, du site Web ou du paquet modifiés depuis $since, première fusion en attente le $oldest). Les journaux installés ne les recevront qu'à la publication."
  else
    echo "> [!NOTE]"
    echo "> Seulement des changements internes (tests, documentation, CI) : publier n'est pas urgent."
  fi
  echo
  echo "## PR fusionnées depuis $since ($count)"
  echo
  cat prs.txt
  echo
  echo "## Pour publier"
  echo
  echo "Suivez [RELEASING.md](https://github.com/$repo/blob/main/RELEASING.md) :"
  echo
  echo "- [ ] CI entièrement verte sur \`main\` (toutes les tâches)"
  echo "- [ ] Captures avant/après jointes aux PR visibles"
  echo "- [ ] Nouveautés rédigées en français clair dans CHANGELOG.md"
  echo "- [ ] PR de version fusionnée (package.json + « Version X.Y.Z » dans CHANGELOG.md)"
  echo "- [ ] Actions → **Publier une version** → *Run workflow* (taper le numéro)"
  echo "- [ ] Téléchargement vérifié sans compte (adresse fixe de la Release)"
} > corps.md

cat corps.md >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
title="Prochaine version : $count changement(s) non publié(s) depuis $since"
if [ -n "$issue" ]; then
  gh issue edit "$issue" --repo "$repo" --title "$title" --body-file corps.md >/dev/null
else
  gh issue create --repo "$repo" --title "$title" --label "$label" --body-file corps.md >/dev/null
fi
