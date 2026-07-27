# Qui détient quoi

> **Ce fichier est le plus important du dépôt.** Le code se réécrit ; un domaine
> perdu ne revient pas. À relire et corriger **à chaque passation**.

Dernière vérification : `AAAA-MM-JJ` — par : `nom`

---

## La règle en une phrase

**Aucune ressource critique ne doit dépendre d'une seule personne, ni d'un
compte qui disparaît à la graduation.**

---

## Ressources critiques

| Ressource | Détenteur | Compte / entité | Échéance | Qui peut récupérer |
|---|---|---|---|---|
| Nom de domaine | | registraire : | **AAAA-MM-JJ** | (2 personnes min.) |
| Dépôt Git | | organisation : | — | |
| Hébergement | | | | |
| Courriel d'administration | | | | |
| CMS (si utilisé) | | | | |
| Comptes réseaux sociaux | | | | |

> ⚠ **L'échéance du domaine est la ligne la plus importante du tableau.**
> Mettez un rappel de calendrier **trois mois avant**, sur un calendrier
> partagé — pas sur celui d'une personne.

---

## Entité permanente

L'organisme qui survit aux cohortes et qui peut récupérer les accès quand plus
personne n'est là. Association étudiante, coopérative, OBNL, ou service de la
vie étudiante.

- **Nom :**
- **Contact :**
- **Ce qu'elle détient :**

Sans entité permanente, ce journal a une espérance de vie de deux ans.

---

## Secrets et jetons

**Aucun secret ne doit figurer dans ce fichier ni nulle part dans le dépôt.**
On note seulement *où* ils se trouvent et *qui* peut les régénérer.

| Secret | Où il vit | Qui peut le régénérer | Dernière rotation |
|---|---|---|---|
| `GITHUB_TOKEN` | fourni par GitHub Actions | — | automatique |
| | | | |

**Rotation :** à chaque passation, et immédiatement au départ de toute personne
qui avait un accès en écriture.

---

## Personnes ayant un accès en écriture

| Nom | Rôle | Cohorte | Accès | À retirer le |
|---|---|---|---|---|
| | | | | |

Retirez les accès des personnes qui ont quitté. Ce n'est pas un manque de
confiance : un compte oublié est un compte qui finira par être compromis.

---

## Modifications locales de la plateforme

Si vous avez modifié un fichier appartenant à la plateforme (`packages/`,
`tools/`, `.github/workflows/`), notez-le ici. Sans cette note, la personne qui
reprendra ne comprendra pas pourquoi les mises à jour créent des conflits.

| Fichier | Pourquoi | Date |
|---|---|---|
| | | |
