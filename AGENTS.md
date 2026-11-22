# AGENTS.md — à lire en premier

> Ce fichier s'adresse aux agents (Claude, Codex, Grok, Cursor…) et aux
> personnes qui reprennent le projet. Lis-le en entier avant de toucher au code :
> il contient des contraintes qui ne se devinent pas et des pièges déjà payés.
>
> **`AGENTS.md` est le registre et la source de vérité uniques du projet.**
> [`SUITE.md`](SUITE.md) est conservé uniquement comme pointeur historique : il
> ne porte aucune décision, dette ou état de livraison.

---


## ⛔ RÈGLE DURE — branche + tests avant `main`

Voir la source de vérité multi-outils :
[`../GIT-AND-TEST-SAFETY.md`](../GIT-AND-TEST-SAFETY.md) (depuis un dépôt sous `VisualCode/`)
ou `VisualCode/GIT-AND-TEST-SAFETY.md`.

**Interdit** : commit/push non testé sur `main`.  
**Obligatoire** : branche `fix|feat|chore/...` → tests locaux verts → push → **PR** →
checks CI verts (`test`) → **merge + delete branch**.  
**Fusion en local** : `git merge --no-ff` (ou squash local) signé `Azdak <azdak-qc@proton.me>` avec `Signed-off-by`, simple push de `main` (jamais de force push), puis suppression de la branche. Pas de fusion sur le site de GitHub : elle remplacerait l’auteur.  
**Push ≠ livré** : avertir l’humain si la clôture n’est pas encore faite.  
**LE-RADAR UI/CSS** : `npm run check` + Playwright (au minimum mât/smoke) avant push.
**Worktree** : ne jamais versionner `node_modules`, même comme lien vers un autre clone. Relire `git status` avant `git add -A`.

### Photos = crédit photographe (comme les articles ont des signatures)

- **Lead** : `lead.credit` (recommandé, et affiché `Photo : …` sous l’image).
- **Corps** (`<figure class="post-figure">` ou `![…](…)` ) : la **légende doit
  nommer qui a pris la photo** — ex.  
  `<figcaption>Photo : Prénom Nom — contexte optionnel.</figcaption>`  
  Même règle pour la banque démo (`manifest.json` / `seed-demo-photos.mjs`) :
  ne jamais ajouter une image sans `credit`.
- Alt descriptif ≠ crédit : l’un dit *ce qu’on voit*, l’autre *qui a capté*.

## Le projet en trois phrases

**LE KIOSQUE** est une plateforme libre pour les journaux étudiants. Il existe parce
qu'un journal étudiant meurt rarement par manque de talent : il meurt quand le
domaine expire, que le compte d'administration appartient à quelqu'un qui a
gradué, et que dix ans d'archives partent avec.

Tout le projet découle d'un seul objectif : **survivre à ses fondateurs**.

**LE-RADAR** (`github.com/azdak919/le-radar`, dépôt séparé) est l'agrégateur et
le réseau de découverte des médias étudiants. **LE KIOSQUE** est le kit qui
permet d'en créer un. Ne confonds pas les deux : un journal sous KIOSQUE reste
propriétaire de son domaine, de son hébergement et de ses contenus. **KIOSQUE
n'héberge rien.**

---

## Le principe d'architecture central

> **La génération du site ne parle JAMAIS au CMS.**
> Seule l'étape `sync` le fait. Le CMS alimente un miroir portable dans Git ; le
> site se construit *uniquement* depuis ce miroir.

```
CMS au choix ──sync──► content/*.md + media/ ──build──► site statique
(peut mourir)          (l'archive, dans Git)           (ne meurt pas)
```

Un backend qui meurt casse l'écriture, **jamais** la lecture.

