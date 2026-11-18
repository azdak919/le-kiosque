#!/usr/bin/env bash
# Prépare la mise à jour de la plateforme dans un journal créé avec
# « Use this template ».
#
# Un tel dépôt ne partage pas d'historique avec l'amont : `git merge` refuse
# (« unrelated histories »). On recopie donc, depuis l'amont, les dossiers et
# fichiers de la PLATEFORME, et jamais ceux du JOURNAL :
#   à vous : content/ media/ theme/ kiosque.config.ts kiosque-config.json
#            OWNERS.md RELEVE.md RESTAURATION.md AJOUTER-UN-ARTICLE.md
#            sauvegardes/ .github/
# `.github/` reste aussi à vous : GitHub interdit au jeton d'un workflow de
# modifier un workflow. Si l'amont en change un, le résumé le dit.
#
# Usage : tools/maj-plateforme.sh <ref-amont>   (ex. upstream/main)
# Sortie : « change=true|false » et « workflows=… » dans $GITHUB_OUTPUT.
set -euo pipefail
amont="$1"
sortie="${GITHUB_OUTPUT:-/dev/null}"
epingle() { grep -o 'azdak919/le-socle#[0-9a-f]\{40\}' "$1" | head -1 | cut -d'#' -f2 || true; }
avant=$(epingle package.json)
for chemin in $(git ls-tree --name-only "$amont"); do
  case "$chemin" in
    content|media|theme|kiosque.config.ts|kiosque-config.json|OWNERS.md|RELEVE.md|RESTAURATION.md|AJOUTER-UN-ARTICLE.md|sauvegardes|.github|.gitignore) continue ;;
  esac
  git rm -rq --ignore-unmatch -- "$chemin"
  git checkout "$amont" -- "$chemin"
done
# Le socle : si le journal a déjà une version plus récente que celle de
# l'amont (par « Mise à jour du socle »), on la garde.
apres=$(epingle package.json)
if [ -n "$avant" ] && [ -n "$apres" ] && [ "$avant" != "$apres" ]; then
  etat=$(gh api "repos/azdak919/le-socle/compare/${apres}...${avant}" --jq .status 2>/dev/null || echo inconnu)
  if [ "$etat" = ahead ]; then
    npm install --ignore-scripts --save-exact --no-audit --no-fund "le-socle@github:azdak919/le-socle#${avant}" >/dev/null
    git add package.json package-lock.json
  fi
fi
if git diff --cached --quiet; then echo "change=false" >> "$sortie"; else echo "change=true" >> "$sortie"; fi
workflows=$(git diff --name-only HEAD "$amont" -- .github/workflows | tr '\n' ' ')
echo "workflows=$workflows" >> "$sortie"
