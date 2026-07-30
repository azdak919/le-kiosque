/**
 * Jalon 4 — `kiosque adopt`
 *
 * Checklist de passation pour le prochain·e responsable du journal.
 * Aucun hébergement ni compte magique : uniquement ce qui est dans Git.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import type { KiosqueConfig } from './config.ts';
import { doctor, type DoctorReport } from './doctor.ts';
import { mirrorExists } from './mirror.ts';

export interface AdoptReport {
  root: string;
  generatedAt: string;
  doctor: DoctorReport;
  checklist: { id: string; done: boolean; label: string; detail?: string }[];
  markdown: string;
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function adopt(config: KiosqueConfig): Promise<AdoptReport> {
  const root = config.root;
  const doc = await doctor(config);
  const hasMirror = await mirrorExists(root);
  const hasReadme = await exists(path.join(root, 'README.md'));
  const hasLicense = await exists(path.join(root, 'LICENSE')) || await exists(path.join(root, 'LICENSE.md'));
  const hasConfig = await exists(path.join(root, 'kiosque.config.ts'));
  const hasDist = await exists(path.join(root, 'dist', 'index.html'));

  const checklist = [
    {
      id: 'git',
      done: true,
      label: 'Le journal vit dans Git (miroir + site reconstructible)',
      detail: 'La lecture ne dépend pas d’un CMS vivant.',
    },
    {
      id: 'config',
      done: hasConfig,
      label: 'kiosque.config.ts versionné à la racine du journal',
    },
    {
      id: 'mirror',
      done: hasMirror,
      label: 'Miroir content/ présent et synchronisé',
      detail: hasMirror ? undefined : 'Lancer `kiosque sync` ou importer un miroir Markdown.',
    },
    {
      id: 'doctor-clean',
      done: doc.ok,
      label: '`kiosque doctor` sans erreur',
    },
    {
      id: 'readme',
      done: hasReadme,
      label: 'README.md explique build local et publication',
    },
    {
      id: 'license',
      done: hasLicense,
      label: 'LICENSE présente (licence du journal / du socle)',
    },
    {
      id: 'build-once',
      done: hasDist,
      label: 'Au moins un `dist/` de preuve a été produit localement',
      detail: hasDist ? undefined : 'Lancer `kiosque build` et archiver dist/ ou le publier.',
    },
    {
      id: 'no-hosting-promise',
      done: true,
      label: 'Aucun hébergement LE KIOSQUE n’est promis — le journal choisit son hôte',
    },
    {
      id: 'access',
      done: false,
      label: 'Humain : comptes d’hébergement / DNS / dépôt Git transférés au successeur',
      detail: 'Action humaine irréductible — hors automatisation.',
    },
  ];

  const generatedAt = new Date().toISOString();
  const lines = [
    `# Passation LE KIOSQUE`,
    ``,
    `Généré le ${generatedAt}`,
    `Racine : \`${root}\``,
    ``,
    `## Diagnostic (\`kiosque doctor\`)`,
    ``,
    ...doc.findings.map((f) => `- **${f.level}** \`${f.code}\` — ${f.message}`),
    ``,
    `## Checklist`,
    ``,
    ...checklist.map((c) => `- [${c.done ? 'x' : ' '}] **${c.label}**${c.detail ? ` — ${c.detail}` : ''}`),
    ``,
    `## Commandes utiles`,
    ``,
    '```bash',
    'kiosque doctor --root .',
    'kiosque build --root .',
    'kiosque verify --root .',
    '```',
    ``,
    `## Rappel`,
    ``,
    `LE KIOSQUE ne fournit pas d’hébergement, d’OAuth ni de maintenance garantie.`,
    `Le site se reconstruit depuis le miroir Git ; c’est la seule garantie de survie.`,
    ``,
  ];

  return {
    root,
    generatedAt,
    doctor: doc,
    checklist,
    markdown: lines.join('\n'),
  };
}