**Si tu te surprends à vouloir appeler une API depuis `build`, arrête-toi.**
C'est le signe que l'architecture est en train d'être contournée, et avec elle
la seule garantie qui compte. `packages/pipeline/src/build.ts` n'importe aucun
adaptateur : c'est vérifié par un test. L'adaptateur `socle` est un client HTTP
chargé par `sync` seulement si `kiosque.config.ts` le demande. Le serveur n'est
pas dans ce dépôt.

---

## Commandes

```bash
npm test                    # tests unitaires — doit rester vert
npm run test:navigateur     # parcours Chromium de la démo (sql.js) sous un basePath renommé
npm run test:continuity     # le test décisif du projet (voir plus bas)
npm run typecheck           # tsc --noEmit (typage seul, aucune compilation)

node packages/pipeline/src/cli.ts sync   --root examples/demo-journal
node packages/pipeline/src/cli.ts build  --root examples/demo-journal
node packages/pipeline/src/cli.ts verify --root examples/demo-journal
node packages/pipeline/src/cli.ts cms:config --root examples/demo-journal

node tools/vendor-cms.mjs   # fige Sveltia CMS dans le dépôt
npm run radar:reference:check -- --from=../le-radar  # revue du port éditorial
```

Si un serveur local occupe `4173`, choisir un port libre sans l’interrompre :
`PLAYWRIGHT_PORT=43818 npm run test:navigateur`.

Node **≥ 22.18** exécute le TypeScript directement. Il n'y a **aucune étape de
compilation** et il ne doit pas y en avoir.

---

## Contraintes non négociables

**Syntaxe TypeScript « effaçable » uniquement.** Node retire les types, il ne
compile pas. Donc : pas d'`enum`, pas de `namespace`, pas de propriétés de
paramètre (`constructor(private x)`). Utilise des types union et des `const`
objects. *Un fichier qui viole ça plante au chargement, pas au build.*

**Trois dépendances de production, `yaml`, `marked` et `le-socle`.** `le-socle` est épinglé sur un commit précis (`github:azdak919/le-socle#<sha>`) : c'est lui qui fournit l'admin de rédaction. Playwright
est une dépendance de développement verrouillée, qui ne sert qu’aux tests. La base
de la démo (sql.js, MIT) arrive avec l’admin du socle et n’est copiée que dans une
sortie `demo-local`. PGlite (Apache-2.0, incompatible avec la GPL-2.0-only en vigueur à l’époque) est retiré :
ne pas le remettre. N'en ajoute pas sans
raison forte. Chaque dépendance est une dette de survie : le projet doit se
reconstruire dans dix ans.

**L'admin de rédaction se développe dans le socle, pas ici.** Les écrans
(articles, photos, auteurs, rubriques, configuration), le client
`/v1/redaction/`, la démo en mode navigateur (`demo-backend.js`, `runtime.js`, `sqljs-db.js`, sql.js) et leur
feuille vivent dans `le-socle/admin/`. Le build les copie dans
`assets/editorial/`. Pour les changer : une pull request dans le socle, puis
mettre à jour le commit épinglé dans `package.json` (`npm install
le-socle@github:azdak919/le-socle#<sha>`). Ne jamais recopier ces fichiers dans
le Kiosque.

**La sortie est du HTML/CSS/JS statique pur.** Elle doit se servir depuis
n'importe quoi, y compris une clé USB. Pas de framework, pas de bundler.

**Le site publié doit rester lisible sans JavaScript.** Le seul script du thème
ajoute le bouton clair/sombre et le défilement des titres — jamais du contenu.

---

## Invariants à ne jamais casser

Chacun est couvert par un test. Si tu en casses un, le test échoue — répare la
cause, ne désactive pas le test.

