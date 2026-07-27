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
            label: 'Date de publication',
            widget: 'datetime',
            required: false,
            picker_utc: true,
            format: "yyyy-MM-dd'T'HH:mm:ss'Z'",
            hint: 'Obligatoire pour publier.',
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
              { name: 'src', label: 'Image', widget: 'image', required: true },
              {
                name: 'alt',
                label: 'Description de l’image',
                widget: 'string',
                // Non négociable : c'est ce que lisent les personnes aveugles,
                // et ce qui s'affiche quand l'image ne charge pas.
                // L'accessibilité se gagne à la saisie, pas à la relecture.
                required: true,
                hint: 'Décrire ce qu’on voit. Ex. : « Une assemblée étudiante dans un auditorium bondé ».',
              },
              { name: 'credit', label: 'Crédit photo', widget: 'string', required: false },
              { name: 'caption', label: 'Légende', widget: 'string', required: false },
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
          { name: 'media', label: 'Médias', widget: 'hidden', required: false },
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
          { name: 'body', label: 'Texte', widget: 'markdown', required: true },
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
