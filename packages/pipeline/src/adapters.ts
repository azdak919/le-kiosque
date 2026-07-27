/**
 * LE KIOSQUE — registre des adaptateurs.
 *
 * Le SEUL fichier à modifier pour brancher un nouveau backend. Le reste du
 * pipeline ne connaît que l'interface `ContentSource`.
 *
 * Les adaptateurs sont chargés paresseusement : un journal sous Markdown ne doit
 * jamais avoir à installer les dépendances de l'adaptateur WordPress, ni subir
 * une panne de celui-ci.
 */

import type { ContentSource } from '../../core/src/source.ts';

type Loader = () => Promise<ContentSource<never>>;

const REGISTRY: Record<string, Loader> = {
  markdown: async () => {
    const { MarkdownSource } = await import('../../adapters/markdown/src/index.ts');
    return new MarkdownSource() as unknown as ContentSource<never>;
  },

  // ── Jalon 4 : décommenter une fois l'adaptateur conforme au testkit ──
  // wordpress: async () => {
  //   const { WordPressSource } = await import('../../adapters/wordpress/src/index.ts');
  //   return new WordPressSource() as unknown as ContentSource<never>;
  // },
};

export function knownAdapters(): string[] {
  return Object.keys(REGISTRY);
}

export async function loadAdapter(id: string): Promise<ContentSource<never>> {
  const loader = REGISTRY[id];
  if (!loader) {
    throw new Error(
      `Adaptateur inconnu : « ${id} ». Disponibles : ${knownAdapters().join(', ')}.\n` +
        `  Pour en ajouter un, voir docs/ecrire-un-adaptateur.md`,
    );
  }
  return loader();
}
