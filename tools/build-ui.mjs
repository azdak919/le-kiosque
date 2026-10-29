// Compile les interfaces d'outil (vitrine, configurateur, administration) avec
// Tailwind CSS v4 + Basecoat (MIT). On ne garde de Basecoat que les composants
// utilisés, pour garder des feuilles légères. Usage : npm run ui
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const bc = path.join(root, 'node_modules/basecoat-css/dist');
const wanted = ['Button', 'Badge', 'Card', 'Alert', 'Kbd'];
const vega = await readFile(path.join(bc, 'styles/vega.css'), 'utf8');
const sections = vega.split(/\n(?=  \/\* [A-Z][^*]*\*\/\n)/);
const kept = sections.filter((s) => wanted.some((w) => s.startsWith(`  /* ${w} */`)));
const components = await Promise.all(wanted.map((w) => readFile(path.join(bc, `components/${w.toLowerCase()}.css`), 'utf8')));
const version = JSON.parse(await readFile(path.join(root, 'node_modules/basecoat-css/package.json'), 'utf8')).version;
const out = `/* Extrait généré de basecoat-css ${version} (MIT, © hunvreus — github.com/hunvreus/basecoat).
   Ne pas éditer : régénéré par tools/build-ui.mjs. */
${await readFile(path.join(bc, 'base/base.css'), 'utf8')}
${components.join('\n')}
@layer components {
${kept.join('\n')}
}
`;
await mkdir(path.join(root, 'ui/vendor'), { recursive: true });
await writeFile(path.join(root, 'ui/vendor/basecoat-subset.css'), out);
const cli = path.join(root, 'node_modules/.bin/tailwindcss');
for (const [input, output] of [
  ['ui/admin.css', 'packages/theme-radar/assets/editorial/admin.css'],
  ['ui/site.css', 'site/assets/kiosque-ui.css'],
]) execFileSync(cli, ['-i', input, '-o', output, '--minify'], { cwd: root, stdio: 'inherit' });