| Invariant | Où | Pourquoi |
|---|---|---|
| **Anti-site-vide** | `build.ts` → `guardAgainstEmptying` | `build` refuse de publier moins d'articles que le miroir, sauf `--allow-deletions`. Empêche qu'un jeton expiré ou une API qui répond « 0 article » efface dix ans d'archives. |
| **Brouillons invisibles** | `model.ts` → `isListed` / `hasPublicPage` | Un article non publié n'apparaît **nulle part** : ni fil, ni section, ni auteur, ni RSS, ni sitemap, ni JSON-LD — et **aucune page** n'est émise à son URL. |
| **Identifiants permanents** | `frontmatter.ts` → `freezeId` | L'`id` d'un article est inscrit dans le front-matter et ne change plus jamais. Sans lui, renommer un fichier crée un doublon. |
| **`basePath`** | `config.ts` → `normalizeBasePath` | Un fork est servi sur `<org>.github.io/<depot>/`. Tout chemin racine non préfixé casse le site. |
| **Miroir d’un backend distant** | `mirror-write.ts` → `writeRemoteMirror` | Pour un backend autre que Markdown, `sync` écrit `content/` en Markdown, chaque fichier marqué `miroir: <backend>`. Une synchronisation complète ne retire que les fichiers marqués de ce backend ; un fichier écrit à la main reste. Test : `tests/miroir-distant.test.ts` (aller-retour sur la démo). |
| **Miroir portable** | `content/` + `media/` | `npm ci && kiosque build` doit reconstruire le site **sans aucun secret, compte ni CMS**. C'est la propriété qui fait vivre un journal au-delà de ses fondateurs. |

**Deux notions de visibilité, à ne pas confondre :**
- `isListed()` → apparaît dans les listes. **`published` seul.**
- `hasPublicPage()` → garde une page à son URL. **`published` + `archived`.**

Un article archivé quitte le fil mais garde son adresse : le retirer ferait 404
chaque lien partagé vers lui.

---

## Carte du dépôt

```
packages/
  core/               modèle commun + contrats — ZÉRO dépendance, zéro réseau
    model.ts          Article, Author, Publication, Section, MediaAsset…
    source.ts         l'interface ContentSource (la seule frontière réseau)
    editorial.ts      EditorialBackend, distinct de ContentSource
    editorial-backends.ts  Git/Markdown + point d’extension PocketBase
    validate.ts       ce qui entre dans le miroir est valide
    testkit.ts        suite de conformité que tout adaptateur doit passer
  adapters/
    markdown/         adaptateur de référence (le miroir EST le backend)
      frontmatter.ts  lecture YAML + écriture par INSERTION TEXTUELLE
    socle/            client HTTP vers le-socle, éteint dans le gabarit
    wordpress/        squelette non fonctionnel (jalon 5)
  pipeline/
    sync.ts           parle au CMS · fige les id · écrit le miroir
    build.ts          NE PARLE À RIEN · lit le miroir · produit dist/
    cms-config.ts     génère admin/config.yml DEPUIS le modèle
    sanitize.ts       liste blanche HTML (le CMS tiers n'est pas de confiance)
    mirror.ts         miroir, empreintes sha256, intégrité
    cli.ts            sync · build · verify · cms:config
  theme-radar/        identité éditoriale reprise de LE-RADAR
    assets/tokens.css  ← le SEUL fichier qu'une équipe modifie
    src/templates.ts   gabarits (fonctions pures : modèle → HTML)
    src/source-view.js noyau de carte partagé build statique + démo navigateur
    LE-RADAR-SOURCE-VIEW.json  révision de référence et adaptations admises
    src/admin.ts       page /admin
    assets/admin/      Sveltia CMS figé (2 Mo, MIT)
    assets/editorial/  rendu de la démo (front.js, render.js) ; l'admin vient du socle
    src/local-admin.ts branche l'admin du socle (`le-socle/admin/`) sur le build
template/             ce que les équipes clonent
examples/demo-journal/  Le Quorum — journal de démonstration
tools/vendor-cms.mjs  fige Sveltia dans le dépôt
tests/                41 tests + parcours navigateur Playwright
```

---

## Pièges déjà payés — ne les repaie pas

**Octet NUL littéral dans une source.** `derivedId` utilise `\0` comme
séparateur. Écrit en octet brut, il faisait voir le fichier comme **binaire** par
git (diffs et revues cassés). Toujours l'échappement `\0`, jamais le caractère.

