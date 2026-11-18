#!/usr/bin/env bash
# Publie la version de package.json : contrôles, étiquette vX.Y.Z, puis lance
# le workflow qui fabrique la Release (une étiquette poussée par le jeton
# d'Actions ne déclenche pas d'autre workflow, d'où l'appel explicite).
# Variables : GH_TOKEN, GITHUB_REPOSITORY, TAPEE (numéro tapé), REQUIS (tâches CI obligatoires), RELEASE_WORKFLOW.
set -euo pipefail
repo="$GITHUB_REPOSITORY"
version=$(node -p "require('./package.json').version")
tag="v$version"
erreur() { echo "::error::$1"; echo "**Rien n'a été publié :** $1" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"; exit 1; }

git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse FETCH_HEAD)" ] || erreur "lancez ce workflow sur la branche main, à jour."
[ "$TAPEE" = "$version" ] || erreur "vous avez tapé « $TAPEE » mais package.json dit $version. Fusionnez d'abord la PR de version, puis tapez ce numéro."
if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then erreur "l'étiquette $tag existe déjà : cette version est publiée."; fi
grep -q "Version $version" CHANGELOG.md || erreur "CHANGELOG.md ne contient pas « Version $version » : rédigez les nouveautés."

sha=$(git rev-parse HEAD)
gh api "repos/$repo/commits/$sha/check-runs?per_page=100" \
  --jq '.check_runs[] | [.name, .status, (.conclusion // "")] | @tsv' > checks.tsv
for requis in $REQUIS; do
  ligne=$(awk -F'\t' -v n="$requis" '$1 == n' checks.tsv | head -1)
  [ -n "$ligne" ] || erreur "la vérification « $requis » n'a pas tourné sur $sha."
  echo "$ligne" | grep -qP '\tcompleted\tsuccess$' || erreur "la vérification « $requis » n'est pas verte sur $sha ($ligne)."
done
if awk -F'\t' '$2 == "completed" && $3 != "success" && $3 != "skipped" && $3 != "neutral"' checks.tsv | grep -q .; then
  erreur "une vérification a échoué sur $sha : $(awk -F'\t' '$2 == "completed" && $3 != "success" && $3 != "skipped" && $3 != "neutral" {print $1}' checks.tsv | tr '\n' ' ')"
fi

git config user.name "Azdak"
git config user.email "azdak-qc@proton.me"
git tag -a "$tag" -m "Version $version"
git push origin "$tag"
gh workflow run "$RELEASE_WORKFLOW" --repo "$repo" --ref main -f tag="$tag"
{
  echo "Étiquette **$tag** posée sur $sha ; le workflow « $RELEASE_WORKFLOW » fabrique la Release."
  echo
  echo "Vérifiez ensuite : https://github.com/$repo/releases/tag/$tag"
} >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
