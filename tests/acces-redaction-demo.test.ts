import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  footBuiltHtml,
  homePage,
  mastheadDemoEditorialHtml,
  showDemoEditorialEntry,
  type RenderContext,
} from '../packages/theme-radar/src/templates.ts';
import type { Publication } from '../packages/core/src/model.ts';

const templates = readFileSync(new URL('../packages/theme-radar/src/templates.ts', import.meta.url), 'utf8');
const live = readFileSync(new URL('../packages/theme-radar/assets/editorial/render.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../packages/theme-radar/assets/theme.css', import.meta.url), 'utf8');
const site = readFileSync(new URL('../tools/build-site.mjs', import.meta.url), 'utf8');
const rootConfig = readFileSync(new URL('../kiosque.config.ts', import.meta.url), 'utf8');
const demoJournalConfig = readFileSync(new URL('../examples/demo-journal/kiosque.config.ts', import.meta.url), 'utf8');
const templateConfig = readFileSync(new URL('../template/kiosque.config.ts', import.meta.url), 'utf8');
const pipelineConfig = readFileSync(new URL('../packages/pipeline/src/config.ts', import.meta.url), 'utf8');

const publication = {
  id: 'p1',
  slug: 'le-quorum',
  name: 'Le Quorum',
  institution: 'Cégep de l’exemple',
  institutionType: 'cegep',
  lang: 'fr-CA',
  siteUrl: 'https://quorum.example',
  timeZone: 'America/Toronto',
  theme: { accent: '#6c2163' },
  governance: { owner: 'L’association' },
  masthead: { signature: 'On vote, on débat, on imprime' },
} as Publication;

function ctx(extra: Partial<RenderContext> = {}): RenderContext {
  return {
    publication,
    basePath: '',
    taxonomies: { sections: [], categories: [], tags: [] },
    authorsBySlug: new Map(),
    buildYear: 2026,
    ...extra,
  };
}

test('le drapeau demoEditorialEntry est désactivé par défaut et absent des configs d’un journal', () => {
  assert.match(pipelineConfig, /demoEditorialEntry\?: boolean;/);
  assert.match(rootConfig, /demoEditorialEntry:\s*true/);
  assert.match(site, /demoEditorialEntry:\s*true/);
  assert.doesNotMatch(demoJournalConfig, /demoEditorialEntry:\s*true/);
  assert.doesNotMatch(templateConfig, /demoEditorialEntry/);
});

test('sans le drapeau, le mât n’a pas de pastille et le pied reste discret', () => {
  const journal = ctx();
  assert.equal(showDemoEditorialEntry(journal), false);
  assert.equal(mastheadDemoEditorialHtml(journal), '');
  const html = homePage([], journal);
  assert.doesNotMatch(html, /masthead-demo-editorial/);
  assert.doesNotMatch(html, /Essayer l’espace de rédaction \(démo\)/);
  assert.match(html, />Espace de rédaction</);
  const foot = footBuiltHtml('/redaction/');
  assert.match(foot, />Espace de rédaction</);
  assert.doesNotMatch(foot, /\(démo\)/);
});

test('même avec le drapeau, un journal en mode serveur n’affiche pas la pastille de démo', () => {
  const vivant = ctx({
    demoEditorialEntry: true,
    redactionHref: '/redaction/',
    editorial: { mode: 'socle-vivant', assetsBase: '/assets/editorial', seedUrl: '', databaseKey: 'x' },
  });
  assert.equal(showDemoEditorialEntry(vivant), false);
  const html = homePage([], vivant);
  assert.doesNotMatch(html, /masthead-demo-editorial/);
  assert.doesNotMatch(html, /\(démo\)/);
  assert.match(html, />Espace de rédaction</);
});

test('avec le drapeau, la démo locale montre la pastille et les libellés explicites', () => {
  const demo = ctx({
    demoEditorialEntry: true,
    redactionHref: '/admin/',
    editorial: { mode: 'demo-local', assetsBase: '/assets/editorial', seedUrl: '/seed.json', databaseKey: 'quorum' },
  });
  assert.equal(showDemoEditorialEntry(demo), true);
  const html = homePage([], demo);
  assert.match(html, /class="masthead-demo-editorial"/);
  assert.match(html, /href="\/admin\/"/);
  assert.match(html, /Essayer l’espace de rédaction \(démo\)/);
  assert.match(html, /Espace de rédaction \(démo\)/);
  assert.match(html, /masthead-demo-editorial__icon/);
  // La pastille n’est pas un outil rond du mât.
  assert.doesNotMatch(html, /class="masthead-tool[^"]*masthead-demo-editorial/);
  assert.doesNotMatch(html, /class="masthead-demo-editorial masthead-tool/);
  const foot = footBuiltHtml('/admin/', true);
  assert.match(foot, /site-foot__redaction-full">Essayer l’espace de rédaction \(démo\)</);
  assert.match(foot, /site-foot__redaction-short">Espace de rédaction \(démo\)</);
  assert.ok(html.indexOf('masthead-demo-editorial') < html.indexOf('site-foot__redaction'));
});

test('le thème et le rendu vivant prévoient le libellé court au téléphone', () => {
  assert.match(css, /\.masthead-demo-editorial__short \{ display: none; \}/);
  assert.match(css, /@media \(max-width: 720px\) \{[\s\S]*?\.masthead-demo-editorial__full \{ display: none; \}/);
  assert.match(css, /@media \(max-width: 720px\) \{[\s\S]*?\.site-foot__redaction-short \{ display: inline; \}/);
  assert.match(templates, /showDemoEditorialEntry\(ctx\)/);
  assert.match(live, /demoEditorialEntryOn/);
  assert.match(live, /Essayer l’espace de rédaction \(démo\)/);
  assert.match(live, /editorial\.demoEditorialEntry === true/);
  assert.match(css, /site-foot__powered/);
});

test('le pied garde « Propulsé par » en une seule phrase, même au téléphone', () => {
  const foot = footBuiltHtml('/admin/', true);
  assert.match(foot, /<span class="site-foot__powered">[\s\S]*plateforme libre/);
  assert.doesNotMatch(foot, /> , plateforme/);
});
