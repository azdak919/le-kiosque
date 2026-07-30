/**
 * Jalon 4 — `kiosque doctor`
 *
 * Diagnostic local, sans réseau et sans backend. Dit ce qui manque pour
 * construire le site et ce qui est prêt pour une passation.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

import type { KiosqueConfig } from './config.ts';
import { mirrorExists, verifyMediaIntegrity } from './mirror.ts';

export type DoctorLevel = 'ok' | 'warn' | 'error';

export interface DoctorFinding {
  level: DoctorLevel;
  code: string;
  message: string;
  hint?: string;
}

export interface DoctorReport {
  root: string;
  findings: DoctorFinding[];
  ok: boolean;
}

function find(level: DoctorLevel, code: string, message: string, hint?: string): DoctorFinding {
  return { level, code, message, hint };
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function doctor(config: KiosqueConfig): Promise<DoctorReport> {
  const findings: DoctorFinding[] = [];
  const root = config.root;

  // Node
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 18)) {
    findings.push(
      find(
        'error',
        'node-version',
        `Node ${process.versions.node} — requis ≥ 22.18 (TypeScript effaçable)`,
        'Installer Node 22 LTS ou plus récent : https://nodejs.org/',
      ),
    );
  } else {
    findings.push(find('ok', 'node-version', `Node ${process.versions.node}`));
  }

  // Config
  const configPath = path.join(root, 'kiosque.config.ts');
  if (await pathExists(configPath)) {
    findings.push(find('ok', 'config', `configuration trouvée (${path.basename(configPath)})`));
  } else {
    findings.push(
      find(
        'error',
        'config',
        'kiosque.config.ts introuvable',
        'Copier examples/demo-journal/kiosque.config.ts ou lancer depuis la racine du journal',
      ),
    );
  }

  // Publication mirror
  const contentDir = path.join(root, 'content');
  const hasMirror = await mirrorExists(root);
  if (hasMirror) {
    findings.push(find('ok', 'mirror', `miroir content/ présent`));
  } else {
    findings.push(
      find(
        'warn',
        'mirror',
        'aucun miroir content/ — `kiosque build` échouera',
        'Lancer `kiosque sync` si un backend est configuré, ou copier un miroir Markdown existant',
      ),
    );
  }

  if (await pathExists(contentDir)) {
    const articlesDir = path.join(contentDir, 'articles');
    if (await pathExists(articlesDir)) {
      const articles: string[] = [];
      async function walk(dir: string) {
        for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
          const p = path.join(dir, ent.name);
          if (ent.isDirectory()) await walk(p);
          else if (ent.name.endsWith('.md')) articles.push(p);
        }
      }
      await walk(articlesDir);
      findings.push(
        find(
          articles.length ? 'ok' : 'warn',
          'articles',
          articles.length
            ? `${articles.length} article(s) dans le miroir`
            : 'miroir sans articles .md',
        ),
      );
    }
  }

  // Media integrity
  if (hasMirror) {
    const report = await verifyMediaIntegrity(root);
    if (report.ok) {
      findings.push(find('ok', 'media', 'intégrité des médias : OK'));
    } else {
      findings.push(
        find(
          'error',
          'media',
          `médias : ${report.missing.length} manquant(s), ${report.corrupted.length} corrompu(s)`,
          'Lancer `kiosque verify` pour le détail',
        ),
      );
    }
    if (report.untracked.length) {
      findings.push(
        find('warn', 'media-untracked', `${report.untracked.length} média(x) non suivi(s) dans le manifeste`),
      );
    }
  }

  // Dependencies (optional signal)
  const pkgPath = path.join(root, 'package.json');
  if (await pathExists(pkgPath)) {
    findings.push(find('ok', 'package', 'package.json présent'));
  } else {
    // Journal leaf may not have its own package if using global kiosque
    findings.push(
      find(
        'ok',
        'package',
        'pas de package.json local (OK si `kiosque` est installé globalement ou via le monorepo)',
      ),
    );
  }

  // Production deps check when package exists at monorepo root
  try {
    const require = createRequire(import.meta.url);
    require.resolve('yaml');
    require.resolve('marked');
    findings.push(find('ok', 'deps', 'dépendances de production yaml + marked résolubles'));
  } catch {
    findings.push(
      find(
        'error',
        'deps',
        'yaml ou marked introuvable',
        'Depuis le dépôt LE-KIOSQUE : npm install',
      ),
    );
  }

  // Deploy target awareness (no backend promise)
  if (config.deploy?.basePath !== undefined) {
    findings.push(
      find('ok', 'basePath', `basePath = ${JSON.stringify(config.deploy.basePath || '/')}`),
    );
  }

  const ok = !findings.some((f) => f.level === 'error');
  return { root, findings, ok };
}

export function formatDoctorReport(report: DoctorReport): string {
  const icon = { ok: '✓', warn: '!', error: '✗' } as const;
  const lines = [
    `LE KIOSQUE — doctor`,
    `racine : ${report.root}`,
    '',
    ...report.findings.map((f) => {
      const head = `  ${icon[f.level]} [${f.code}] ${f.message}`;
      return f.hint ? `${head}\n      → ${f.hint}` : head;
    }),
    '',
    report.ok
      ? 'Résultat : prêt pour `kiosque build` (corriger les avertissements si besoin).'
      : 'Résultat : des erreurs bloquent la construction — voir ci-dessus.',
  ];
  return lines.join('\n');
}
