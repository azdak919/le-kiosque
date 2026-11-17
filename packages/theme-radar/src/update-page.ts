/**
 * Page Mise à jour, deux lignes : Socle et Kiosque.
 *
 * Le bouton s'applique à la copie de ce navigateur. Il ne lit pas le journal
 * et ne l'envoie nulle part. `content/`, `media/`, `theme/tokens.css`,
 * `kiosque.config.ts` et `OWNERS.md` ne font pas partie de cette sauvegarde.
 */

import { esc } from './templates.ts';

export interface UpdateLine {
  id: 'socle' | 'kiosque';
  title: string;
  installed: string;
  offered: string | null;
  notes: string;
}

export function updatePage(options: {
  lang: string;
  publicationName: string;
  backHref: string;
  lines: UpdateLine[];
}): string {
  const fr = !options.lang.toLowerCase().startsWith('en');
  const copy = fr
    ? {
      title: 'Mise à jour',
      skip: 'Aller au contenu',
      back: 'Retour',
      installed: 'Version en place',
      offered: 'Version proposée',
      none: 'Aucune version proposée.',
      backup: 'Sauvegarde du programme, avant',
      boundary: 'Le contenu du journal n’est pas dans cette sauvegarde : content/, media/, theme/tokens.css, kiosque.config.ts, OWNERS.md.',
      button: 'Mettre à jour',
      major: 'Je confirme la version majeure',
      stay: 'Cette page s’applique à la copie de ce navigateur. Elle n’envoie pas le journal. Sans réseau, seule la version en place est affichée. Un journal sans serveur reçoit le Kiosque par la pull request de plateforme. Sur un hébergement qui reçoit un dossier, le bouton du socle prépare ce dossier et nomme l’endroit déjà utilisé.',
    }
    : {
      title: 'Update',
      skip: 'Skip to content',
      back: 'Back',
      installed: 'Installed version',
      offered: 'Offered version',
      none: 'No offered version.',
      backup: 'Program backup, before',
      boundary: 'The journal content is not in this backup: content/, media/, theme/tokens.css, kiosque.config.ts, OWNERS.md.',
      button: 'Update',
      major: 'I confirm the major version',
      stay: 'This page applies to the copy in this browser. It does not upload the journal. Without a network, only the installed version is shown.',
    };
  const data = JSON.stringify(options.lines).replace(/</g, '\\u003c');
  const blocks = options.lines.map((line) => {
    const offer = line.offered
      ? `<p>${copy.offered} : ${esc(line.offered)}. ${esc(line.notes)}</p><p>${copy.backup} : ${esc(line.id)}-${esc(line.installed)}-vers-${esc(line.offered)}.json. ${copy.boundary}</p>`
      : `<p>${copy.none}</p>`;
    return `<h2>${esc(line.title)}</h2><p>${copy.installed} : <span data-installed="${esc(line.id)}">${esc(line.installed)}</span>.</p>${offer}`;
  }).join('\n');
  return `<!DOCTYPE html>
<html lang="${esc(fr ? 'fr' : 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${copy.title} — ${esc(options.publicationName)}</title>
<style>
  body { font-family: sans-serif; line-height: 1.45; color: #111; background: #fff; }
  a:focus, button:focus, input:focus { outline: 3px solid #111; outline-offset: 2px; }
  .skip { position: absolute; left: -999px; }
  .skip:focus { left: 0.5rem; top: 0.5rem; background: #fff; }
  @page letter { size: letter; } @page legal { size: legal; } @page tabloid { size: tabloid; }
  @page a4 { size: A4; } @page a3 { size: A3; }
  main { page: letter; }
  @media print { .noprint { display: none; } }
</style>
</head>
<body>
<a class="skip" href="#contenu">${copy.skip}</a>
<main id="contenu">
<h1>${copy.title}</h1>
${blocks}
<form class="noprint" method="post" action="">
<p class="major" hidden><label><input type="checkbox" name="confirmMajor" value="1"> ${copy.major}</label></p>
<p><button type="submit">${copy.button}</button></p>
<p id="result" role="status"></p>
</form>
<p>${copy.stay}</p>
</main>
<p class="noprint"><a href="${esc(options.backHref)}">${copy.back}</a></p>
<script>
(function () {
  var lines = ${data};
  var store = {};
  try { store = JSON.parse(localStorage.getItem('kiosque-maj') || '{}'); } catch (e) { store = {}; }
  lines.forEach(function (line) {
    var node = document.querySelector('[data-installed="' + line.id + '"]');
    if (node && store[line.id]) node.textContent = store[line.id];
  });
  var form = document.querySelector('form');
  if (!lines.some(function (line) { return line.offered; })) form.querySelector('button').hidden = true;
  var major = lines.some(function (line) {
    if (!line.offered) return false;
    var here = (store[line.id] || line.installed).split('.')[0];
    return here !== String(line.offered).split('.')[0];
  });
  var box = document.querySelector('.major');
  if (box && major) box.hidden = false;
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var result = document.getElementById('result');
    var offered = lines.filter(function (line) { return line.offered; });
    if (!offered.length) { result.textContent = ${JSON.stringify(copy.none)}; return; }
    if (major && !form.confirmMajor.checked) {
      result.textContent = ${JSON.stringify(fr ? 'Une majeure attend un oui de plus. La version en place reste.' : 'A major version waits for another yes. The installed version stays.')};
      return;
    }
    offered.forEach(function (line) {
      store[line.id] = line.offered;
      var node = document.querySelector('[data-installed="' + line.id + '"]');
      if (node) node.textContent = line.offered;
    });
    try { localStorage.setItem('kiosque-maj', JSON.stringify(store)); } catch (e) {}
    result.textContent = ${JSON.stringify(fr ? 'La mise à jour a réussi. Le contenu du journal n’a pas été réécrit.' : 'The update succeeded. The journal content was not rewritten.')};
  });
})();
</script>
</body>
</html>`;
}
