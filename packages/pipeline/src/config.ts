/**
 * LE KIOSQUE — configuration d'un journal.
 *
 * `kiosque.config.ts` est, avec `theme/tokens.css`, l'un des deux seuls fichiers
 * qu'une équipe édite. Il ne doit JAMAIS être modifié par l'amont : c'est cette
 * discipline qui rend `git pull upstream main` sans conflit, et donc les mises à
 * jour de plateforme réellement praticables pour une équipe non technique.
 */

export interface DeployConfig {
  /**
   * Sous-chemin de publication, SANS barre oblique finale.
   *
   * Un fork est servi par GitHub Pages sur `<org>.github.io/<depot>/` : le site
   * vit alors dans un sous-dossier, et tout chemin absolu commençant par `/`
   * pointe à côté. C'est le piège n°1 d'un déploiement gratuit sans domaine.
   *
   *   ''            domaine dédié      → https://lequorum.ca/
   *   '/le-quorum'  fork GitHub Pages  → https://mon-org.github.io/le-quorum/
   *
   * Laisser vide dès qu'un domaine personnalisé est en place.
   */
  basePath?: string;
  /** Domaine personnalisé écrit dans dist/CNAME. */
  cname?: string;
}

export interface CmsConfig {
  /**
   * URL du Worker d'authentification (`sveltia-cms-auth`).
   *
   * Sans elle, l'interface d'édition ne peut pas ouvrir de session GitHub.
   * Le site publié, lui, ne dépend de rien de tout ça : si ce Worker tombe,
   * seule l'écriture s'arrête. Voir docs/brancher-sveltia.md.
   */
  authBaseUrl?: string;
  /** Branche sur laquelle le CMS écrit. Défaut : main. */
  branch?: string;
}

export interface KiosqueConfig {
  /** Racine du dépôt. Résolue depuis l'emplacement du fichier de configuration. */
  root: string;

  /** Interface de rédaction. Facultative : un journal peut n'écrire qu'en Markdown. */
  cms?: CmsConfig;

  /** Interface de rédaction proposée par le site généré. */
  editorial?: {
    mode: 'demo-local' | 'git-sveltia' | 'external';
    /** Réservé aux intégrations futures, par exemple PocketBase. */
    externalBackend?: string;
  };

  /** Quel backend éditorial alimente le miroir. */
  source: {
    /** 'markdown' au jalon 1. 'wordpress', 'ghost'… ensuite. */
    adapter: string;
    /** Options propres à l'adaptateur. */
    options?: Record<string, unknown>;
  };

  deploy?: DeployConfig;

  /** Bandeau affiché en tête de chaque page. Sert au journal de démonstration. */
  demoNotice?: string;

  /** false retire du site les articles portant `demo: true`, sans les effacer. */
  demoContent?: boolean;

  /** Nombre d'articles dans le flux Atom. */
  feedLimit?: number;
}

/** Normalise le sous-chemin : '' ou '/quelque-chose', jamais de barre finale. */
export function normalizeBasePath(input?: string): string {
  if (!input) return '';
  const trimmed = input.trim().replace(/\/+$/, '');
  if (!trimmed || trimmed === '/') return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * Préfixe un chemin racine avec le sous-chemin de déploiement.
 * Les URL absolues et les ancres passent inchangées.
 */
export function withBase(basePath: string, urlPath: string): string {
  if (!basePath) return urlPath;
  if (!urlPath.startsWith('/')) return urlPath;
  return `${basePath}${urlPath}`;
}
