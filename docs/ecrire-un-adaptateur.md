# Écrire un adaptateur

Brancher un nouveau backend éditorial = écrire **une classe**. Rien d'autre dans
le projet ne bouge : ni le thème, ni le pipeline, ni le miroir, ni le site
publié.

C'est la promesse de l'architecture, et elle se vérifie mécaniquement : si votre
adaptateur passe `runConformanceSuite`, il est utilisable.

---

## 1. La frontière à ne jamais franchir

```
adaptateur  ──►  modèle commun  ──►  miroir Git  ──►  build  ──►  site
   ↑                                     ↑
   seule frontière réseau          seule source du build
```

**`build` n'importe jamais un adaptateur.** Si vous vous surprenez à vouloir
appeler une API depuis le rendu, l'architecture est en train de se faire
contourner — et avec elle la garantie qu'un CMS mort ne casse pas le site.

---

## 2. Le squelette

```ts
import type { ContentSource } from '../../core/src/source.ts';

export class MonSource implements ContentSource<MaConfig> {
  readonly id = 'mon-cms';

  readonly capabilities = {
    incremental: true,
    webhooks: false,
    writeBack: false,
    media: 'urls',
    taxonomies: ['category', 'tag'],
    editorialWorkflow: true,
  } as const;

  async init(config: MaConfig, ctx: SourceContext) { /* … */ }
  async health(): Promise<HealthReport> { /* … */ }
  async fetchPublication(): Promise<Publication> { /* … */ }
  async fetchAuthors(): Promise<Author[]> { /* … */ }
  async fetchTaxonomies(): Promise<Taxonomies> { /* … */ }
  async *fetchArticles(cursor?: SyncCursor): AsyncIterable<Article> { /* … */ }
  async resolveMedia(asset: MediaAsset): Promise<Uint8Array> { /* … */ }
}
```

Puis une ligne dans `packages/pipeline/src/adapters.ts`. C'est tout.

---

## 3. Les cinq pièges

Ils viennent tous de cas réels. Le testkit en attrape la plupart.

### `health()` ne lève jamais et ne se contente pas d'un code 200

Un backend en panne répond très souvent **200 avec du HTML** : page « site
suspendu » de l'hébergeur, écran Cloudflare, portail de connexion expiré.
Vérifiez le type de contenu **et** la forme de la réponse.

```ts
async health(): Promise<HealthReport> {
  const checkedAt = new Date().toISOString();
  try {
    const res = await this.#ctx.fetch(`${this.#base}/wp-json/`);
    if (!res.ok) return { ok: false, checkedAt, reason: `http-${res.status}` };
    if (!res.headers.get('content-type')?.includes('json')) {
      return { ok: false, checkedAt, reason: 'réponse non-JSON (page d’erreur ?)' };
    }
    return { ok: true, checkedAt };
  } catch (err) {
    return { ok: false, checkedAt, reason: String(err) };  // jamais throw
  }
}
```

Un `health()` trop optimiste, c'est un `sync` qui écrase le miroir avec zéro
article. C'est le mode de mort exact que tout le projet cherche à empêcher.

### `Article.id` ne doit rien devoir au CMS

L'identifiant interne de WordPress (`42`) ou de Ghost (`6512ab…`) appartient à
**cette installation-là**. Le jour de la migration, les identifiants changent et
chaque article devient un doublon.

Dérivez un UUID stable de quelque chose qui survit — le slug, l'URL d'origine :

```ts
id: derivedId('article', `${publication.slug}/${slug}`)
```

Le testkit vérifie qu'entre deux lectures les identifiants ne bougent pas.

### Conserver les permaliens dans `previousUrls`

Mettez toujours l'URL d'origine du CMS dans `previousUrls`. C'est ce qui évite
que tous les liens partagés meurent le jour de la bascule — et ça ne coûte
qu'une ligne.

### Le HTML tiers doit être assaini

`content.rendered` de WordPress contient ce que des greffons et des
copier-coller y ont laissé. Le pipeline passe systématiquement par
`sanitizeHtml()`, mais ne comptez pas dessus pour aplatir les blocs Gutenberg
ou nettoyer les `<div>` vides — faites-le dans l'adaptateur.

> **Limite connue :** `sanitizeHtml()` fonctionne par expressions régulières,
> pas par analyse conforme du HTML. C'est acceptable tant que le contenu vient
> du dépôt du journal ou d'un CMS que son équipe administre. Pour ingérer du
> contenu réellement hostile (commentaires publics, syndication ouverte), il
> faudra passer à un analyseur conforme.

### Rapatrier les médias, toujours

Ne laissez jamais le site publié pointer vers les URL du CMS. Sinon, le jour où
il ferme, toutes les photos disparaissent — alors que les textes, eux, auraient
survécu. `resolveMedia()` doit retourner les octets ; le pipeline les enregistre
dans `media/` avec leur empreinte.

---

## 4. Vérifier

```ts
import { runConformanceSuite, formatConformanceReport } from '@kiosque/core/testkit';

const report = await runConformanceSuite(() => new MonSource(), config, {
  ctx: { fetch: fauxFetch },   // hors ligne, avec des réponses figées
});
console.log(formatConformanceReport(report));
```

Écrivez vos essais avec un `fetch` bouchonné : un test qui dépend d'un serveur
distant ne tourne plus dans deux ans, et c'est exactement l'horizon qui nous
intéresse.

---

## 5. Correspondances connues

| CMS | Point d'entrée | Corps | Incrémental |
|---|---|---|---|
| WordPress / Newspack | `/wp-json/wp/v2/posts?_embed` | `content.rendered` (HTML) | `modified_after` |
| Ghost | `/ghost/api/content/posts/` | `html` ou Lexical | `updated_at:>` |
| Superdesk | API NINJS | `body_html` | `versioncreated` |
| Drupal | `/jsonapi/node/article` | `body.processed` | `filter[changed][value]` |

Pagination : suivez l'en-tête ou le curseur fourni par l'API. Ne devinez jamais
le nombre de pages.
