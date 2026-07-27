# SUITE.md — ledger de livraison

## Dernière passe ciblée — Le Quorum (27 juillet 2026)

| État | Livrable |
|---|---|
| **DONE** | Mesures LE‑RADAR reprises sans modifier son dépôt : breakpoint `1100px`, largeur `1180px`, padding `32px`, grille `minmax(0, 1.15fr) minmax(300px, 370px)`, filets, « En bref », suite du fil et pied de page. Mesure `800px` conservée sous 1100px et repli 720px conservé. |
| **DONE** | Masthead compact, aligné à gauche par défaut, fond neutre en cas d'erreur, point focal appliqué à `object-position`, voile borné à 0–0,9 et contrat `MastheadOptions` dérivé de `Publication`. |
| **DONE** | Iframe radio inchangée dans son protocole et ses contrôles; hauteur initiale alignée à 62 px, surface sombre et station `chyz` conservée. |
| **DEMO ONLY** | Banque PGlite de six photos Wikimedia locales, recherche/filtres, sélection article/masthead et aperçus de recadrage ordinateur/tablette/mobile. Elle n'est pas copiée dans un build `git-sveltia`. |
| **DEMO ONLY** | Points focaux X/Y et cadres `object-fit: cover` dans l'administration locale. Ils simulent le recadrage sans produire de nouvelle image. |
| **DONE** | Table `media` alimentée au seed et incluse dans les snapshots, sauvegardes, restaurations et réinitialisations. L'upload local existant reste disponible. |
| **DONE** | Champs média et masthead déclarés dans la configuration CMS; tests anti-dérive, licences, dimensions, HTTPS, sommes et points focaux ajoutés. |
| **DONE** | GitHub Page publique déployée et contrôlée sur Chromium : grille 1180 px, point focal, crédit, six médias PGlite, radio `ready` à 62 px avec `chyz` et aucun débordement horizontal. |
| **NOT STARTED** | API distante, stockage distant, rôles d'autorisation, transformations d'images, DAM, installation automatisée et fédération LE‑RADAR. |
| **BLOCKED** | La fédération et l'installation automatisée restent bloquées tant que les API distantes, le stockage, l'authentification et leurs responsabilités d'exploitation ne sont pas définis. |

### Fichiers et composants de référence

Les mesures visuelles viennent de `style.css` dans LE‑RADAR, notamment ses
blocs bureau `@media (min-width: 1100px)`, `.news-list`, `.news-hero`,
`.brief-rail`, `.news-tail`, `.masthead-inner` et `.site-foot`. Aucun fichier de
LE‑RADAR n'a été modifié.

Les changements KIOSQUE se trouvent dans :

- `packages/core/src/{model,validate}.ts`;
- `packages/adapters/markdown/src/index.ts`;
- `packages/pipeline/src/{build,cli,cms-config,shared-media}.ts`;
- `packages/theme-radar/src/{templates,local-admin}.ts`;
- `packages/theme-radar/assets/{theme.css,kiosque.js}` et
  `packages/theme-radar/assets/editorial/{admin.css,admin.js,demo-backend.js,export.js,render.js}`;
- `examples/demo-journal/content/publication.yml`, son `kiosque.config.ts` et
  `media/demo-library/manifest.json`;
- `tools/build-site.mjs`, `tests/media-library.test.ts`,
  `tests/cms-config.test.ts`, `tests/editorial-backends.test.ts`,
  `tests/jalon-3.test.ts` et `tests/e2e/demo-local.spec.js`.

### Changer la photo du masthead

Dans `/admin/`, ouvrir **Configuration**, puis **Choisir dans la banque de
démonstration**. Ajuster X/Y dans les trois cadres et enregistrer. Une photo
personnelle peut toujours être ajoutée avec **Ajouter mes propres images**.
Dans le miroir Markdown, la même opération consiste à placer une entrée
`MediaAsset` dans `masthead.backgrounds.images` et son point focal dans
`focalPoint: { x, y }`.

### Manifeste et licences

`examples/demo-journal/media/demo-library/manifest.json` est la source
versionnée des métadonnées. Ces campus sont réels et illustrent uniquement la
démonstration; ils ne représentent pas l'établissement fictif Le Quorum.

- Khayman : quatre photos, CC BY‑SA 3.0;
- Pierre‑Paul Beaumont : campus de Québec du Cégep Limoilou, CC BY 2.0 Canada;
- Stéphane Voyer : Cégep de Rimouski, CC BY‑SA 2.5.

Les pages sources, liens de crédit, liens de licence, dimensions, points focaux
et sommes SHA‑256 sont conservés dans le manifeste.

