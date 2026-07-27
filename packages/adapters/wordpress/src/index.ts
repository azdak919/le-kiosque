/**
 * LE KIOSQUE — adaptateur WordPress / Newspack. SQUELETTE (jalon 4).
 *
 * ⚠ Non fonctionnel. Ce fichier existe pour figer la forme et prouver que le
 * contrat tient : ajouter un backend ne doit toucher à RIEN d'autre dans le
 * projet — ni le thème, ni le pipeline, ni le miroir, ni le site publié.
 *
 * Pour l'activer : implémenter les méthodes ci-dessous, faire passer
 * `runConformanceSuite`, puis décommenter l'entrée « wordpress » dans
 * packages/pipeline/src/adapters.ts. Aucune autre modification.
 *
 * Guide complet : docs/ecrire-un-adaptateur.md
 */

import type {
  Article,
  Author,
  MediaAsset,
  Publication,
  Taxonomies,
} from '../../../core/src/model.ts';
import type {
  ContentSource,
  ContentSourceCapabilities,
  HealthReport,
  SourceContext,
  SyncCursor,
} from '../../../core/src/source.ts';

export interface WordPressConfig {
  /** Racine du site WordPress. Ex. : 'https://journal.exemple.ca' */
  siteUrl: string;
  /**
   * Nom de la variable d'environnement contenant le mot de passe d'application.
   * Jamais le secret lui-même — la configuration est versionnée dans Git.
   */
  authSecretEnv?: string;
  /** Ne rapatrier que ces statuts. Défaut : publish, draft, pending. */
  statuses?: string[];
}

export class WordPressSource implements ContentSource<WordPressConfig> {
  readonly id = 'wordpress';

  readonly capabilities: ContentSourceCapabilities = {
    // `modified_after` existe sur /wp/v2/posts — le sync incrémental est possible.
    incremental: true,
    webhooks: true,
    // Renvoyer un statut vers WordPress demande une authentification en écriture.
    // Tant que ce n'est pas implémenté, `writeBack: false` — et le testkit vérifie
    // qu'on ne déclare pas une capacité qu'on n'a pas.
    writeBack: false,
    media: 'urls',
    taxonomies: ['category', 'tag'],
    editorialWorkflow: true,
  };

  #config!: WordPressConfig;
  #ctx!: SourceContext;

  async init(config: WordPressConfig, ctx: SourceContext): Promise<void> {
    this.#config = config;
    this.#ctx = ctx;
  }

  async health(): Promise<HealthReport> {
    const checkedAt = new Date().toISOString();
    // À implémenter : GET /wp-json/ et vérifier que la réponse est bien du JSON.
    //
    // Piège central de cet adaptateur : un WordPress en panne, derrière un
    // Cloudflare en mode « sous attaque » ou expiré chez l'hébergeur, répond
    // souvent 200 avec une page HTML. Un `res.ok` ne suffit donc PAS — il faut
    // valider le type de contenu ET la forme de la réponse, sinon le pipeline
    // croit le backend en bonne santé et synchronise zéro article.
    return { ok: false, checkedAt, reason: 'adaptateur WordPress non implémenté (jalon 4)' };
  }

  async fetchPublication(): Promise<Publication> {
    // GET /wp-json/  → name, description, url, home
    // La gouvernance n'existe pas dans WordPress : elle reste dans
    // content/publication.yml, fusionnée ici. Un CMS ne sait pas qui possède
    // le domaine — et c'est justement ce qui compte pour la survie du journal.
    throw new Error('non implémenté');
  }

  async fetchAuthors(_cursor?: SyncCursor): Promise<Author[]> {
    // GET /wp/v2/users?per_page=100
    // `cohort` et `active` n'existent pas dans WordPress : les conserver depuis
    // le miroir plutôt que de les écraser à chaque sync.
    throw new Error('non implémenté');
  }

  async fetchTaxonomies(): Promise<Taxonomies> {
    // GET /wp/v2/categories et /wp/v2/tags
    // WordPress n'a pas de notion de « section » : mapper la catégorie de plus
    // haut niveau, ou laisser l'équipe la déclarer dans content/sections/.
    throw new Error('non implémenté');
  }

  async *fetchArticles(_cursor?: SyncCursor): AsyncIterable<Article> {
    // GET /wp/v2/posts?_embed&modified_after=<since>&page=N
    //
    // Points de vigilance, tous vérifiés par le testkit :
    //  - `content.rendered` est du HTML : il DOIT passer par sanitizeHtml().
    //  - Les blocs Gutenberg laissent des commentaires <!-- wp:… --> à aplatir.
    //  - `id` WordPress est un entier propre à CE site : ne jamais s'en servir
    //    comme `Article.id`. Utiliser le `slug` + l'origine pour dériver un UUID
    //    stable, sinon une migration créerait des doublons.
    //  - Conserver le permalien WordPress dans `previousUrls` : c'est lui qui
    //    évite les liens morts le jour de la bascule.
    //  - La pagination s'arrête via l'en-tête X-WP-TotalPages, pas en devinant.
    throw new Error('non implémenté');
  }

  async resolveMedia(_asset: MediaAsset): Promise<Uint8Array> {
    // Télécharger depuis wp-content/uploads et rapatrier dans media/.
    // Impératif : le site publié ne doit JAMAIS pointer vers l'URL WordPress.
    // Sinon le jour où le WordPress ferme, toutes les photos du journal
    // disparaissent — alors même que les textes, eux, auraient survécu.
    throw new Error('non implémenté');
  }
}
