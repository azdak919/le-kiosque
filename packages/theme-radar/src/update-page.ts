/**
 * Page Mise à jour, deux lignes : Socle et Kiosque.
 *
 * Elle vit dans la même coquille que l'administration (barre latérale,
 * feuille admin.css) : une page à part, sans style, donnait l'impression d'une
 * erreur. Elle n'appelle pas le réseau : le build ne parle à personne, et la
 * version proposée est inscrite au moment du build.
 *
 * Comment une mise à jour arrive vraiment :
 *  - Kiosque : la pull request de plateforme (`maj-plateforme.yml`). Fusionner
 *    l'applique, « Revert » la retire. Le contenu du journal n'est jamais réécrit.
 *  - Socle : la page Mise à jour du socle lui-même (`/admin/mise-a-jour` sur le
 *    serveur du journal), qui sauvegarde le programme avant et permet de revenir.
 * Dans la démo (mode `demo-local`), le bouton n'agit que sur la copie de ce
 * navigateur et le dit.
 */

import { adminShell } from './local-admin.ts';
import { esc } from './templates.ts';

export interface UpdateLine {
  id: 'socle' | 'kiosque';
  title: string;
  installed: string;
  offered: string | null;
  notes: string;
  /** Commit épinglé (socle). */
  commit?: string | null;
  /** Lien qui propose la nouvelle version en un clic (workflow GitHub du journal). */
  actionHref?: string | null;
}

