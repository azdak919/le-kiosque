// Propose une nouvelle version du socle (dépendance `le-socle`, épinglée sur
// un commit). Usage : node tools/maj-socle.mjs <commit> [--racine <dossier>]
//
// - Écrit d'abord la sauvegarde `sauvegardes/socle-<avant>-vers-<après>.json`
//   (commit et version d'avant). Si elle ne s'écrit pas, rien ne change.
// - Puis épingle le nouveau commit (`npm install --save-exact`).
// - Revenir : relancer avec le commit d'avant, noté dans la sauvegarde.
// Le contenu du journal (content/, media/, …) n'est jamais touché.
// Lancé par le workflow « Mise à jour du socle » (.github/workflows/maj-socle.yml).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOCLE_REPO = 'github:azdak919/le-socle';
const COMMIT = /^[0-9a-f]{40}$/;

/** Commit épinglé dans package.json, ou null. */
export function readPin(pkg) {
  const spec = pkg.dependencies?.['le-socle'] ?? '';
  const match = /^github:azdak919\/le-socle#([0-9a-f]{40})$/.exec(spec);
  return match ? match[1] : null;
}

/** Ce qu'il faut faire, sans rien écrire. */
export function plan(current, target) {
  if (!COMMIT.test(String(target))) throw new Error('Le commit du socle doit avoir 40 caractères hexadécimaux.');
  if (current === target) return { change: false };
  const short = (sha) => (sha ? sha.slice(0, 7) : 'aucun');
  return { change: true, from: current, to: target, backup: `sauvegardes/socle-${short(current)}-vers-${short(target)}.json` };
}

export function update(root, target, { now = new Date(), install } = {}) {
  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const current = readPin(pkg);
  const step = plan(current, target);
  if (!step.change) return step;
  const installed = (() => {
    try { return JSON.parse(readFileSync(path.join(root, 'node_modules/le-socle/package.json'), 'utf8')).version; } catch { return null; }
  })();
  mkdirSync(path.join(root, 'sauvegardes'), { recursive: true });
  writeFileSync(path.join(root, step.backup), `${JSON.stringify({
    piece: 'socle', avant: { commit: current, version: installed }, apres: { commit: target },
    date: now.toISOString(),
    revenir: current ? `node tools/maj-socle.mjs ${current}` : null,
  }, null, 2)}\n`);
  (install ?? ((spec) => execFileSync('npm', ['install', '--save-exact', '--ignore-scripts', `le-socle@${spec}`], { cwd: root, stdio: 'inherit' })))(`${SOCLE_REPO}#${target}`);
  const after = JSON.parse(readFileSync(pkgPath, 'utf8'));
  if (readPin(after) !== target) throw new Error('Le nouveau commit du socle n’a pas été épinglé.');
  return step;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--racine');
  const root = at >= 0 ? path.resolve(args[at + 1]) : process.cwd();
  const target = args.find((arg, index) => !arg.startsWith('--') && !(at >= 0 && index === at + 1));
  const result = update(root, target);
  if (!result.change) console.log('Le socle est déjà à ce commit. Rien à faire.');
  else console.log(`Socle : ${result.from ?? 'aucun'} → ${result.to}. Sauvegarde : ${result.backup}`);
  if (process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT, `change=${result.change}\nfrom=${result.from ?? ''}\nbackup=${result.backup ?? ''}\n`, { flag: 'a' });
}