### État responsive et radio

La grille bureau s'active à 1100px. Entre 721px et 1099px, le fil conserve sa
mesure de lecture de 800px et repasse sur une colonne; à 720px, les vedettes et
outils reprennent les replis mobiles existants. La barre radio reste cachée
jusqu'au message `radar-embed` `ready`, puis conserve le rendu sombre
`kiosque-v1` et la station configurée.

> **État au 27 juillet 2026 :** le jalon 3 décrit ci-dessous et le mode
> `demo-local` PGlite sont implémentés. Les 46 tests, le parcours Playwright
> Chromium et `npm run site` passent. `/admin/` est l’administration locale
> canonique; `/demo/admin/` demeure un alias. Les données restent dans IndexedDB
> et les builds `git-sveltia` ne contiennent aucun artefact PGlite.

> **Pour reprendre le travail, copie-colle ce prompt à ton agent :**
>
> ```
> Lis AGENTS.md puis SUITE.md à la racine de ce dépôt, et implémente le jalon 3
> dans l'ordre de priorité indiqué. Respecte les invariants. Lance npm test et le
> build avant de conclure.
> ```
>
> Rien d'autre n'est nécessaire. Tout le contexte est dans ces deux fichiers.

---

## Où en est le projet

| Jalon | Contenu | État |
|---|---|---|
| 1 | Noyau, adaptateur Markdown, thème, pipeline, test de continuité | **fait** |
| 2 | Sveltia CMS, statut éditorial strict, identifiants permanents | **fait** |
| **3** | **Vitrine, démonstration Le Quorum, configurateur** | **fait** |
| 4 | `doctor`, `adopt`, passation, `export` | à venir |
| 5 | Adaptateur WordPress/Newspack | à venir |
| 6 | Premier pilote avec une vraie équipe étudiante | à venir |

46 tests verts. Dépôt public : `github.com/azdak919/le-kiosque`.

---

## Le défaut bloquant à corriger en premier

**Les workflows sont dans `template/.github/workflows/`, pas à la racine.**

GitHub n'exécute que les workflows situés à la **racine** du dépôt. Conséquence :
le dépôt ne publie aucune page, et le modèle de fork décrit dans le README
n'existe pas encore réellement — ni publication automatique, ni pull request de
mise à jour de plateforme.

C'est la priorité absolue : rien d'autre n'est visible tant que ce n'est pas
réglé.

Note : `template/.github/workflows/*` doivent **rester où ils sont** — ce sont
ceux que les équipes obtiennent en clonant le gabarit, pas ceux de l'amont. Il
faut en ajouter à la racine, pas les déplacer.

---

## Objectif du jalon 3

Rendre le projet **démontrable en cinq minutes devant une classe, sans
terminal**. Trois parties cohérentes sur GitHub Pages :

```
https://azdak919.github.io/le-kiosque/
├── /                     présentation KIOSQUE          ← à créer
├── /demo/                Le Quorum, journal complet    ← build() existant
│   └── admin/            Sveltia (déjà émis par build)
├── /configurer/          assistant en 12 étapes        ← à créer
└── /assets/              tokens + theme (partagés)
```

Un seul `dist/`, un seul `basePath`. Un script `tools/build-site.mjs` orchestre :
il appelle `build()` avec `basePath = <base>/demo` pour Le Quorum, puis rend la
vitrine et le configurateur.

---

## Ordre de priorité — imposé

1. **préserver le build existant** (35 tests verts)
2. faire fonctionner Le Quorum sous GitHub Pages
3. créer la page publique de présentation
4. créer le configurateur avec prévisualisation locale
5. générer une configuration compatible avec le projet
6. documenter la procédure en cinq minutes
7. connecter l'administration existante
8. seulement ensuite, améliorer les détails visuels

---

## L3.1 — Déploiement

- **`.github/workflows/pages.yml`** à la racine : `npm ci` → `npm test` →
  `npm run site` → `actions/deploy-pages`.
- **`kiosque.config.ts` à la racine**, pointant sur `examples/demo-journal`,
  `basePath: '/le-kiosque'`.
- `basePath` **détecté à l'exécution** dans le configurateur (via
  `location.pathname`) pour qu'un fork renommé fonctionne sans rien changer.

Réutiliser `normalizeBasePath` / `withBase` (`packages/pipeline/src/config.ts`) —
déjà testés.

## L3.2 — Le Quorum, vraie démonstration

Passer de 3 à ~8 articles fictifs crédibles couvrant tous les cas :
standard, avec image, long, opinion, annonce, multi-auteurs, plus un brouillon
et un article en révision (qui **doivent rester invisibles** — déjà testé).