export function updatePage(options: {
  lang: string;
  publicationName: string;
  backHref: string;
  lines: UpdateLine[];
  /** `/admin` préfixé du basePath. Déduit de `backHref` si absent. */
  adminBasePath?: string;
  publicBasePath?: string;
  cssHref?: string;
  mode?: 'demo-local' | 'git-sveltia' | 'external';
  /** Origine du socle du journal, s'il en a un. Pas un secret. */
  socleUrl?: string;
}): string {
  const fr = !options.lang.toLowerCase().startsWith('en');
  const adminBasePath = options.adminBasePath ?? options.backHref.replace(/\/+$/, '');
  const publicBasePath = options.publicBasePath ?? adminBasePath.replace(/\/admin$/, '');
  const cssHref = options.cssHref ?? `${publicBasePath}/assets/kiosque-admin.css`;
  const demo = options.mode === 'demo-local';
  const copy = fr
    ? {
      title: 'Mise à jour',
      lede: 'Deux pièces se mettent à jour séparément : le Socle, qui garde les données de la rédaction, et le Kiosque, qui construit le journal.',
      roles: { socle: 'L’admin de rédaction et son serveur : articles, photos, comptes, relecture.', kiosque: 'Le site, l’administration et le configurateur.' },
      installed: 'Version en place',
      offered: 'Version proposée',
      none: 'Aucune version proposée.',
      current: 'Rien à appliquer',
      available: 'Mise à jour offerte',
      backup: 'Sauvegarde du programme, avant',
      boundary: 'Le contenu du journal n’est pas dans cette sauvegarde : content/, media/, theme/tokens.css, kiosque.config.ts, OWNERS.md.',
      button: demo ? 'Simuler la mise à jour dans ce navigateur' : 'Mettre à jour',
      major: 'Je confirme la version majeure',
      how: 'Comment une mise à jour arrive',
      steps: [
        'Kiosque : chaque semaine, le dépôt du journal reçoit une pull request « Mise à jour de la plateforme ». La fusionner applique la mise à jour ; le bouton « Revert » de GitHub la retire.',
        'Socle (l’admin de rédaction) : le bouton « Proposer la dernière version du socle » lance le workflow « Mise à jour du socle » du dépôt. Il écrit une sauvegarde (le commit d’avant), puis ouvre une pull request. La fusionner applique la mise à jour ; « Revert », ou relancer le workflow avec le commit d’avant, revient en arrière.',
        options.socleUrl
          ? `Socle sur un serveur : ouvrez la <a href="${esc(options.socleUrl.replace(/\/+$/, ''))}/admin/mise-a-jour">page Mise à jour de votre socle</a>. Elle sauvegarde le programme avant d’appliquer et garde un bouton pour revenir.`
          : 'Socle sur un serveur : si votre journal a un socle, sa propre page /admin/mise-a-jour sauvegarde le programme avant d’appliquer et garde un bouton pour revenir. Sans socle, rien à faire.',
        'Rien n’est poussé de force : une mise à jour est proposée, vous l’acceptez ou vous l’ignorez.',
      ],
      stay: demo
        ? 'Cette page s’applique à la copie de ce navigateur. Elle n’envoie pas le journal. La démonstration en ligne suit toujours la dernière version du Kiosque.'
        : 'Cette page n’appelle aucun service. Sans réseau, seule la version en place est affichée. Un journal sans serveur reçoit le Kiosque par la pull request de plateforme. Sur un hébergement qui reçoit un dossier, le bouton du socle prépare ce dossier et nomme l’endroit déjà utilisé.',
      noteDemo: 'Mode démonstration local — données conservées dans ce navigateur.',
      noteStatic: 'Cette page est statique : elle décrit l’état au moment de la dernière publication.',
      majorWait: 'Une majeure attend un oui de plus. La version en place reste.',
      ok: demo ? 'Mise à jour simulée dans ce navigateur. Le contenu du journal n’a pas été réécrit.' : 'La mise à jour a réussi. Le contenu du journal n’a pas été réécrit.',
      commit: 'Commit épinglé',
      propose: 'Proposer la dernière version du socle',
    }
    : {
      title: 'Update',
      lede: 'Two pieces update separately: the Socle, which keeps the newsroom data, and the Kiosque, which builds the journal.',
      roles: { socle: 'The editorial admin and its server: articles, photos, accounts, review.', kiosque: 'The site, the admin and the configurator.' },
      installed: 'Installed version',
      offered: 'Offered version',
      none: 'No offered version.',
      current: 'Nothing to apply',
      available: 'Update available',
      backup: 'Program backup, before',
      boundary: 'The journal content is not in this backup: content/, media/, theme/tokens.css, kiosque.config.ts, OWNERS.md.',
      button: demo ? 'Simulate the update in this browser' : 'Update',
      major: 'I confirm the major version',
      how: 'How an update arrives',
      steps: [
        'Kiosque: every week, the journal repository receives a “platform update” pull request. Merging applies it; GitHub’s “Revert” button removes it.',
        'Socle (the editorial admin): the “Offer the latest socle” button runs the repository’s “Mise à jour du socle” workflow. It writes a backup (the previous commit), then opens a pull request. Merging applies it; “Revert”, or running the workflow again with the previous commit, goes back.',
        options.socleUrl
          ? `Socle: open the <a href="${esc(options.socleUrl.replace(/\/+$/, ''))}/admin/mise-a-jour">update page of your socle</a>. It backs up the program first and keeps a way back.`
          : 'Socle: if your journal has a socle, its own /admin/mise-a-jour page backs up the program first and keeps a way back.',
        'Nothing is forced: an update is offered, you accept it or ignore it.',
      ],
      stay: 'This page applies to the copy in this browser. It does not upload the journal. Without a network, only the installed version is shown.',
      noteDemo: 'Local demo mode — data kept in this browser.',
      noteStatic: 'This page is static: it describes the state at the last publication.',
      majorWait: 'A major version waits for another yes. The installed version stays.',
      ok: 'The update succeeded. The journal content was not rewritten.',
      commit: 'Pinned commit',
      propose: 'Offer the latest socle',
    };
  const data = JSON.stringify(options.lines).replace(/</g, '\\u003c');
  const blocks = options.lines.map((line) => {
    const state = line.offered ? 'offered' : 'current';
    const offer = line.offered
      ? `<dt>${copy.offered}</dt><dd>${esc(line.offered)}</dd></dl>${line.notes ? `<p class="notes">${esc(line.notes)}</p>` : ''}<p class="update-boundary">${copy.backup} : ${esc(line.id)}-${esc(line.installed)}-vers-${esc(line.offered)}.json. ${copy.boundary}</p>`
      : `</dl><p class="notes">${copy.none}</p>`;
    const pin = line.commit ? `<dt>${copy.commit}</dt><dd><code>${esc(line.commit.slice(0, 7))}</code></dd>` : '';
    const action = line.actionHref && !demo ? `<p class="noprint"><a class="button primary" data-propose="${esc(line.id)}" href="${esc(line.actionHref)}" rel="noopener">${copy.propose}</a></p>` : '';
    return `<article class="update-line" data-line="${esc(line.id)}"><header><div><h3>${esc(line.title)}</h3><p class="role">${copy.roles[line.id] ?? ''}</p></div><span class="update-badge" data-state="${state}">${line.offered ? copy.available : copy.current}</span></header><dl><dt>${copy.installed}</dt><dd><span data-installed="${esc(line.id)}">${esc(line.installed)}</span></dd>${pin}${offer}${action}</article>`;
  }).join('\n');
  const main = `<section class="panel">
<h2>${copy.title}</h2>
<p class="lede">${copy.lede}</p>
<div class="update-lines">
${blocks}
</div>
<form class="update-form noprint" method="post" action="">
<p class="major" hidden><label><input type="checkbox" name="confirmMajor" value="1"> ${copy.major}</label></p>
<button type="submit" class="primary">${copy.button}</button>
<p id="result" role="status"></p>
</form>
<div class="update-steps"><h3>${copy.how}</h3><ol>${copy.steps.map((step) => `<li>${step}</li>`).join('')}</ol></div>
<p class="update-boundary">${copy.stay}</p>
<p class="noprint"><a href="${esc(options.backHref)}">${fr ? 'Retour' : 'Back'}</a></p>
</section>`;
  const script = `<script>
(function () {
  var lines = ${data};
  var store = {};
  try { store = JSON.parse(localStorage.getItem('kiosque-maj') || '{}'); } catch (e) { store = {}; }
  lines.forEach(function (line) {
    var node = document.querySelector('[data-installed="' + line.id + '"]');
    if (node && store[line.id]) node.textContent = store[line.id];
  });
  var form = document.querySelector('.update-form');
  if (!lines.some(function (line) { return line.offered; })) form.querySelector('button').hidden = true;
  var major = lines.some(function (line) {
    if (!line.offered) return false;
    var here = (store[line.id] || line.installed).split('.')[0];
    return here !== String(line.offered).split('.')[0];
  });
  var box = form.querySelector('.major');
  if (box && major) box.hidden = false;
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var result = document.getElementById('result');
    var offered = lines.filter(function (line) { return line.offered; });
    if (!offered.length) { result.textContent = ${JSON.stringify(copy.none)}; return; }
    if (major && !form.confirmMajor.checked) {
      result.textContent = ${JSON.stringify(copy.majorWait)};
      return;
    }
    offered.forEach(function (line) {
      store[line.id] = line.offered;
      var node = document.querySelector('[data-installed="' + line.id + '"]');
      if (node) node.textContent = line.offered;
    });
    try { localStorage.setItem('kiosque-maj', JSON.stringify(store)); } catch (e) {}
    result.textContent = ${JSON.stringify(copy.ok)};
  });
})();
</script>`;
  return adminShell({
    lang: fr ? 'fr' : 'en',
    title: copy.title,
    publicationName: options.publicationName,
    publicBasePath,
    adminBasePath,
    cssHref,
    active: 'update',
    note: demo ? copy.noteDemo : copy.noteStatic,
    main,
    scripts: script,
  });
}
