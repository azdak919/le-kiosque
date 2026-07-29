/**
 * LE KIOSQUE — modèle de contenu commun.
 *
 * Ce fichier est le contrat que TOUT adaptateur doit produire, quel que soit le
 * CMS d'origine (Markdown/Git, WordPress, Ghost, Superdesk, Drupal…).
 *
 * Deux champs portent toute la stratégie anti-casse :
 *   - `Article.id`        UUID figé, indépendant du CMS → une migration ne duplique rien
 *   - `Article.previousUrls`  → aucun lien mort quand les permaliens changent
 *
 * Contrainte : syntaxe TypeScript « effaçable » uniquement (pas de `enum`, pas de
 * `namespace`, pas de propriétés de paramètre) — Node exécute ces fichiers
 * directement, sans compilateur.
 */

export type ID = string;
export type Slug = string;
/** RFC 3339, UTC. Ex. : '2026-09-12T14:30:00Z' */
export type ISODate = string;
/** BCP-47. Ex. : 'fr-CA', 'en-CA' */
export type Lang = string;

export type EditorialStatus =
  | 'draft'
  | 'in-review'
  | 'scheduled'
  | 'published'
  | 'archived'
  | 'retracted';

export const EDITORIAL_STATUSES: readonly EditorialStatus[] = [
  'draft',
  'in-review',
  'scheduled',
  'published',
  'archived',
  'retracted',
];

/**
 * Les trois statuts proposés dans le CMS. Les autres sont des états avancés,
 * posés à la main ou par outillage — on ne les met pas dans un menu déroulant
 * destiné à une personne qui écrit un article.
 */
export const CMS_STATUSES: readonly EditorialStatus[] = ['draft', 'in-review', 'published'];

/**
 * Statuts qui font apparaître un article dans une LISTE : fil d'accueil,
 * page de section, page d'auteur·rice, flux Atom, plan du site.
 *
 * `published` et lui seul. Un brouillon ou un article en révision ne doit
 * exister nulle part publiquement.
 */
export const LISTED_STATUSES: readonly EditorialStatus[] = ['published'];

/**
 * Statuts qui conservent une PAGE à leur URL.
 *
 * `archived` en fait partie, et c'est délibéré : un article archivé quitte le
 * fil et le flux, mais son adresse continue de répondre. Le retirer ferait 404
 * chaque lien partagé vers lui — exactement ce que `previousUrls` et toute
 * l'architecture cherchent à empêcher. « Archivé » veut dire « sorti de
 * l'actualité », pas « effacé de l'histoire ».
 *
 * `retracted` est le seul cas où une page disparaît : un retrait pour raison
 * légale ou déontologique, décidé par la rédaction.
 */
export const PAGED_STATUSES: readonly EditorialStatus[] = ['published', 'archived'];

export type MediaKind = 'image' | 'audio' | 'video' | 'document';

export type InstitutionType = 'cegep' | 'universite' | 'autre';

/**
 * D'où vient la donnée. Indispensable pour l'audit, la reprise et le sync
 * incrémental — c'est ce qui permet de rebrancher un CMS des années plus tard
 * sans dupliquer ni perdre l'historique.
 */
export interface SourceAttribution {
  /** 'markdown' | 'wordpress' | 'ghost' | … */
  backend: string;
  /** Identifiant natif dans ce backend. */
  backendId: string;
  backendUrl?: string;
  fetchedAt: ISODate;
  /** etag / hash / date de modification — permet le sync incrémental. */
  revision?: string;
  license?: string;
  /** Renseigné si le contenu est syndiqué depuis un autre média. */
  originalPublisher?: string;
}

export interface MediaAsset {
  id: ID;
  kind: MediaKind;
  /** Chemin local APRÈS miroir. Ex. : '/media/2026/09/greve.jpg' */
  src: string;
  /** Origine distante — conservée pour l'audit et le re-téléchargement. */
  remoteSrc?: string;
  /** Requis pour publier une image. Vide = échec de validation. */
  alt: string;
  caption?: string;
  /** Le ou la photographe. */
  credit?: string;
  /** Page qui documente le crédit ou la provenance du fichier. */
  creditUrl?: string;
  license?: string;
  /** Adresse de la licence, pour que le crédit reste vérifiable. */
  licenseUrl?: string;
  /** Page source du média, distincte du fichier binaire dérivé. */
  sourceUrl?: string;
  width?: number;
  height?: number;
  /** Point à préserver lors d'un recadrage `cover`, en pourcentage. */
  focalPoint?: { x: number; y: number };
  /** Métadonnées conservées quand une entrée de bibliothèque est copiée. */
  institution?: string;
  campus?: string;
  keywords?: string[];
  usages?: SharedMediaUsage[];
  mime?: string;
  /** sha256 du fichier — vérification d'intégrité de l'archive. */
  checksum?: string;
  source: SourceAttribution;
}

