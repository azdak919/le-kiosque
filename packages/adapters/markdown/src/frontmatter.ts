/**
 * LE KIOSQUE — lecture et écriture du front-matter YAML.
 *
 * On ANALYSE avec `yaml` (fiable), mais on ÉCRIT en insérant du texte. Une
 * re-sérialisation, même via l'API `Document`, normalise le repli des blocs,
 * l'espacement des collections et les guillemets : chaque fichier touché
 * produirait un diff de reformatage où la vraie modification se perdrait. Les
 * fichiers du gabarit portent en plus des commentaires pédagogiques qu'on ne
 * veut pas voir déplacés.
 *
 * Règle : n'écrire que ce qu'on doit écrire, et laisser le reste à l'octet près.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { parseDocument, type Document } from 'yaml';

const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export interface ParsedFile {
  /** Le document YAML du front-matter, éditable sans perte. */
  doc: Document;
  /** Le corps Markdown, tel quel. */
  body: string;
  /** Le fichier avait-il déjà un front-matter ? */
  hadFrontMatter: boolean;
  /** Fin de ligne d'origine — pour ne pas convertir un fichier Windows. */
  eol: '\n' | '\r\n';
}

export function parseFile(raw: string): ParsedFile {
  const text = raw.replace(/^\ufeff/, '');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const match = FM_RE.exec(text);
  if (!match) {
    return { doc: parseDocument('{}'), body: text.trim(), hadFrontMatter: false, eol };
  }
  return {
    doc: parseDocument(match[1]),
    body: text.slice(match[0].length).trim(),
    hadFrontMatter: true,
    eol,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Écrit `id` dans un fichier d'article qui n'en a pas, puis n'y touche plus
 * jamais.
 *
 * Pourquoi c'est nécessaire : sans `id` explicite, l'identité d'un article est
 * dérivée de son CHEMIN. Déplacer `articles/2026/09/x.md` vers `2026/10/`
 * lui donnerait une nouvelle identité, et le sync suivant le verrait comme un
 * article neuf — doublon dans les archives, doublon dans le flux, historique
 * cassé. Sveltia CMS crée justement des fichiers sans `id`.
 *
 * On écrit la valeur que l'adaptateur a déjà calculée : elle est déterministe,
 * donc le fichier et le paquet en mémoire s'accordent immédiatement.
 *
 * **Insertion textuelle, pas re-sérialisation.** On analyse le YAML pour savoir
 * si la clé existe, mais on écrit en insérant une seule ligne avant le `---`
 * de fermeture. Re-sérialiser normaliserait le repli des blocs, l'espacement
 * des collections et les guillemets : le diff se remplirait de reformatage et
 * la seule vraie modification y deviendrait invisible. Ici, le fichier est
 * garanti identique à l'octet près, à une ligne ajoutée.
 *
 * @returns true si le fichier a été modifié
 */
export async function freezeId(file: string, id: string): Promise<boolean> {
  if (!UUID_RE.test(id)) {
    // Garde-fou : une valeur inattendue devrait être citée pour rester du YAML
    // valide. Plutôt que de deviner l'échappement, on refuse.
    throw new Error(`identifiant non conforme, écriture refusée : ${id}`);
  }

  const raw = await readFile(file, 'utf8');
  const parsed = parseFile(raw);
  if (!parsed.hadFrontMatter) throw new Error('fichier sans front-matter');
  if (parsed.doc.has('id')) return false;

  const text = raw.replace(/^\ufeff/, '');
  const match = FM_RE.exec(text);
  if (!match) throw new Error('front-matter introuvable');

  // Fin du bloc YAML = position du `---` de fermeture dans la correspondance.
  const closing = match[0].lastIndexOf('---');
  const before = text.slice(0, closing);
  const after = text.slice(closing);
  const eol = parsed.eol;

  await writeFile(file, `${before}id: ${id}${eol}${after}`, 'utf8');
  return true;
}
