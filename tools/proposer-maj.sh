#!/usr/bin/env bash
# Propose une branche de mise à jour, sans réglage obscur.
# Usage : tools/proposer-maj.sh <branche> <titre> <fichier-corps>
#
# 1. Essaie d'ouvrir la pull request.
# 2. Si GitHub l'interdit (réglage par défaut : « Allow GitHub Actions to
#    create and approve pull requests » décoché), ouvre une issue avec le lien
#    tout prêt : un clic sur « Create pull request », puis « Merge ».
# Le lien est aussi écrit dans le résumé du workflow.
set -euo pipefail
branche="$1"; titre="$2"; corps="$3"
lien="https://github.com/${REPO}/compare/main...${branche}?expand=1"
# --repo : le dépôt du journal, jamais « upstream » (l'amont, ajouté par la
# mise à jour de la plateforme), où le jeton du workflow ne peut rien créer.
if gh pr create --repo "$REPO" --base main --head "$branche" --title "$titre" --body-file "$corps" 2>erreur.txt; then
  echo "Pull request ouverte." | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
  exit 0
fi
cat erreur.txt
if grep -qi "already exists" erreur.txt; then echo "Une pull request est déjà ouverte."; exit 0; fi
{
  echo "### $titre"
  echo
  echo "**Pour l'appliquer : [ouvrir la proposition]($lien)**, cliquer « Create pull request », puis « Merge pull request »."
  echo
  cat "$corps"
  echo
  echo "_GitHub ne laisse pas les workflows ouvrir eux-mêmes une pull request (réglage par défaut). Le lien ci-dessus fait la même chose en un clic._"
} > issue.md
cat issue.md >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
gh issue create --repo "$REPO" --title "$titre — disponible" --body-file issue.md || echo "::warning::Ouvrez la proposition : $lien"
