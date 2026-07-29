/**
 * LE KIOSQUE — génération de `admin/config.yml` (Sveltia CMS).
 *
 * La configuration du CMS n'est PAS écrite à la main : elle est dérivée du
 * modèle commun, des sections déclarées dans `content/sections/` et des
 * taxonomies du journal. Ajouter une section fait apparaître l'option dans le
 * CMS sans que personne n'y pense — et surtout, le CMS ne peut pas diverger
 * silencieusement du format que `sync` sait relire.
 *
 * ⚠ RÈGLE CRITIQUE : **tout champ du modèle doit être déclaré ici**, visible ou
 * caché. Les CMS de la famille Decap re-sérialisent l'entrée depuis les champs
 * déclarés ; une clé de front-matter absente de cette liste risque d'être
 * supprimée à la première sauvegarde. C'est exactement ce qui effacerait l'`id`
 * gelé par `sync` — et avec lui l'identité de l'article. Dans le doute, on
 * déclare.
 */

import { stringify } from 'yaml';

import { CMS_STATUSES, type ContentBundle, type Publication } from '../../core/src/model.ts';
import { normalizeBasePath, type KiosqueConfig } from './config.ts';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon — invisible sur le site',
  'in-review': 'En révision — soumis à la rédaction, toujours invisible',
  published: 'Publié — visible de tout le monde',
};

/** Déduit `owner/repo` de l'URL du dépôt déclarée dans la gouvernance. */
export function repoSlug(pub: Publication): string {
  const url = pub.governance?.repo ?? '';
  const m = /github\.com[/:]([^/]+)\/([^/.]+)/.exec(url);
  return m ? `${m[1]}/${m[2]}` : 'organisation/depot';
}

export interface CmsConfigOptions {
  config: KiosqueConfig;
  bundle: ContentBundle;
  /** Branche du dépôt. Défaut : main. */
  branch?: string;
  /** URL du Worker d'authentification (sveltia-cms-auth). */
  authBaseUrl?: string;
}

