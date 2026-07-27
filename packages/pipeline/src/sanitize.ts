/**
 * LE KIOSQUE — assainissement du HTML.
 *
 * Le Markdown de notre propre dépôt est de confiance, mais ce module ne l'est
 * pas pour autant : dès l'adaptateur WordPress, le corps des articles arrivera
 * en HTML produit par un CMS tiers, avec ses greffons et ses colleuses-copieuses.
 * Un site statique n'a pas de pare-feu applicatif — l'assainissement se fait ici,
 * au moment du rendu, une fois pour toutes.
 *
 * Approche par LISTE BLANCHE : tout ce qui n'est pas explicitement autorisé est
 * retiré. Une liste noire se fait toujours contourner.
 */

/** Balises conservées — de quoi écrire un article de journal, rien de plus. */
const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'mark', 'small',
  'sub', 'sup', 'abbr', 'cite', 'q', 'time',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'blockquote', 'pre', 'code',
  'a', 'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'span', 'div', 'section', 'article', 'aside', 'header', 'footer',
]);

/** Balises dont le CONTENU est également supprimé, pas seulement les chevrons. */
const VOID_CONTENT_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript']);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'rel', 'target', 'hreflang']),
  img: new Set(['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding', 'srcset', 'sizes']),
  time: new Set(['datetime']),
  th: new Set(['scope', 'colspan', 'rowspan']),
  td: new Set(['colspan', 'rowspan']),
  ol: new Set(['start', 'reversed', 'type']),
  abbr: new Set(['title']),
  q: new Set(['cite']),
  blockquote: new Set(['cite']),
};

/** Attributs tolérés sur n'importe quelle balise autorisée. */
const GLOBAL_ATTRS = new Set(['id', 'class', 'lang', 'dir']);

const SELF_CLOSING = new Set(['br', 'hr', 'img']);

/** Schémas autorisés dans un href/src. Tout le reste est rejeté. */
const SAFE_SCHEMES = /^(?:https?|mailto|tel)$/i;

function isSafeUrl(value: string): boolean {
  // Les caractères de contrôle et les espaces sont le vecteur de contournement
  // classique : « java\tscript:alert(1) » passe les filtres naïfs parce que le
  // navigateur, lui, les ignore avant de résoudre le schéma.
  const v = value.replace(/[\u0000-\u0020\u007f]/g, '');

  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(v);
  if (!scheme) {
    // Pas de schéma → URL relative ou ancre. Sûre par construction, et c'est le
    // cas le plus courant : « photo.jpg », « ../media/x.png », « #section ».
    return true;
  }
  if (SAFE_SCHEMES.test(scheme[1])) return true;
  // Les images en ligne restent utiles (exports de CMS) ; les autres data: non —
  // « data:text/html » exécuterait du script dans l'origine du journal.
  return /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,/i.test(v);
}

/**
 * Retire tout ce qui n'est pas explicitement autorisé.
 *
 * Analyse par expression régulière : ce n'est PAS un analyseur HTML complet, et
 * ça ne prétend pas l'être. C'est acceptable ici parce que la sortie est du HTML
 * statique servi sans cookie ni session, et que les entrées viennent du dépôt du
 * journal ou d'un CMS que son équipe administre. Le jour où un adaptateur
 * ingérera du contenu réellement hostile (commentaires publics, syndication
 * ouverte), il faudra passer à un analyseur conforme — c'est noté dans
 * docs/ecrire-un-adaptateur.md.
 */
export function sanitizeHtml(input: string): string {
  if (!input) return '';

  let html = input;

  // 1. Supprimer les balises à contenu dangereux, contenu compris.
  for (const tag of VOID_CONTENT_TAGS) {
    html = html.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}\\s*>`, 'gi'), '');
    html = html.replace(new RegExp(`<${tag}\\b[^>]*/?>`, 'gi'), '');
  }

  // 2. Commentaires — peuvent masquer du balisage lors d'un re-parse.
  html = html.replace(/<!--[\s\S]*?-->/g, '');

  // 3. Filtrer chaque balise restante.
  return html.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g, (match, rawName: string, rawAttrs: string) => {
    const name = rawName.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return '';
    if (match.startsWith('</')) return `</${name}>`;

    const allowed = ALLOWED_ATTRS[name] ?? new Set<string>();
    const kept: string[] = [];

    const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(rawAttrs)) !== null) {
      const attr = m[1].toLowerCase();
      const value = m[2] ?? m[3] ?? m[4] ?? '';

      // Aucun gestionnaire d'événement, jamais.
      if (attr.startsWith('on')) continue;
      if (!allowed.has(attr) && !GLOBAL_ATTRS.has(attr)) continue;
      if ((attr === 'href' || attr === 'src' || attr === 'cite') && !isSafeUrl(value)) continue;
      // `srcset` contient plusieurs URL : si l'une est douteuse, on jette tout.
      if (attr === 'srcset' && !value.split(',').every((part) => isSafeUrl(part.trim().split(/\s+/)[0]))) continue;
      if (attr === 'target' && value !== '_blank') continue;

      kept.push(`${attr}="${value.replace(/"/g, '&quot;')}"`);
    }

    // Un lien qui ouvre un nouvel onglet sans `noopener` donne à la page cible
    // un accès en écriture à `window.opener`.
    if (name === 'a' && kept.some((a) => a.startsWith('target='))) {
      if (!kept.some((a) => a.startsWith('rel='))) kept.push('rel="noopener noreferrer"');
    }
    // Les images d'un corps d'article ne sont jamais au-dessus de la ligne de
    // flottaison : les charger paresseusement est toujours le bon défaut.
    if (name === 'img' && !kept.some((a) => a.startsWith('loading='))) {
      kept.push('loading="lazy"', 'decoding="async"');
    }

    const attrs = kept.length ? ` ${kept.join(' ')}` : '';
    return SELF_CLOSING.has(name) ? `<${name}${attrs}>` : `<${name}${attrs}>`;
  });
}
