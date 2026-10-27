#!/usr/bin/env node
/**
 * Construit le kit portable LE KIOSQUE : gabarit + outils + Node embarqué +
 * site d'exemple déjà construit, dans dist-kit/. Seule cette construction
 * télécharge (Node, une fois, mis en cache); le kit, lui, fonctionne hors ligne.
 *
 *   node tools/kit/build-kit.mjs [--plateformes linux-x64,win-x64,...]
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(REPO, 'dist-kit');
const KIT = path.join(OUT, 'le-kiosque-kit');
const CACHE = path.join(REPO, '.cache', 'node');
const VERSION = process.env.KIOSQUE_NODE ?? process.version; // même Node que les tests
const arg = process.argv.indexOf('--plateformes');
const PLATS = (arg > 0 ? process.argv[arg + 1] : 'linux-x64,linux-arm64,darwin-arm64,darwin-x64,win-x64').split(',');

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(KIT, 'outils'), { recursive: true });

// 1. Le journal (gabarit) et la plateforme
fs.cpSync(path.join(REPO, 'template'), path.join(KIT, 'journal'), { recursive: true, filter: (s) => !s.includes(`${path.sep}.github`) });
fs.cpSync(path.join(REPO, 'packages'), path.join(KIT, 'packages'), { recursive: true });
for (const dep of ['yaml', 'marked']) fs.cpSync(path.join(REPO, 'node_modules', dep), path.join(KIT, 'node_modules', dep), { recursive: true });
fs.copyFileSync(path.join(REPO, 'LICENSE'), path.join(KIT, 'LICENSE'));

// 2. Outils et documents
const here = path.join(REPO, 'tools', 'kit');
fs.copyFileSync(path.join(here, 'installer.mjs'), path.join(KIT, 'outils', 'installer.mjs'));
for (const f of ['installer.sh', 'installer.cmd', 'GUIDE.md', 'FICHE-A-IMPRIMER.html']) fs.copyFileSync(path.join(here, f), path.join(KIT, f));
fs.chmodSync(path.join(KIT, 'installer.sh'), 0o755);

// 3. Node portable par plateforme (seul l'exécutable + sa licence)
fs.mkdirSync(CACHE, { recursive: true });
for (const p of PLATS) {
  const win = p.startsWith('win');
  const name = `node-${VERSION}-${p}`;
  const file = path.join(CACHE, `${name}.${win ? 'zip' : 'tar.xz'}`);
  if (!fs.existsSync(file)) run('curl', ['-fsSL', '-o', file, `https://nodejs.org/dist/${VERSION}/${path.basename(file)}`]);
  const tmp = fs.mkdtempSync(path.join(OUT, 'n-'));
  if (win) run('unzip', ['-q', file, `${name}/node.exe`, `${name}/LICENSE`, '-d', tmp]);
  else run('tar', ['-xJf', file, '-C', tmp, `${name}/bin/node`, `${name}/LICENSE`]);
  const dest = path.join(KIT, 'outils', `node-${p}`);
  fs.mkdirSync(dest, { recursive: true });
  const bin = win ? 'node.exe' : 'node';
  fs.renameSync(path.join(tmp, name, win ? bin : `bin/${bin}`), path.join(dest, bin));
  fs.renameSync(path.join(tmp, name, 'LICENSE'), path.join(dest, 'LICENSE'));
  fs.rmSync(tmp, { recursive: true });
}

// 4. Un site d'exemple déjà construit (servable tel quel depuis la clé)
run(process.execPath, [path.join(KIT, 'packages/pipeline/src/cli.ts'), 'build', '--root', path.join(KIT, 'journal'), '--out', path.join(KIT, 'site-exemple')]);

// 5. Archives : .zip (Windows/macOS) et .tar.gz (droits d'exécution conservés)
run('tar', ['-czf', path.join(OUT, 'le-kiosque-kit.tar.gz'), '-C', OUT, 'le-kiosque-kit']);
run('zip', ['-qr9', path.join(OUT, 'le-kiosque-kit.zip'), 'le-kiosque-kit'], { cwd: OUT });
for (const f of ['le-kiosque-kit.tar.gz', 'le-kiosque-kit.zip']) {
  console.log(`[kit] ${f} : ${(fs.statSync(path.join(OUT, f)).size / 1e6).toFixed(1)} Mo`);
}
