import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { SOCIAL_NETWORKS, socialHref, socialLinks, socialNavHtml } from '../packages/theme-radar/src/social.js';

test('réseaux sociaux : les dix réseaux, dans l’ordre de la Configuration', () => {
  assert.deepEqual(SOCIAL_NETWORKS.map((item) => item.id), ['instagram', 'facebook', 'tiktok', 'linkedin', 'threads', 'x', 'bluesky', 'mastodon', 'youtube', 'email']);
  // Mêmes tracés que LE-RADAR (nav-shell.js) : Simple Icons 16.36.0, Bootstrap Icons 1.13.2 pour LinkedIn.
  const path = (id: string) => SOCIAL_NETWORKS.find((item) => item.id === id)!.path;
  assert.ok(path('x').startsWith('M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258'));
  assert.ok(path('bluesky').startsWith('M5.202 2.857C7.954 4.922 10.913 9.11 12 11.358'));
  assert.ok(path('facebook').startsWith('M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58'));
  assert.ok(path('mastodon').startsWith('M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004'));
  assert.ok(path('linkedin').startsWith('M0 1.146C0 .513.526 0 1.175 0h13.65'));
});

test('réseaux sociaux : chaque exemple pâle passe sa propre vérification (attribut pattern, drapeau v)', () => {
  for (const item of SOCIAL_NETWORKS) {
    if (!item.pattern) continue;
    const re = new RegExp(`^(?:${item.pattern})$`, 'v');
    assert.ok(re.test(item.example), item.id);
  }
  const re = (id: string) => new RegExp(`^(?:${SOCIAL_NETWORKS.find((item) => item.id === id)!.pattern})$`, 'v');
  assert.equal(re('x').test('https://facebook.com/oups'), false);
  assert.equal(re('instagram').test('lavigie'), false);
  assert.equal(re('mastodon').test('https://piaille.fr/lavigie'), false);
});

test('réseaux sociaux : un réseau vide ou illisible n’est pas affiché', () => {
  assert.equal(socialNavHtml(undefined, 'La Vigie', 'site-foot__social'), '');
  assert.equal(socialNavHtml({ x: '  ', facebook: 'javascript:alert(1)', email: 'pas-un-courriel' }, 'La Vigie', 'site-foot__social'), '');
  assert.equal(socialHref('instagram', 'instagram.com/lavigie'), 'https://instagram.com/lavigie');
  assert.equal(socialHref('email', 'redaction@exemple.ca'), 'mailto:redaction@exemple.ca');
  assert.deepEqual(socialLinks({ youtube: 'https://www.youtube.com/@lavigie', facebook: 'https://www.facebook.com/lavigie' }).map((item) => item.id), ['facebook', 'youtube']);
});

test('réseaux sociaux : libellés accessibles, rel="me noopener", icônes cachées aux lecteurs d’écran', () => {
  const html = socialNavHtml({ instagram: 'https://www.instagram.com/lavigie', email: 'redaction@exemple.ca' }, 'La <Vigie>', 'masthead-social');
  assert.match(html, /^<nav class="social-links masthead-social" aria-label="La &lt;Vigie&gt; sur les réseaux sociaux">/);
  assert.match(html, /<a href="https:\/\/www\.instagram\.com\/lavigie" rel="me noopener" target="_blank" data-social="instagram" aria-label="La &lt;Vigie&gt; sur Instagram" title="Instagram"><svg [^>]*aria-hidden="true" focusable="false">/);
  assert.match(html, /<a href="mailto:redaction@exemple\.ca" rel="me noopener" data-social="email" aria-label="Écrire à La &lt;Vigie&gt; \(courriel\)"/);
});

test('réseaux sociaux : au mât et au pied de page, site statique et site vivant ; couleur principale au survol et au focus', () => {
  const templates = readFileSync(new URL('../packages/theme-radar/src/templates.ts', import.meta.url), 'utf8');
  assert.match(templates, /socialNavHtml\(pub\.social, pub\.name, 'masthead-social'\)/);
  assert.match(templates, /socialNavHtml\(pub\.social, pub\.name, 'site-foot__social'\)/);
  const live = readFileSync(new URL('../packages/theme-radar/assets/editorial/render.js', import.meta.url), 'utf8');
  assert.match(live, /import \{ socialNavHtml \} from '\.\/social\.js';/);
  const css = readFileSync(new URL('../packages/theme-radar/assets/theme.css', import.meta.url), 'utf8');
  assert.match(css, /\.social-links a \{[^}]*color: var\(--muted\)/);
  assert.match(css, /\.social-links a:hover \{ color: var\(--accent\)/);
  assert.match(css, /\.social-links a:focus-visible \{ outline: 2px solid var\(--accent\)[^}]*color: var\(--accent\)/);
  const build = readFileSync(new URL('../packages/pipeline/src/build.ts', import.meta.url), 'utf8');
  assert.match(build, /'social\.js'/);
});
