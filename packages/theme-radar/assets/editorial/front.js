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

function markdown(value) {
  return sanitize(marked.parse(String(value || ''), { async: false }));
}

function articleBody(article) {
  return article.body?.format === 'html'
    ? sanitize(String(article.body.raw || ''))
    : markdown(article.body?.raw || '');
}

async function render(push = false) {
  const backend = await getBackend();
  const bundle = await backend.getSnapshot({ audience: 'public' });
  applyBranding(bundle, config.publicBasePath);
  const result = renderRoute(bundle, config.publicBasePath, location.pathname, articleBody);
  if (!result) return;
  if (push) history.pushState({}, '', location.pathname);
  document.title = result.title;
  document.querySelector('main').innerHTML = result.html;
  document.documentElement.dataset.editorialReady = 'true';
}

document.addEventListener('click', (event) => {
  const anchor = event.target.closest('a[data-editorial-link]');
  if (!anchor || event.metaKey || event.ctrlKey || event.shiftKey) return;
  const url = new URL(anchor.href);
  if (!url.pathname.startsWith(config.publicBasePath)) return;
  event.preventDefault();
  history.pushState({}, '', url.pathname);
  render().catch(showFailure);
});

window.addEventListener('popstate', () => render().catch(showFailure));

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