export type SharedMediaUsage = 'exterior' | 'interior' | 'sport' | 'masthead' | 'article';

/**
 * Entrée documentée d'une bibliothèque partagée.
 *
 * Plus stricte qu'un téléversement local : une photo préchargée doit pouvoir
 * être attribuée, recadrée et auditée sans dépendre de l'interface qui l'affiche.
 */
export interface SharedMediaAsset extends MediaAsset {
  remoteSrc: string;
  credit: string;
  creditUrl: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  width: number;
  height: number;
  focalPoint: { x: number; y: number };
  institution: string;
  campus: string;
  keywords: string[];
  usages: SharedMediaUsage[];
}

/**
 * Rôle éditorial. Déclaré pour la suite — aucune permission n'en découle
 * aujourd'hui, l'autorisation réelle vient des droits GitHub sur le dépôt.
 * Ne pas s'en servir comme d'un contrôle d'accès : ce n'en est pas un.
 */
export type EditorialRole = 'auteur' | 'reviseur' | 'editeur';

export interface Author {
  id: ID;
  slug: Slug;
  name: string;
  /** Libellé affiché : « journaliste », « rédaction en chef », « photographe »… */
  role?: string;
  /** Rôle éditorial structuré. Voir `EditorialRole` : informatif seulement. */
  editorialRole?: EditorialRole;
  bio?: string;
  avatar?: MediaAsset;
  email?: string;
  social?: Record<string, string>;
  /** Spécifique au monde étudiant. Ex. : '2026-2028'. */
  cohort?: string;
  /** false = a gradué. On garde la signature, on la retire des listes actives. */
  active?: boolean;
  /** Donnée fictive livrée avec une démonstration locale. */
  isDemo?: boolean;
  /** Distingue un exemple personnalisé de sa copie initiale. */
  isUserModified?: boolean;
  source: SourceAttribution;
}

export interface Section {
  id: ID;
  slug: Slug;
  name: string;
  description?: string;
  order?: number;
  parent?: Slug;
  /**
   * Couleur d’étiquette pour les cartes (pastille, survol).
   * Distincte de la couleur de marque du journal : chaque rubrique peut
   * porter son identité visuelle.
   */
  color?: string;
}

export interface Category {
  id: ID;
  slug: Slug;
  name: string;
  parent?: Slug;
  /** Couleur optionnelle pour pastilles / filtres de catégorie. */
  color?: string;
}

export interface Tag {
  id: ID;
  slug: Slug;
  name: string;
}

export interface Taxonomies {
  sections: Section[];
  categories: Category[];
  tags: Tag[];
}

/**
 * La gouvernance des ressources critiques. Ces champs ne décorent pas : ils sont
 * lus par `kiosque doctor` (jalon 4) pour alerter avant qu'un journal ne meure
 * d'un domaine expiré ou d'un compte personnel perdu.
 */
export interface Governance {
  /** Organisation propriétaire du dépôt — JAMAIS un compte personnel. */
  owner: string;
  /** Association étudiante, coopérative, OBNL : l'entité permanente. */
  stewardEntity?: string;
  /** Courriel institutionnel, pas celui d'un individu. */
  contact: string;
  repo: string;
  domainRegistrar?: string;
  /** Date d'échéance du domaine — la cause de mort n°1. */
  domainExpiresAt?: ISODate;
  /** Personnes capables de récupérer les accès. Deux minimum. */
  recoveryContacts?: string[];
}

/** Le journal lui-même. */
export interface Publication {
  id: ID;
  slug: Slug;
  name: string;
  tagline?: string;
  institution: string;
  institutionType: InstitutionType;
  region?: string;
  lang: Lang;
  langs?: Lang[];
  /** Origine canonique, sans barre oblique finale. Ex. : 'https://exil.ca' */
  siteUrl: string;
  /** Fuseau IANA utilisé pour présenter les heures éditoriales. */
  timeZone: string;
  logo?: MediaAsset;
  theme: {
    accent: string;
    accentDark?: string;
    /** Trois piles locales : aucune police distante n'est requise. */
    typography?: 'editorial-classic' | 'modern-accessible' | 'institutional';
  };
  /** Mât éditorial : toutes les images restent dans l'archive locale. */
  masthead?: {
    backgrounds?: {
      enabled?: boolean;
      images: MediaAsset[];
    };
    weather?: {
      enabled?: boolean;
      /** Noms saisis par la rédaction; le navigateur fait le géocodage. */
      localities: string[];
    };
    tools?: {
      pomodoro?: boolean;
      solitaire?: boolean;
    };
    /** Opacité du voile de lisibilité, bornée à 0–0,9 au rendu. */
    overlayStrength?: number;
    textAlignment?: 'left' | 'center' | 'right';
  };
  /** Barre d'écoute facultative de LE-RADAR. */
  radio?: {
    enabled?: boolean;
    station?: string;
    theme?: 'auto' | 'light' | 'dark';
    position?: 'top' | 'bottom';
  };
  /**
   * Libellés d’interface paramétrables (focus group / rédaction).
   * Fallbacks thème : « À la une ».
   */
  labels?: {
    /** Titre du fil d’accueil (h1). */
    wireTitle?: string;
    /** Eyebrow de la carte manchette ; défaut « À la une » (distinct de wireTitle). */
    leadEyebrow?: string;
  };
  founded?: string;
  governance: Governance;
  license?: string;
}