- 3 sections existent (Actualités, Culture, Opinion) ; ajouter Campus et Sports.
- Images : **SVG générés dans le dépôt**. Aucun binaire lourd, aucune photo
  réelle, aucun renseignement sensible.
- Le bandeau « démonstration » existe déjà via `demoNotice`.

**Contenu désactivable :** champ `demo: true` dans le front-matter →
`Article.isDemo` dans `model.ts` → `build` l'exclut quand
`config.demoContent === false`.

> ⚠ `tests/cms-config.test.ts` **échouera volontairement** tant que le champ
> `demo` n'est pas déclaré dans `packages/pipeline/src/cms-config.ts`. C'est le
> test anti-dérive qui fait son travail : déclare le champ, ne touche pas au test.

## L3.3 — Page publique KIOSQUE

Gabarit statique réutilisant `packages/theme-radar/assets/{tokens,theme}.css`.

Contenu exigé : nom + acronyme (*Kit d'Infrastructure Ouverte, Souveraine et de
Qualité pour les Usages Éditoriaux*), signature « Publier aujourd'hui.
Transmettre demain. », le problème (les journaux étudiants disparaissent avec
les cohortes), la proposition, le fonctionnement, la relation KIOSQUE ↔ LE
RADAR, le socle Markdown/Git, les backends futurs **présentés comme feuille de
route**, la barre radio facultative, et trois boutons : « Voir la
démonstration », « Configurer mon journal », dépôt GitHub.

**Mentions obligatoires, en clair :** KIOSQUE ne fournit pas l'hébergement ; le
projet est expérimental et développé avec des ressources limitées ;
l'accompagnement est bénévole et selon les disponibilités.

**Ne présente jamais comme disponible un service non construit.** Pas
d'hébergement gratuit, pas de sous-domaine à vie, pas de soutien permanent, pas
d'intégration non fonctionnelle.

## L3.4 — Configurateur

HTML + CSS + JS vanilla. Aucun framework, aucun backend, aucun jeton.

**12 étapes :** bienvenue → identité du journal → domaine et déploiement →
identité visuelle → structure éditoriale → articles de démonstration → barre
radio → utilisateurs initiaux → services externes → révision → génération →
terminé.

**Règles non négociables :**

- Préremplissage avec Le Quorum ; chaque valeur d'exemple **visiblement marquée
  comme fictive**.
- Domaines fictifs en **`.invalid` / `.example` uniquement**. Clés affichées
  `DEMO_ONLY_DO_NOT_USE`. Exemples : `journal-exemple.invalid`,
  `nom-utilisateur/le-journal`, `https://service.example`.
- **Jamais** de mot de passe, de jeton GitHub ni de secret — ni demandé, ni
  stocké, ni suggéré.
- `localStorage` seulement, avec un bouton « Effacer mes données » visible.
- Prévisualisation en direct des couleurs par variables CSS.
- Contrôle de contraste WCAG (luminance relative, ~20 lignes) qui **avertit sans
  bloquer**.
- Conseil : « Demandez à votre établissement s'il publie officiellement les
  normes et couleurs de son identité visuelle. » **Sans copier automatiquement**
  l'identité d'une institution.
- Étape 8 présentée comme **génération de configuration**, pas création de
  comptes : les accès réels passent par les collaborateurs GitHub.
- Recommander une adresse **institutionnelle** pour faciliter la passation.

**Génération (étape 11)** — produire les formats **déjà en place**, sans créer
un second système de configuration : `kiosque.config.ts`,
`content/publication.yml`, `content/sections/*.yml`, `content/taxonomies.yml`,
`theme/tokens.css`. Voir `packages/pipeline/src/cms-config.ts` pour le format.

Offrir : copie presse-papiers, téléchargement fichier par fichier, archive `.zip`
assemblée en JS (méthode STORE, sans compression — ~60 lignes, aucune
dépendance), instructions exactes, liens `github.dev` et « ajouter un fichier ».

**Étape 12** — si `cms.authBaseUrl` est absent, **ne pas afficher de lien
d'admin qui semble fonctionner** : afficher l'étape exacte qui reste à faire.

## L3.5 — Barre radio LE RADAR

`<radar-tuner>` : iframe différée vers `https://le-radar.ca/tuner-embed.html`,
écoute du protocole de hauteur `radar-embed` déjà émis par `embed.js`. Activée
par défaut, désactivable.

```ts
radio?: { enabled?: boolean; station?: string; theme?: 'auto'|'light'|'dark'; position?: 'top'|'bottom' }
```