**Re-sérialisation YAML destructrice.** `freezeId` analyse le YAML pour savoir si
la clé existe, mais **écrit par insertion textuelle**. Une re-sérialisation, même
via l'API `Document` de `yaml`, normalise le repli des blocs, l'espacement des
collections (`[a]` → `[ a ]`) et déplace les commentaires. Le diff se remplirait
de reformatage et les commentaires pédagogiques du gabarit disparaîtraient.

**Champs non déclarés dans la config CMS.** Les CMS de la famille Decap
re-sérialisent l'entrée depuis les champs déclarés : une clé de front-matter
absente de `cms-config.ts` risque d'être **supprimée** à la première sauvegarde
— à commencer par l'`id`. `tests/cms-config.test.ts` échoue si un champ du
modèle n'est pas déclaré. C'est voulu. **Ajoute le champ, ne touche pas au test.**

**`pkill -f` qui se tue lui-même.** Le motif matche la propre ligne de commande
du shell. Cibler par port ou par PID.

**`public_folder` du CMS ne doit PAS inclure le `basePath`.** Le front-matter
stocke `/media/…` et c'est le thème qui préfixe au rendu. L'inclure produirait
`/depot/depot/media/…`.

**La base de la démo ne doit jamais contaminer `git-sveltia`.** `sql-wasm.js`
et `sql-wasm.wasm` sont copiés depuis `le-socle/admin/` pendant un build `demo-local`.
Ils ne sont pas committés, chargés depuis un CDN ou émis dans un build Git.

**Statuts de la démo.** La base SQLite (sql.js) accepte `draft`, `in-review`,
`scheduled`, `published` et `archived` (schéma 2). Un article programmé dont l'heure est
passée sort comme publié dans la lecture publique ; la base garde `scheduled`.

---

## Ce qu'on ne fait pas

- Pas de CMS propriétaire.
- Pas d'hébergement fourni par Kiosque, pas d'OAuth maison, pas de serveur dans ce dépôt. L'adaptateur `socle` est un client HTTP, éteint dans le gabarit. Le serveur est le dépôt `le-socle`.
- **Aucune modification du dépôt `le-radar`** sans demande explicite.
- Pas de renommage des identifiants techniques internes (`@kiosque/*`,
  `kiosque.config.ts`, commande `kiosque`) : la marque publique est
  **LE KIOSQUE**, les identifiants restent `kiosque`.
- Pas de promesse d'hébergement, de sous-domaine à vie, de soutien permanent ni
  de maintenance garantie. L'accompagnement est bénévole, selon les
  disponibilités. **Ne présente jamais comme disponible un service non
  construit.**

---

## Style

Français québécois, ton éditorial et sobre. Les commentaires de code expliquent
**pourquoi**, pas **quoi** — surtout quand le choix est contre-intuitif. Les
messages d'erreur disent quoi faire, pas seulement ce qui a échoué.

---

## Registre officiel de livraison

Ce registre remplace l'ancien ledger `SUITE.md`. Un état doit être mis à jour
ici, dans le même changement que son code. Git conserve le détail historique;
on ne recrée pas de deuxième journal d’état.