export function buildCmsConfig(options: CmsConfigOptions): Record<string, unknown> {
  const { config, bundle } = options;
  const pub = bundle.publication;
  const basePath = normalizeBasePath(config.deploy?.basePath);

  const sectionOptions = bundle.taxonomies.sections.map((s) => ({ label: s.name, value: s.slug }));
  const categoryOptions = bundle.taxonomies.categories.map((c) => ({ label: c.name, value: c.slug }));
  const tagOptions = bundle.taxonomies.tags.map((t) => ({ label: t.name, value: t.slug }));
  const mediaFields = (imageLabel = 'Image') => [
    { name: 'id', label: 'Identifiant média', widget: 'hidden', required: false },
    { name: 'kind', label: 'Type', widget: 'hidden', default: 'image' },
    { name: 'src', label: imageLabel, widget: 'image', required: true },
    { name: 'remoteSrc', label: 'Origine distante', widget: 'hidden', required: false },
    { name: 'alt', label: 'Description de l’image', widget: 'string', required: true },
    { name: 'caption', label: 'Légende', widget: 'string', required: false },
    { name: 'credit', label: 'Crédit photo', widget: 'string', required: false },
    { name: 'creditUrl', label: 'Lien du crédit', widget: 'string', required: false },
    { name: 'license', label: 'Licence', widget: 'string', required: false },
    { name: 'licenseUrl', label: 'Lien de la licence', widget: 'string', required: false },
    { name: 'sourceUrl', label: 'Page source', widget: 'string', required: false },
    { name: 'width', label: 'Largeur', widget: 'hidden', required: false },
    { name: 'height', label: 'Hauteur', widget: 'hidden', required: false },
    { name: 'focalPoint', label: 'Point focal', widget: 'object', required: false, fields: [
      { name: 'x', label: 'Position horizontale (%)', widget: 'number', min: 0, max: 100, value_type: 'int' },
      { name: 'y', label: 'Position verticale (%)', widget: 'number', min: 0, max: 100, value_type: 'int' },
    ] },
    { name: 'institution', label: 'Établissement source', widget: 'hidden', required: false },
    { name: 'campus', label: 'Campus source', widget: 'hidden', required: false },
    { name: 'keywords', label: 'Mots-clés de la banque', widget: 'hidden', required: false },
    { name: 'usages', label: 'Usages de la banque', widget: 'hidden', required: false },
    { name: 'mime', label: 'Type MIME', widget: 'hidden', required: false },
    { name: 'checksum', label: 'Somme de contrôle', widget: 'hidden', required: false },
    { name: 'source', label: 'Traçabilité du média', widget: 'hidden', required: false },
  ];

  return {
    backend: {
      name: 'github',
      repo: repoSlug(pub),
      branch: options.branch ?? 'main',
      ...(options.authBaseUrl ? { base_url: options.authBaseUrl } : {}),
    },

    // `media_folder` : où les fichiers atterrissent dans le dépôt.
    // `public_folder` : le chemin écrit DANS l'article.
    //
    // Volontairement SANS le sous-chemin de déploiement : le front-matter
    // stocke `/media/…`, et c'est le thème qui ajoute le `basePath` au moment
    // du rendu. L'inclure ici produirait `/depot/depot/media/…`.
    media_folder: 'media/{{year}}/{{month}}',
    public_folder: '/media/{{year}}/{{month}}',

    site_url: pub.siteUrl,
    display_url: pub.siteUrl,
    locale: 'fr',

    // `publish_mode: editorial_workflow` n'est PAS déclaré : Sveltia accepte la
    // clé mais ne l'implémente pas encore. Une configuration qui promet une
    // révision par pull request inexistante est pire que son absence — la
    // révision passe par le champ « statut » ci-dessous.

    collections: [
      {
        name: 'configuration',
        label: 'Configuration du journal',
        files: [{
          name: 'publication',
          label: 'Journal, mât et outils',
          file: 'content/publication.yml',
          fields: [
            { name: 'id', label: 'Identifiant', widget: 'hidden', required: false },
            { name: 'slug', label: 'Identifiant URL', widget: 'string', required: true },
            { name: 'name', label: 'Nom', widget: 'string', required: true },
            { name: 'tagline', label: 'Signature', widget: 'string', required: false },
            { name: 'institution', label: 'Établissement', widget: 'string', required: true },
            { name: 'institutionType', label: 'Type d’établissement', widget: 'select', options: ['cegep', 'universite', 'secondaire', 'autre'] },
            { name: 'region', label: 'Région', widget: 'string', required: false },
            { name: 'lang', label: 'Langue', widget: 'string', default: 'fr-CA' },
            { name: 'langs', label: 'Autres langues', widget: 'list', required: false },
            { name: 'siteUrl', label: 'Adresse du site', widget: 'string', required: true },
            { name: 'timeZone', label: 'Fuseau horaire', widget: 'select', required: true, default: 'America/Toronto', options: [
              { label: 'Heure de l’Est — majorité du Québec', value: 'America/Toronto' },
              { label: 'Heure de l’Atlantique — Blanc-Sablon', value: 'America/Blanc-Sablon' },
            ] },
            { name: 'logo', label: 'Logo', widget: 'object', required: false, fields: mediaFields('Fichier du logo') },
            { name: 'theme', label: 'Thème', widget: 'object', fields: [
              { name: 'accent', label: 'Couleur principale', widget: 'color' },
              { name: 'accentDark', label: 'Couleur sombre', widget: 'color', required: false },
              { name: 'typography', label: 'Typographie', widget: 'select', options: ['editorial-classic', 'modern-accessible', 'institutional'] },
            ] },
            { name: 'masthead', label: 'Mât', widget: 'object', required: false, fields: [
              { name: 'backgrounds', label: 'Arrière-plans', widget: 'object', fields: [
                { name: 'enabled', label: 'Afficher les arrière-plans', widget: 'boolean', default: true },
                { name: 'images', label: 'Images locales', widget: 'list', required: false, fields: mediaFields() },
              ] },
              { name: 'weather', label: 'Météo', widget: 'object', fields: [
                { name: 'enabled', label: 'Afficher la météo', widget: 'boolean', default: false },
                {
                  name: 'localities',
                  label: 'Localités (maximum quatre)',
                  widget: 'list',
                  required: false,
                  summary: '{{fields.name}}',
                  fields: [
                    { name: 'name', label: 'Nom affiché', widget: 'string', required: true },
                    { name: 'latitude', label: 'Latitude (OSM / WGS84)', widget: 'number', required: false, value_type: 'float' },
                    { name: 'longitude', label: 'Longitude (OSM / WGS84)', widget: 'number', required: false, value_type: 'float' },
                    { name: 'meteomediaSlug', label: 'Slug MétéoMédia (ex. quebec)', widget: 'string', required: false },
                    { name: 'envcanUrl', label: 'URL Environnement Canada (optionnel)', widget: 'string', required: false },
                    { name: 'osmId', label: 'Identifiant OpenStreetMap (optionnel)', widget: 'string', required: false },
                  ],
                },
              ] },
              { name: 'sports', label: 'Sports (puce mât)', widget: 'object', required: false, fields: [
                { name: 'enabled', label: 'Afficher le scoreboard', widget: 'boolean', default: false },
                { name: 'href', label: 'Lien de la puce (ex. /sections/sports/)', widget: 'string', required: false },
                { name: 'team', label: 'Équipe maison', widget: 'object', fields: [
                  { name: 'id', label: 'Identifiant stable', widget: 'string', required: true },
                  { name: 'name', label: 'Nom affiché', widget: 'string', required: true },
                  { name: 'code', label: 'Code court (2–4 lettres)', widget: 'string', required: true },
                  { name: 'institution', label: 'Établissement', widget: 'string', required: false },
                  { name: 'sport', label: 'Sport (slug, ex. volleyball)', widget: 'string', required: true },
                  { name: 'sportLabel', label: 'Libellé du sport', widget: 'string', required: false },
                  { name: 'sex', label: 'Catégorie (F / M / mixte)', widget: 'string', required: false },
                  { name: 'fictional', label: 'Équipe fictive (démo)', widget: 'boolean', default: false },
                  { name: 'note', label: 'Note (ex. hors RSEQ)', widget: 'text', required: false },
                  { name: 'colors', label: 'Couleurs', widget: 'object', required: false, fields: [
                    { name: 'primary', label: 'Primaire', widget: 'color', required: false },
                    { name: 'secondary', label: 'Secondaire', widget: 'color', required: false },
                  ] },
                ] },
                { name: 'results', label: 'Résultats récents', widget: 'list', required: false, summary: '{{fields.date}} · {{fields.opponent}}', fields: [
                  { name: 'date', label: 'Date (AAAA-MM-JJ)', widget: 'string', required: true },
                  { name: 'opponent', label: 'Adversaire', widget: 'string', required: true },
                  { name: 'opponentCode', label: 'Code adversaire', widget: 'string', required: false },
                  { name: 'opponentInstitution', label: 'Établissement adverse', widget: 'string', required: false },
                  { name: 'home', label: 'À domicile', widget: 'boolean', required: false },
                  { name: 'scoreFor', label: 'Score pour', widget: 'number', required: true, value_type: 'int' },
                  { name: 'scoreAgainst', label: 'Score contre', widget: 'number', required: true, value_type: 'int' },
                  { name: 'result', label: 'Issue', widget: 'select', options: ['W', 'L', 'D', 'T'], required: true },
                  { name: 'sport', label: 'Sport', widget: 'string', required: false },
                  { name: 'competition', label: 'Compétition', widget: 'string', required: false },
                  { name: 'note', label: 'Note', widget: 'string', required: false },
                ] },
                { name: 'nextGame', label: 'Prochain match', widget: 'object', required: false, fields: [
                  { name: 'date', label: 'Date (AAAA-MM-JJ)', widget: 'string', required: true },
                  { name: 'time', label: 'Heure (HH:MM)', widget: 'string', required: false },
                  { name: 'opponent', label: 'Adversaire', widget: 'string', required: true },
                  { name: 'opponentCode', label: 'Code adversaire', widget: 'string', required: false },
                  { name: 'home', label: 'À domicile', widget: 'boolean', required: false },
                  { name: 'competition', label: 'Compétition', widget: 'string', required: false },
                ] },
              ] },
              { name: 'tools', label: 'Outils LE-RADAR.ca', widget: 'object', fields: [
                { name: 'pomodoro', label: 'Pomodoro', widget: 'boolean', default: true },
                { name: 'solitaire', label: 'Solitaire', widget: 'boolean', default: true },
              ] },
              { name: 'overlayStrength', label: 'Force du voile photo', widget: 'number', required: false, min: 0, max: 0.9, value_type: 'float', default: 0.55 },
              { name: 'textAlignment', label: 'Alignement du titre', widget: 'select', required: false, default: 'left', options: [
                { label: 'Gauche', value: 'left' }, { label: 'Centre', value: 'center' }, { label: 'Droite', value: 'right' },
              ] },
            ] },
            { name: 'radio', label: 'Radio LE-RADAR.ca', widget: 'object', required: false, fields: [
              { name: 'enabled', label: 'Afficher la radio', widget: 'boolean', default: true },
              { name: 'station', label: 'Identifiant de station', widget: 'string', required: false },
              { name: 'theme', label: 'Ancien thème', widget: 'hidden', required: false },
              { name: 'position', label: 'Ancienne position', widget: 'hidden', required: false },
            ] },
            { name: 'media', label: 'Photos d’articles', widget: 'object', required: false, fields: [
              {
                name: 'autoStockPhoto',
                label: 'Proposer une photo libre si aucune n’est fournie',
                widget: 'boolean',
                default: false,
                hint: 'Algo LE-RADAR : banque du journal puis Openverse / Wikimedia Commons selon le titre et le texte. Une photo soumise manuellement n’est jamais remplacée.',
              },
            ] },
            { name: 'founded', label: 'Année de fondation', widget: 'string', required: false },
            { name: 'license', label: 'Licence', widget: 'string', required: false },
            { name: 'governance', label: 'Gouvernance', widget: 'object', fields: [
              { name: 'owner', label: 'Organisation propriétaire', widget: 'string' },
              { name: 'stewardEntity', label: 'Entité permanente', widget: 'string', required: false },
              { name: 'contact', label: 'Contact', widget: 'string' },
              { name: 'repo', label: 'Dépôt', widget: 'string' },
              { name: 'domainRegistrar', label: 'Registraire', widget: 'string', required: false },
              { name: 'domainExpiresAt', label: 'Échéance du domaine', widget: 'datetime', required: false },
              { name: 'recoveryContacts', label: 'Contacts de récupération', widget: 'list', required: false },
            ] },
          ],
        }],
      },
      {
        name: 'articles',
        label: 'Articles',
        label_singular: 'Article',
        description:
          'Un article reste invisible tant que son statut n’est pas « Publié ».',
        folder: 'content/articles',
        create: true,
        path: '{{year}}/{{month}}/{{slug}}',
        slug: '{{slug}}',
        extension: 'md',
        format: 'yaml-frontmatter',
        sortable_fields: ['publishedAt', 'title', 'status'],
        view_groups: [{ label: 'Statut', field: 'status' }],
        fields: [
          // Caché, jamais édité à la main : c'est l'identité permanente de
          // l'article, écrite par `sync`. Déclaré ici UNIQUEMENT pour que le
          // CMS ne l'efface pas en sauvegardant.
          { name: 'id', label: 'Identifiant permanent', widget: 'hidden' },

          {
            name: 'title',
            label: 'Titre',
            widget: 'string',
            required: true,
          },
          {
            name: 'slug',
            label: 'Adresse (slug)',
            widget: 'string',
            required: true,
            hint: 'Apparaît dans l’URL. Ne plus le changer une fois l’article publié : les liens partagés cesseraient de fonctionner.',
          },
          {
            name: 'status',
            label: 'Statut',
            widget: 'select',
            required: true,
            default: 'draft',
            options: CMS_STATUSES.map((s) => ({ label: STATUS_LABELS[s] ?? s, value: s })),
          },
          {
            name: 'subtitle',
            label: 'Sous-titre',
            widget: 'string',
            required: false,
          },
          {
            name: 'dek',
            label: 'Chapeau',
            widget: 'text',
            required: false,
            hint: 'Une ou deux phrases sous le titre.',
          },
          {
            name: 'authors',
            label: 'Signature',
            widget: 'relation',
            collection: 'auteurs',
            search_fields: ['name'],
            value_field: 'slug',
            display_fields: ['name'],
            multiple: true,
            required: false,
            hint: 'Obligatoire pour publier.',
          },
          {
            name: 'section',
            label: 'Section',
            widget: 'select',
            options: sectionOptions,
            required: false,
            hint: 'Obligatoire pour publier.',
          },
          {
            name: 'publishedAt',
            label: 'Date et heure de publication',
            widget: 'datetime',
            required: false,
            picker_utc: true,
            format: "yyyy-MM-dd'T'HH:mm:ss'Z'",
            hint: 'Obligatoire pour publier. L’heure exacte alimente aussi le flux lu par LE-RADAR.',
          },
          {
            name: 'updatedAt',
            label: 'Dernière modification',
            widget: 'datetime',
            required: true,
            default: '',
            picker_utc: true,
            format: "yyyy-MM-dd'T'HH:mm:ss'Z'",
          },
          {
            name: 'lead',
            label: 'Photo principale',
            widget: 'object',
            required: false,
            collapsed: false,
            fields: [
              ...mediaFields(),
            ],
          },
          {
            name: 'excerpt',
            label: 'Extrait',
            widget: 'text',
            required: false,
            hint: 'Utilisé dans le fil et le flux RSS. Déduit du texte s’il est laissé vide.',
          },
          {
            name: 'categories',
            label: 'Catégories',
            widget: 'select',
            options: categoryOptions,
            multiple: true,
            required: false,
          },
          {
            name: 'tags',
            label: 'Mots-clés',
            widget: 'select',
            options: tagOptions,
            multiple: true,
            required: false,
          },
          {
            name: 'lang',
            label: 'Langue',
            widget: 'hidden',
            default: pub.lang,
          },

          // Déclarés pour ne pas être effacés à la sauvegarde. Écrits par
          // `sync` ou à la main, jamais par la personne qui rédige.
          { name: 'previousUrls', label: 'Anciennes adresses', widget: 'hidden', required: false },
          { name: 'submittedAt', label: 'Soumis le', widget: 'hidden', required: false },
          { name: 'reviewedAt', label: 'Révisé le', widget: 'hidden', required: false },
          { name: 'reviewedBy', label: 'Révisé par', widget: 'hidden', required: false },
          { name: 'translations', label: 'Traductions', widget: 'hidden', required: false },
          { name: 'canonicalUrl', label: 'URL canonique', widget: 'hidden', required: false },
          { name: 'media', label: 'Photos supplémentaires', widget: 'list', required: false, fields: mediaFields() },
          { name: 'bodyFormat', label: 'Format du texte', widget: 'select', default: 'markdown', options: [
            { label: 'Éditeur visuel et source Markdown', value: 'markdown' },
            { label: 'HTML assaini (utiliser le mode source)', value: 'html' },
          ] },
          {
            name: 'demo',
            label: 'Contenu de démonstration',
            widget: 'boolean',
            default: false,
            required: false,
            hint: 'Cochez seulement pour un article fictif fourni avec le gabarit.',
          },

          // Le champ « body » est spécial : il représente tout ce qui suit le
          // front-matter. Il doit rester en dernier.
          { name: 'body', label: 'Texte', widget: 'richtext', modes: ['rich_text', 'raw'], editor_components: ['image'], sanitize_preview: true, required: true },
        ],
      },

      {
        name: 'auteurs',
        label: 'Équipe',
        label_singular: 'Personne',
        folder: 'content/auteurs',
        create: true,
        slug: '{{slug}}',
        extension: 'md',
        format: 'yaml-frontmatter',
        fields: [
          { name: 'id', label: 'Identifiant permanent', widget: 'hidden' },
          { name: 'name', label: 'Nom', widget: 'string', required: true },
          { name: 'slug', label: 'Adresse (slug)', widget: 'string', required: true },
          { name: 'role', label: 'Rôle', widget: 'string', required: false },
          {
            name: 'cohort',
            label: 'Cohorte',
            widget: 'string',
            required: false,
            hint: 'Ex. : 2026-2028.',
          },
          {
            name: 'active',
            label: 'Fait partie de l’équipe actuelle',
            widget: 'boolean',
            default: true,
            required: false,
            hint: 'Décocher au départ de la personne. Ses signatures restent sur ses articles : une archive ne se réécrit pas.',
          },
          { name: 'email', label: 'Courriel', widget: 'string', required: false },
          { name: 'avatar', label: 'Portrait', widget: 'image', required: false },
          { name: 'editorialRole', label: 'Rôle éditorial', widget: 'hidden', required: false },
          { name: 'social', label: 'Réseaux', widget: 'hidden', required: false },
          { name: 'body', label: 'Présentation', widget: 'markdown', required: false },
        ],
      },

      {
        name: 'sections',
        label: 'Sections',
        label_singular: 'Section',
        folder: 'content/sections',
        create: true,
        slug: '{{slug}}',
        extension: 'yml',
        format: 'yaml',
        fields: [
          { name: 'slug', label: 'Adresse (slug)', widget: 'string', required: true },
          { name: 'name', label: 'Nom', widget: 'string', required: true },
          { name: 'description', label: 'Description', widget: 'text', required: false },
          {
            name: 'order',
            label: 'Ordre d’affichage',
            widget: 'number',
            required: false,
            value_type: 'int',
          },
          {
            name: 'color',
            label: 'Couleur d’étiquette',
            widget: 'color',
            required: false,
            hint: 'Pastille sur les cartes d’articles. Distincte de la couleur de marque du journal.',
          },
        ],
      },
    ],
  };
}

/**
 * Sérialise la configuration, précédée d'un avertissement.
 *
 * L'avertissement compte : quelqu'un finira par ouvrir ce fichier et vouloir le
 * corriger à la main. Il faut qu'il sache immédiatement où est la vraie source.
 */
export function renderCmsConfig(options: CmsConfigOptions): string {
  const header = [
    '# ─────────────────────────────────────────────────────────────────────',
    '#  FICHIER GÉNÉRÉ — ne pas modifier à la main.',
    '#',
    '#  Produit par `kiosque cms:config` à partir du modèle commun, des',
    '#  sections de content/sections/ et des taxonomies du journal.',
    '#  Toute modification directe sera écrasée au prochain build.',
    '#',
    '#  Pour changer les sections ou les catégories proposées : modifier',
    '#  content/sections/ ou content/taxonomies.yml, puis relancer le build.',
    '# ─────────────────────────────────────────────────────────────────────',
    '',
  ].join('\n');

  return header + stringify(buildCmsConfig(options), { lineWidth: 0 });
}
