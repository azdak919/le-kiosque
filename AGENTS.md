# AGENTS.md — à lire en premier

> Ce fichier s'adresse aux agents (Claude, Codex, Grok, Cursor…) et aux
> personnes qui reprennent le projet. Lis-le en entier avant de toucher au code :
> il contient des contraintes qui ne se devinent pas et des pièges déjà payés.
>
> **La mission en cours est décrite dans [`SUITE.md`](SUITE.md).**

---

## Le projet en trois phrases

**LE KIOSQUE** est un socle libre pour les journaux étudiants. Il existe parce
qu'un journal étudiant meurt rarement par manque de talent : il meurt quand le
domaine expire, que le compte d'administration appartient à quelqu'un qui a
gradué, et que dix ans d'archives partent avec.

Tout le projet découle d'un seul objectif : **survivre à ses fondateurs**.

**LE RADAR** (`github.com/azdak919/le-radar`, dépôt séparé) est l'agrégateur et
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
adaptateur : c'est vérifié par un test.

---

## Commandes

```bash
npm test                    # 41 tests — doit rester vert
npm run test:e2e            # parcours Chromium PGlite sous un basePath renommé
npm run test:continuity     # le test décisif du projet (voir plus bas)
npm run typecheck           # tsc --noEmit (typage seul, aucune compilation)

node packages/pipeline/src/cli.ts sync   --root examples/demo-journal
node packages/pipeline/src/cli.ts build  --root examples/demo-journal
node packages/pipeline/src/cli.ts verify --root examples/demo-journal
node packages/pipeline/src/cli.ts cms:config --root examples/demo-journal

node tools/vendor-cms.mjs   # fige Sveltia CMS dans le dépôt
```

Node **≥ 22.18** exécute le TypeScript directement. Il n'y a **aucune étape de
compilation** et il ne doit pas y en avoir.

---

## Contraintes non négociables

**Syntaxe TypeScript « effaçable » uniquement.** Node retire les types, il ne
compile pas. Donc : pas d'`enum`, pas de `namespace`, pas de propriétés de
paramètre (`constructor(private x)`). Utilise des types union et des `const`
objects. *Un fichier qui viole ça plante au chargement, pas au build.*

**Deux dépendances de production, `yaml` et `marked`.** PGlite et Playwright
sont des dépendances de développement verrouillées : PGlite est copié seulement
dans une sortie `demo-local`, Playwright ne sert qu’aux tests. N'en ajoute pas sans
raison forte. Chaque dépendance est une dette de survie : le projet doit se
reconstruire dans dix ans.

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
    wordpress/        squelette non fonctionnel (jalon 5)
  pipeline/
    sync.ts           parle au CMS · fige les id · écrit le miroir
    build.ts          NE PARLE À RIEN · lit le miroir · produit dist/
    cms-config.ts     génère admin/config.yml DEPUIS le modèle
    sanitize.ts       liste blanche HTML (le CMS tiers n'est pas de confiance)
    mirror.ts         miroir, empreintes sha256, intégrité
    cli.ts            sync · build · verify · cms:config
  theme-radar/        identité éditoriale reprise de LE RADAR
    assets/tokens.css  ← le SEUL fichier qu'une équipe modifie
    src/templates.ts   gabarits (fonctions pures : modèle → HTML)
    src/admin.ts       page /admin
    assets/admin/      Sveltia CMS figé (2 Mo, MIT)
    assets/editorial/  PGlite local, administration, rendu et exports navigateur
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

**PGlite ne doit jamais contaminer `git-sveltia`.** Ses modules JS, WASM et
`pglite.data` sont copiés depuis `node_modules` pendant un build `demo-local`.
Ils ne sont pas committés, chargés depuis un CDN ou émis dans un build Git.

---

## Ce qu'on ne fait pas

- Pas de CMS propriétaire.
- Pas d'hébergement, pas d'OAuth maison, pas de backend.
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