| État | Chantier | Décision, critères et suites |
|---|---|---|
| **fait** | Jalon 3 — vitrine, Le Quorum et administration locale | Le build statique, le mode `demo-local` (sql.js), la banque média locale, les points focaux, la barre radio et les validations correspondantes sont livrés. La barre radio est le module de LE-RADAR (`https://le-radar.ca/radio-barre.js`), appelé en une ligne par `packages/theme-radar/src/radio.js`. Ne jamais copier ses stations, son lecteur ou son style dans le Kiosque : un changement de la radio doit arriver aux journaux sans mise à jour du Kiosque. Radio éteinte : ni emplacement ni requête vers le-radar.ca. LE-RADAR muet : l’emplacement reste replié. Les tests navigateur remplacent le module par un faux réduit au contrat. La base de la démo reste exclue des builds Git/Sveltia. |
| **fait** | Modèle éditorial de source individuelle | `source-view.js` est le noyau unique appelé par `templates.ts` et `assets/editorial/render.js`; `source-view.css` porte les mesures/rôles de LE-RADAR. La démonstration ne possède plus de carte concurrente. |
| **à surveiller** | Synchronisation LE-RADAR → LE-KIOSQUE | LE-RADAR est la référence du modèle de carte seulement. Avant de faire évoluer ce modèle dans LE-KIOSQUE, exécuter `npm run radar:reference:check -- --from=../le-radar`, examiner les écarts, puis actualiser le manifeste avec les adaptations réellement nécessaires. Les empreintes portent seulement sur `partitionSourceFeed`, `createArticle` et leurs CSS : une évolution du lecteur radio ne déclenche donc pas une fausse migration. Le build ne dépend jamais du dépôt voisin. |
| **fait** | Impression Ctrl+P d’un article individuel | `@media print` dans `theme.css` + `body.is-article-page` : masque mât photo, radio, nav, En bref, tags et footer chrome ; garde titre, méta, photo lead (si présente) et corps. Critère : Ctrl+P sur `/articles/…` = une page lisible, pas un scrape de l’UI. |
| **fait** | Banque de photos du journal | La banque est vide à l’installation. Les photos d’exemple du Quorum restent dans la démo (`tools/seed-demo-photos.mjs`, `examples/demo-journal/media/demo-library/`). L’espace de rédaction du Socle sert au téléversement (FilePond). Pas de suggestion Openverse ou Wikimedia. |
| **fait** | Jalon 4 — doctor, adopt, export miroir | `kiosque doctor` (diagnostic local sans réseau), `kiosque adopt` (checklist PASSATION.md), `kiosque export` (archive portable) et `kiosque deploy-hint` (guide publication, zéro hébergement fourni). Aucun backend ni OAuth. |
| **fait** | Adaptateur socle, éteint | `packages/adapters/socle` est chargé par `sync` seulement si la config le demande. Le gabarit et la démo restent `adapter: 'markdown'`. `build.ts` n'importe pas l'adaptateur, et du socle seulement l'admin (`le-socle/admin/`, par `local-admin.ts`), jamais son serveur. `admin/mise-a-jour/` a deux lignes, Socle (version de la dépendance installée) et Kiosque, dans la coquille de l’admin (`adminShell` du socle, feuille copiée en `assets/kiosque-admin.css` dans tous les modes). La ligne Socle montre le commit épinglé et, si `governance.repo` nomme le dépôt, le bouton « Proposer la dernière version du socle » vers le workflow `maj-socle.yml` du journal. Ce workflow appelle `tools/maj-socle.mjs` : sauvegarde d’abord, épinglage ensuite, build de vérification, puis pull request. Jamais de force, jamais de fusion automatique. Elle n’appelle pas le réseau. La navigation de l’admin est faite de liens `/admin/#vue`. Le serveur vit dans `le-socle`. |
| **fait** | Kit portable (clé USB / Drive) | `npm run kit` → `dist-kit/le-kiosque-kit.{zip,tar.gz}` : gabarit, plateforme, Node embarqué (Linux, macOS, Windows), site d’exemple, installateur en 5 étapes validées (`tools/kit/installer.mjs`) : SFTP/FTP/FTPS via curl ou sftp du système, dossier local, paquet Netlify/Cloudflare. Pause/reprise dans `journal/installation-kiosque.json`, jamais de mot de passe. Testé contre nginx + OpenSSH + vsftpd locaux. Reste : test sur un vrai hébergeur, Windows réel. |
| **fait** | Démo embarquée et workflows de mise à jour | `tools/build-site.mjs` force `editorial.mode: demo-local`, l’adaptateur Markdown et `demoContent: true` pour la démo de la vitrine. Un journal branché sur un socle (`external`, `demoContent: false`) héritait de ces réglages : pas de `seed.json`, l’admin ne montrait jamais « Tableau de bord ». Les workflows `maj-plateforme` et `maj-socle` ont une concurrence, un `timeout-minutes` et retentent les coupures réseau. Si GitHub interdit aux actions d’ouvrir une pull request, `tools/proposer-maj.sh` ouvre une issue avec le lien, puis échoue seulement si ni l’une ni l’autre n’a pu être créée. |
| **fait** | Issue unique « CI en échec sur main » | `ci-en-echec.yml` est appelé par `ci-en-echec-appel.yml` (`workflow_run` sur main). Le workflow n’est pas dans sa propre liste : il ne se relance pas. Une seule issue, étiquette `ci-en-echec`, mise à jour à l’échec (nom, lien du run, heure), fermée avec un commentaire quand il ne reste plus d’échec. `GITHUB_TOKEN` seulement, délai de 2 minutes, concurrence sans annulation. Les dépôts privés portent une copie autonome du même script. `le-radar` n’est pas modifié. |
| **fait** | Domaine kiosque.le-radar.ca | La vitrine Pages est à la racine (`kiosque.config.ts` : `basePath` vide, `origin`, `cname`). Le workflow Vérification ne reprend pas le `base_path` annoncé par GitHub tant que le domaine n’est pas enregistré dans les réglages Pages. L’artefact porte `CNAME`. Canonical, Open Graph, sitemap et manifeste utilisent `https://kiosque.le-radar.ca/`. La page du Socle est `https://socle.le-radar.ca/`. |
| **bloqué par produit/opérations** | Fédération LE-RADAR, API distante, stockage, rôles et DAM | Ne commencer qu’après définition des responsabilités d’authentification, d’exploitation et de stockage. |

