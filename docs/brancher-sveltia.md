# Brancher l'interface de rédaction

Sveltia CMS donne à votre équipe une interface pour écrire, sans Git ni
terminal. Ce guide explique comment la mettre en service.

---

## D'abord, la chose importante

**L'interface d'édition est une commodité. Le journal n'en dépend pas.**

| Si ça tombe | Conséquence |
|---|---|
| Le Worker d'authentification | On ne peut plus se connecter à `/admin`. **Le site publié reste entier.** |
| Sveltia CMS lui-même | Idem. On peut toujours écrire en Markdown et publier. |
| GitHub | Plus de déploiement automatique. Le site déjà publié continue de répondre. |

Rien de ce qui suit ne peut faire disparaître un article. C'est la raison pour
laquelle `content/` est du Markdown dans Git, et pas une base de données.

---

## Essayer en cinq minutes, sans rien déployer

Avant de configurer quoi que ce soit, on peut voir l'interface tourner.

```bash
node packages/pipeline/src/cli.ts build
python3 -m http.server 8080 --directory dist
```

Ouvrir <http://localhost:8080/admin/>. Sveltia propose alors de travailler sur
un dossier local : il lit et écrit directement dans votre `content/`, sans
GitHub ni authentification.

C'est le meilleur moyen de montrer l'outil à une équipe avant de s'engager.
*(Nécessite un navigateur récent basé sur Chromium — l'API d'accès au système
de fichiers n'existe pas partout.)*

---

## Mise en service — trois étapes

Sveltia tourne entièrement dans le navigateur. Il ne peut donc pas détenir le
secret OAuth de GitHub : il faut un petit intermédiaire côté serveur. C'est le
seul composant à déployer, et il est gratuit.

### 1. Déployer le Worker d'authentification

[`sveltia-cms-auth`](https://github.com/sveltia/sveltia-cms-auth) — un Worker
Cloudflare, sur l'offre gratuite.

1. Se connecter au tableau de bord Cloudflare.
2. Déployer le Worker depuis le dépôt ci-dessus.
3. Noter son URL : `https://sveltia-cms-auth.<votre-compte>.workers.dev`.

> **Sous quel compte ?** Pas celui d'une personne. Un compte de l'association
> étudiante ou de l'organisation, avec au moins deux personnes qui peuvent y
> accéder. Sinon on recrée exactement le problème que ce projet combat — et il
> faudra le noter dans [`OWNERS.md`](../template/OWNERS.md).

### 2. Enregistrer l'application OAuth GitHub

Dans GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App** :

| Champ | Valeur |
|---|---|
| Application name | Rédaction — *nom du journal* |
| Homepage URL | l'adresse de votre site |
| Authorization callback URL | **l'URL du Worker** (étape 1) |

Générer un client secret, puis reporter les deux valeurs dans les variables
d'environnement du Worker (Cloudflare → Settings → Variables) :

```
GITHUB_CLIENT_ID       = …
GITHUB_CLIENT_SECRET   = …
ALLOWED_DOMAINS        = votre-domaine.ca
```

`ALLOWED_DOMAINS` n'est pas facultatif : sans lui, n'importe quel site pourrait
se servir de votre Worker pour demander des jetons GitHub en votre nom.

**Le secret ne doit exister qu'à deux endroits :** chez GitHub et dans les
variables du Worker. Jamais dans le dépôt, jamais dans un courriel, jamais dans
`kiosque.config.ts`.

### 3. Déclarer le Worker dans la configuration

```ts
// kiosque.config.ts
cms: {
  authBaseUrl: 'https://sveltia-cms-auth.votre-compte.workers.dev',
  branch: 'main',
}
```

Puis reconstruire. `admin/config.yml` est **régénéré à chaque build** depuis le
modèle et le contenu — ne le modifiez jamais à la main, il serait écrasé.

---

## Donner accès à quelqu'un

L'autorisation vient des **droits GitHub sur le dépôt**, pas d'une liste dans le
CMS. Pour qu'une personne puisse publier : l'ajouter comme collaboratrice du
dépôt (droit *Write*).

Au départ de quelqu'un, retirer son accès. Ce n'est pas un manque de confiance :
un compte oublié est un compte qui finira par être compromis. À faire à chaque
passation — c'est dans [`RELEVE.md`](../template/RELEVE.md).

---

## Quand ça ne marche pas

**« Authentication failed » / la fenêtre se ferme aussitôt**
L'URL de rappel de l'application OAuth ne correspond pas exactement à celle du
Worker. Comparer caractère par caractère, barre oblique finale comprise.

**« Failed to fetch » à la connexion**
`ALLOWED_DOMAINS` ne contient pas le domaine depuis lequel vous ouvrez `/admin`.

**Le CMS charge mais ne montre aucun article**
`backend.repo` dans `admin/config.yml` ne pointe pas sur le bon dépôt. Il est
déduit de `governance.repo` dans `content/publication.yml` — corriger là, puis
reconstruire.

**Une image téléversée ne s'affiche pas sur le site**
Vérifier `basePath` dans `kiosque.config.ts`. Sur un fork servi dans un
sous-dossier, il doit valoir `/nom-du-depot`.

**L'interface ne démarre pas du tout**
Le journal publié n'est pas touché — il reste en ligne et complet. En attendant,
on peut publier en écrivant du Markdown : voir
[`AJOUTER-UN-ARTICLE.md`](../template/AJOUTER-UN-ARTICLE.md).

---

## Mettre à jour Sveltia

Le script du CMS est **figé dans le dépôt** (`packages/theme-radar/assets/admin/`),
pas chargé depuis un CDN. Une version épinglée ne peut pas casser du jour au
lendemain, et l'interface fonctionne même si le CDN disparaît.

```bash
node tools/vendor-cms.mjs          # dernière version
node tools/vendor-cms.mjs 0.173.0  # version précise
```

La version en service est inscrite dans `admin/VERSION.txt`. Les mises à jour
arrivent normalement par la pull request de plateforme — vous n'avez rien à
faire.

---

## Ce qui n'existe pas encore

**La révision par pull request** (l'*editorial workflow* de Decap) n'est pas
implémentée dans Sveltia. Elle est annoncée avant la version 1.0.

En attendant, la révision passe par le **champ « Statut »** de chaque article :
Brouillon → En révision → Publié. Seul « Publié » apparaît sur le site. Le
parcours complet est décrit dans
[`AJOUTER-UN-ARTICLE.md`](../template/AJOUTER-UN-ARTICLE.md).

C'est plus simple à comprendre pour une rédaction non technique, mais il faut
en connaître la limite : **c'est une convention d'équipe, pas une barrière
technique.** Toute personne ayant accès en écriture au dépôt peut publier. Si
vous avez besoin d'un vrai contrôle, la protection de branche GitHub reste
possible — au prix d'une étape technique à chaque publication.