export interface ArticleBody {
  format: 'markdown' | 'html';
  /** La source portable — la vérité. Ce qui reste lisible dans 20 ans. */
  raw: string;
  /** Rendu assaini. Dérivé, régénérable, jamais la source. */
  html?: string;
  wordCount?: number;
}

export interface Article {
  /** UUID figé à la création, survit à toutes les migrations de CMS. */
  id: ID;
  slug: Slug;
  publication: Slug;
  title: string;
  subtitle?: string;
  /** Le chapeau. */
  dek?: string;
  excerpt: string;
  body: ArticleBody;
  lead?: MediaAsset;
  media: MediaAsset[];
  authors: Slug[];
  section?: Slug;
  categories: Slug[];
  tags: Slug[];
  lang: Lang;
  translations?: Record<Lang, Slug>;
  status: EditorialStatus;
  /** Contenu fictif fourni avec le gabarit, désactivable sans le supprimer. */
  isDemo?: boolean;
  /** Vrai dès qu'une personne modifie un exemple dans le mode local. */
  isUserModified?: boolean;
  publishedAt?: ISODate;
  updatedAt: ISODate;

  // ── Traçabilité de la révision ──────────────────────────────────────────
  // Renseignés dès aujourd'hui quand l'information existe, mais AUCUNE
  // mécanique ne s'appuie encore dessus. Ils sont là pour que le jour où
  // Sveltia livrera la révision par pull request — ou qu'on ajoutera des
  // demandes de modification — rien n'ait à être migré.
  /** Passage à `in-review`. */
  submittedAt?: ISODate;
  /** Dernière décision d'un·e réviseur·euse. */
  reviewedAt?: ISODate;
  /** Slug de la personne qui a révisé. */
  reviewedBy?: Slug;

  /** Absolue et permanente. */
  canonicalUrl: string;
  /** Anciennes URL → alimente les redirections lors des migrations. */
  previousUrls?: string[];
  source: SourceAttribution;
}

/** Ce que `sync` écrit et ce que `build` lit. Le miroir, en mémoire. */
export interface ContentBundle {
  publication: Publication;
  articles: Article[];
  authors: Author[];
  taxonomies: Taxonomies;
  /** Bibliothèque facultative, émise uniquement par la démonstration locale. */
  media?: SharedMediaAsset[];
  syncedAt: ISODate;
}

// ---------------------------------------------------------------------------
// Aides sans effet de bord, partagées par les adaptateurs et le pipeline.
// ---------------------------------------------------------------------------

/**
 * L'article apparaît-il dans les listes publiques (fil, section, auteur·rice,
 * flux Atom, plan du site) ?
 */
export function isListed(article: Article): boolean {
  return LISTED_STATUSES.includes(article.status);
}

/**
 * L'article a-t-il une page à son URL ?
 *
 * Distinct de `isListed` : un article archivé garde son adresse mais quitte
 * les listes. Confondre les deux notions casse soit les liens partagés, soit
 * la confidentialité des brouillons — c'est pourquoi il y a deux fonctions.
 */
export function hasPublicPage(article: Article): boolean {
  return PAGED_STATUSES.includes(article.status);
}

/**
 * Slug normalisé : minuscules, accents retirés, ponctuation en tirets.
 * « Grève : les étudiant·e·s votent » → 'greve-les-etudiant-e-s-votent'
 */
export function slugify(input: string): Slug {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // diacritiques combinantes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);
}

/** URL canonique d'un article. Une seule définition, partout. */
export function articleUrl(pub: Publication, article: Article): string {
  const base = pub.siteUrl.replace(/\/+$/, '');
  return `${base}/articles/${article.slug}/`;
}

export function sectionUrl(pub: Publication, slug: Slug): string {
  return `${pub.siteUrl.replace(/\/+$/, '')}/sections/${slug}/`;
}

export function authorUrl(pub: Publication, slug: Slug): string {
  return `${pub.siteUrl.replace(/\/+$/, '')}/auteurs/${slug}/`;
}

/** Tri éditorial : le plus récent d'abord, `updatedAt` en repli. */
export function byDateDesc(a: Article, b: Article): number {
  const da = a.publishedAt ?? a.updatedAt;
  const db = b.publishedAt ?? b.updatedAt;
  return db.localeCompare(da);
}