> **Deux limites réelles, à documenter honnêtement plutôt qu'à masquer :**
> `tuner-embed.html` **n'accepte pas encore** `?station=` (prévu plus tard), et
> la synchronisation de thème est verrouillée en même origine dans `embed.js` —
> elle ne fonctionnera donc pas depuis un journal tiers. On émet les paramètres ;
> ils seront honorés quand LE RADAR les acceptera.
>
> **Aucune modification du dépôt `le-radar` dans ce jalon.**

## L3.6 — Documentation

`docs/installation.md` : installation rapide, activation de GitHub Pages,
activation des Actions dans un fork, premiers administrateurs, publication du
premier article, désactivation du contenu de démonstration, ajout/retrait de la
barre radio, domaine personnalisé, sauvegarde, restauration, passation, limites
actuelles, différence KIOSQUE / LE RADAR.

**`docs/demonstration-5-minutes.md`** : les actions exactes, dans l'ordre, texte
minimal.

Recommander **« Use this template »** comme méthode principale (un fork désactive
les Actions par défaut et impose un clic de plus), le fork restant documenté.

**Nommer les limites réelles de GitHub sans les enjoliver :** les Actions doivent
être activées à la main dans un fork ; Pages demande une étape dans les
paramètres ; une page statique ne peut pas écrire dans un dépôt sans
authentification ; le délai de déploiement est incompressible.

---

## Scénario visé

1. J'arrive en classe et j'ouvre mon ordinateur.
2. Je présente le projet en une minute.
3. Une personne crée un compte GitHub gratuit.
4. Elle crée son dépôt avec « Use this template ».
5. Elle ouvre la page GitHub Pages de son installation.
6. Elle suit l'assistant, prérempli avec Le Quorum.
7. Elle change le nom et les couleurs, voit la prévisualisation bouger.
8. Elle termine et obtient : son front end, son admin, les fichiers à
   enregistrer, les prochaines étapes.

Cinq minutes, sans terminal.

---

## Critères d'acceptation

1. la page publique KIOSQUE fonctionne
2. Le Quorum est consultable comme démonstration réelle
3. le configurateur est accessible depuis la page publique
4. les données du Quorum préremplissent le configurateur
5. on peut modifier le nom et les couleurs
6. la prévisualisation se met à jour
7. la barre radio est activée par défaut et désactivable
8. les articles d'exemple sont activés par défaut et désactivables
9. les utilisateurs et rôles se configurent **sans mot de passe**
10. aucune valeur fictive n'est présentée comme réelle
11. la fin du parcours présente front end, admin et prochaines étapes
12. les fichiers de configuration s'exportent
13. le site fonctionne avec `basePath`
14. le build de production réussit
15. les 35 tests existants réussissent toujours
16. aucun secret ni renseignement sensible ajouté
17. la démonstration en cinq minutes est documentée

---

## Vérification

```bash
npm test                      # 35 + nouveaux, doivent rester verts
npm run site                  # produit dist/ complet
python3 -m http.server --directory dist 8080
```

**Le piège le plus coûteux — le `basePath` :**
```bash
BASE=/le-kiosque npm run site
grep -rohE '(href|src)="/[^"]*"' dist/index.html dist/demo/index.html dist/configurer/index.html \
  | grep -v '"/le-kiosque'     # doit être vide
```
Rejouer avec `BASE=/autre-nom` pour prouver qu'un fork renommé fonctionne.

**À ouvrir :** `/` · `/demo/` · `/demo/articles/<slug>/` ·
`/demo/auteurs/marie-tremblay/` · `/demo/sections/actualites/` ·
`/demo/feed.xml` · `/configurer/`

**Responsive et clavier :** `/`, `/demo/` et `/configurer/` en 360, 768 et
1440 px ; navigation au clavier seul dans le configurateur, sans piège.

**Honnêteté :** aucun brouillon dans `dist/demo/**`, aucun domaine fictif en
`.ca`/`.com`, aucune valeur d'exemple présentée comme réelle.

---

## Hors périmètre

CMS propriétaire · hébergement · OAuth maison · adaptateurs WordPress, Ghost,
Drupal, Superdesk · gestion d'organisations · facturation · moteur de
déploiement externe · modification du dépôt `le-radar` · réécriture du dépôt ·
renommage des identifiants internes.

Préparer les points d'extension, mais livrer d'abord un MVP fonctionnel.

## Action distante à faire confirmer

Marquer le dépôt comme *template* GitHub (`gh repo edit --template`) pour
activer « Use this template ». Réversible et bénin, mais c'est une modification
d'un dépôt public : demander avant.
