import { marked } from './marked.esm.js';
import { getBackend } from './runtime.js';
import { applyBranding, renderRoute } from './render.js';

const config = window.KIOSQUE_EDITORIAL;

function sanitize(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('script,iframe,object,embed,form,style,link,meta').forEach((node) => node.remove());
  template.content.querySelectorAll('*').forEach((node) => {
    for (const attribute of [...node.attributes]) {
      if (/^on/i.test(attribute.name) || ((attribute.name === 'href' || attribute.name === 'src') && /^javascript:/i.test(attribute.value))) node.removeAttribute(attribute.name);
    }
  });
  return template.innerHTML;
}

/** Préfixe `/media/…` avec le basePath SPA (déploiement sous-chemin). */
function rewriteBodyMediaUrls(html) {
  const root = String(config?.publicBasePath || '').replace(/\/+$/, '');
  if (!root) return html;
  return String(html || '').replace(
    /(\s(?:src|href)=["'])(\/media\/[^"']+)(["'])/gi,
    (_m, pre, path, post) => `${pre}${root}${path}${post}`,
  );
}

function markdown(value) {
  return rewriteBodyMediaUrls(sanitize(marked.parse(String(value || ''), { async: false })));
}

function articleBody(article) {
  const raw = article.body?.format === 'html'
    ? sanitize(String(article.body.raw || ''))
    : markdown(article.body?.raw || '');
  return article.body?.format === 'html' ? rewriteBodyMediaUrls(raw) : raw;
}

async function render(push = false) {
  const backend = await getBackend();
  const bundle = await backend.getSnapshot({ audience: 'public' });
  applyBranding(bundle, config.publicBasePath);
  /* S’assurer que la puce sports est peinte même si kiosque.js a init avant le branding. */
  try {
    if (typeof window.KiosqueRefreshMasthead === 'function') window.KiosqueRefreshMasthead();
  } catch (_) {}
  const result = renderRoute(bundle, config.publicBasePath, location.pathname, articleBody);
  if (!result) return;
  if (push) history.pushState({}, '', location.pathname);
  document.title = result.title;
  document.querySelector('main').innerHTML = result.html;
  document.documentElement.dataset.editorialReady = 'true';
  /*
   * kiosque.js s’attache au HTML statique au load ; le rendu PGlite remplace
   * main.innerHTML. Rejouer collaps suite du fil, équité magazine et index
   * de recherche — sinon : fil tout ouvert, vide sous vedettes, loupe morte.
   */
  const refreshFeed = () => {
    try {
      if (typeof window.KiosqueRefreshFeed === 'function') window.KiosqueRefreshFeed();
    } catch (_) { /* ignore */ }
  };
  refreshFeed();
  // 2e / 3e passes : images + polices (comme l’init magazine balance).
  window.setTimeout(refreshFeed, 120);
  window.setTimeout(refreshFeed, 500);
  window.setTimeout(refreshFeed, 1400);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(refreshFeed).catch(() => {});
  }
}

document.addEventListener('click', (event) => {
  const anchor = event.target.closest('a[data-editorial-link]');
  if (!anchor || event.metaKey || event.ctrlKey || event.shiftKey) return;
  /* Nouvel onglet (auteurs, liens explicitement ciblés) : laisser le navigateur. */
  if (anchor.target === '_blank') return;
  const url = new URL(anchor.href);
  if (!url.pathname.startsWith(config.publicBasePath)) return;
  event.preventDefault();
  /* Conserver ?team= / ?sport= (deep-link Au tableau depuis la puce mât). */
  history.pushState({}, '', url.pathname + url.search + url.hash);
  /* Remonter en tête : le bandeau démo + la radio sticky restent montés.
   * (Le spotlight sports re-scrolle vers la carte ciblée juste après.) */
  window.scrollTo(0, 0);
  render().catch(showFailure);
});

window.addEventListener('popstate', () => {
  window.scrollTo(0, 0);
  render().catch(showFailure);
});

function showFailure(error) {
  console.error(error);
  let notice = document.getElementById('editorial-failure');
  if (!notice) {
    notice = document.createElement('aside');
    notice.id = 'editorial-failure';
    notice.className = 'editorial-failure';
    document.body.prepend(notice);
  }
  notice.innerHTML = `<strong>Les données locales ne peuvent pas être ouvertes.</strong> Le journal statique reste disponible. <button type="button">Réessayer</button>`;
  notice.querySelector('button').onclick = () => location.reload();
}

getBackend().then((backend) => {
  backend.subscribe(() => render().catch(showFailure));
  return render();
}).catch(showFailure);
