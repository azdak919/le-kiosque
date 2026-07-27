#!/usr/bin/env node
/**
 * LE KIOSQUE — interface en ligne de commande.
 *
 *   kiosque sync     rapatrie le contenu du backend vers le miroir  (parle au CMS)
 *   kiosque build    produit le site statique depuis le miroir      (ne parle à rien)
 *   kiosque deploy   publie dist/                                    (à venir, jalon 4)
 *   kiosque export   archive complète, portable                      (à venir, jalon 4)
 *
 * `build` fonctionne toujours, même sans backend configuré, même sans réseau.
 * C'est la propriété qui fait vivre un journal au-delà de ses fondateurs.
 */

import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createConsoleLogger } from '../../core/src/source.ts';
import { loadAdapter, knownAdapters } from './adapters.ts';
import { build, EmptyingError } from './build.ts';
import { sync, BackendUnavailableError } from './sync.ts';
import { mirrorExists, verifyMediaIntegrity } from './mirror.ts';
import { renderCmsConfig } from './cms-config.ts';
import { normalizeBasePath, type KiosqueConfig } from './config.ts';

const log = createConsoleLogger('kiosque');

const USAGE = `
Le Kiosque — socle libre pour les journaux étudiants

  kiosque sync    [--since <date>] [--dry-run]   rapatrie le contenu du backend
  kiosque build   [--allow-deletions] [--out <dir>]  produit le site statique
  kiosque verify                                  vérifie l'intégrité du miroir
  kiosque cms:config                              régénère admin/config.yml

Options communes
  --root <dir>    racine du journal (défaut : dossier courant)
  --config <file> fichier de configuration (défaut : <root>/kiosque.config.ts)

Adaptateurs disponibles : ${knownAdapters().join(', ')}
`;

interface Args {
  command: string;
  root: string;
  config?: string;
  out?: string;
  since?: string;
  dryRun: boolean;
  allowDeletions: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    command: argv[0] ?? 'help',
    root: process.cwd(),
    dryRun: false,
    allowDeletions: false,
  };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') args.root = path.resolve(argv[++i]);
    else if (a === '--config') args.config = path.resolve(argv[++i]);
    else if (a === '--out') args.out = path.resolve(argv[++i]);
    else if (a === '--since') args.since = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--allow-deletions') args.allowDeletions = true;
    else if (a === '--help' || a === '-h') args.command = 'help';
  }
  return args;
}

async function loadConfig(args: Args): Promise<KiosqueConfig> {
  const file = args.config ?? path.join(args.root, 'kiosque.config.ts');
  const module = (await import(pathToFileURL(file).href)) as { default?: Partial<KiosqueConfig> };
  const raw = module.default;
  if (!raw) throw new Error(`${file} doit exporter une configuration par défaut`);

  const root = raw.root ? path.resolve(path.dirname(file), raw.root) : path.dirname(file);
  return {
    ...raw,
    root,
    source: raw.source ?? { adapter: 'markdown' },
    deploy: { ...raw.deploy, basePath: normalizeBasePath(raw.deploy?.basePath) },
  } as KiosqueConfig;
}

/**
 * Reconstruit le paquet de contenu SANS toucher au backend, en relisant le
 * miroir avec l'adaptateur Markdown. C'est ce que fait `build` quel que soit le
 * backend configuré : le miroir est toujours du Markdown, par construction.
 */
async function readBundleFromMirror(config: KiosqueConfig) {
  const { MarkdownSource } = await import('../../adapters/markdown/src/index.ts');
  const { createSourceContext } = await import('../../core/src/source.ts');

  const source = new MarkdownSource();
  await source.init({ root: config.root }, createSourceContext({ logger: log }));

  const articles = [];
  for await (const a of source.fetchArticles()) articles.push(a);

  return {
    publication: await source.fetchPublication(),
    authors: await source.fetchAuthors(),
    taxonomies: await source.fetchTaxonomies(),
    articles,
    syncedAt: new Date().toISOString(),
  };
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  if (args.command === 'help') {
    console.log(USAGE);
    return 0;
  }

  const config = await loadConfig(args);

  switch (args.command) {
    case 'sync': {
      const source = await loadAdapter(config.source.adapter);
      try {
        await sync({
          config,
          source,
          since: args.since,
          dryRun: args.dryRun,
          logger: log,
        });
        return 0;
      } catch (err) {
        if (err instanceof BackendUnavailableError) {
          log.error(err.message);
          // Code 2 : distinct d'une erreur de programme. Un workflow peut ainsi
          // décider de continuer et de construire quand même depuis le miroir.
          return 2;
        }
        throw err;
      }
    }

    case 'build': {
      if (!(await mirrorExists(config.root))) {
        log.error(`aucun miroir dans ${config.root}/content — lancer « kiosque sync » d’abord`);
        return 1;
      }
      const bundle = await readBundleFromMirror(config);
      const outDir = args.out ?? path.join(config.root, 'dist');
      try {
        const result = await build({
          config,
          bundle,
          outDir,
          allowDeletions: args.allowDeletions,
          logger: log,
        });
        log.info(`site produit dans ${result.outDir}`);
        return 0;
      } catch (err) {
        if (err instanceof EmptyingError) {
          log.error(err.message);
          return 3;
        }
        throw err;
      }
    }

    case 'cms:config': {
      if (!(await mirrorExists(config.root))) {
        log.error(`aucun miroir dans ${config.root}/content`);
        return 1;
      }
      const bundle = await readBundleFromMirror(config);
      const yaml = renderCmsConfig({
        config,
        bundle,
        authBaseUrl: config.cms?.authBaseUrl,
        branch: config.cms?.branch,
      });
      // Sur la sortie standard : utile pour inspecter ou rediriger. `build`
      // écrit la vraie copie dans dist/admin/.
      process.stdout.write(yaml);
      return 0;
    }

    case 'verify': {
      const report = await verifyMediaIntegrity(config.root);
      if (report.ok) {
        log.info('intégrité du miroir : aucun média manquant ni corrompu');
      } else {
        for (const m of report.missing) log.error(`média manquant : ${m}`);
        for (const c of report.corrupted) log.error(`média corrompu : ${c}`);
      }
      for (const u of report.untracked) log.warn(`média non suivi : ${u}`);
      return report.ok ? 0 : 1;
    }

    default:
      log.error(`commande inconnue : ${args.command}`);
      console.log(USAGE);
      return 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    log.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
    process.exit(1);
  });