### Port éditorial LE-RADAR : contrat d’acceptation

- La génération statique et le rendu de la démo navigateur utilisent le même HTML de carte;
  aucun copier-coller de `articleCard` n’est autorisé.
- La carte conserve les rôles, images proportionnées, absence d’image pour la
  suite du fil, métadonnées, date/heure, auteur, liens et états de champs
  absents définis par le noyau.
- Les images locales gardent `width`/`height`, `object-fit: cover`, point focal,
  texte alternatif, chargement approprié et chemins préfixés par `basePath`.
- Toute divergence volontaire est ajoutée à
  `packages/theme-radar/LE-RADAR-SOURCE-VIEW.json`; elle ne doit pas devenir une
  seconde interprétation visuelle.
- Les tests de build, la démo sous sous-répertoire et le contrôle de référence
  doivent rester exécutables avant une livraison.

### Risques connus et garde-fous

- LE-RADAR peut évoluer indépendamment : le manifeste et le contrôle manuel
  rendent la divergence visible sans créer de dépendance réseau ou de sous-module.
- Les articles de LE-KIOSQUE sont des contenus dont le journal est l’éditeur :
  le port garde donc des liens locaux et ne copie pas la règle de lien externe
  de l’agrégateur.
- Le compteur historique des tests dans les anciens documents est indicatif;
  exécuter les commandes plutôt que lui faire confiance.

## Interfaces d'outil : Tailwind CSS v4 + Basecoat (t377u, t378u)

La vitrine (`site/index.html`), le configurateur (`site/configurer/`) et
l'administration locale (`/admin/`) utilisent une seule base : Tailwind CSS v4
et Basecoat (MIT, style shadcn/ui). Sources dans `ui/`, compilation par
`npm run ui` (fichiers compilés versionnés, aucun build requis en CI). Ne pas
écrire de CSS à la main dans les fichiers compilés. **Le produit fini** (thème
`packages/theme-radar`, rendu du journal hérité de LE-RADAR) **n'utilise pas
cette base et ne doit pas changer** avec elle. Crédits : `THIRD_PARTY.md`.
