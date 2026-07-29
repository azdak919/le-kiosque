import { marked } from './marked.esm.js';
import { markdownFiles, zipStore } from './export.js';
import { download, getBackend, slugify } from './runtime.js';
import { esc } from './render.js';

const config = window.KIOSQUE_EDITORIAL;
const main = document.getElementById('admin-main');
const toast = document.getElementById('toast');
let backend;
let bundle;
let view = 'dashboard';

function notify(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2200);
}

function contrastRatio(hex, other = '#ffffff') {
  const luminance = (color) => {
    const channels = [1, 3, 5].map((offset) => {
      const value = parseInt(color.slice(offset, offset + 2), 16) / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const first = luminance(hex), second = luminance(other);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function source(kind, id) {
  return { backend: 'demo-pglite', backendId: id, fetchedAt: new Date().toISOString() };
}

function sanitizePreview(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('script,iframe,object,embed,form,style,link,meta').forEach((node) => node.remove());
  template.content.querySelectorAll('*').forEach((node) => [...node.attributes].forEach((attribute) => {
    if (/^on/i.test(attribute.name) || ((attribute.name === 'href' || attribute.name === 'src') && /^javascript:/i.test(attribute.value))) node.removeAttribute(attribute.name);
  }));
  return template.innerHTML;
}

function localDateTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

async function refresh() {
  bundle = await backend.getSnapshot({ audience: 'editorial', includeDemo: true });
  document.getElementById('publication-name').textContent = bundle.publication.name;
}

function setView(next) {
  view = next;
  document.querySelectorAll('[data-view]').forEach((button) => button.setAttribute('aria-current', button.dataset.view === view ? 'page' : 'false'));
  render();
}

function statusLabel(status) {
  return { draft: 'Brouillon', 'in-review': 'En révision', published: 'Publié' }[status] || status;
}

function dashboard() {
  const counts = Object.fromEntries(['draft', 'in-review', 'published'].map((status) => [status, bundle.articles.filter((item) => item.status === status).length]));
  return `<section class="panel"><h2>Tableau de bord</h2><div class="notice demo-notice"><strong>Contenu de démonstration</strong> — remplacez ou supprimez ces articles avant la mise en production.</div>
    <div class="grid"><article><h3>${counts.draft}</h3><p>Brouillons, invisibles du public.</p></article><article><h3>${counts['in-review']}</h3><p>Articles en révision, invisibles du public.</p></article><article><h3>${counts.published}</h3><p>Articles publiés dans le front end.</p></article><article><h3>${bundle.authors.length}</h3><p>Signatures éditoriales, sans compte ni mot de passe.</p></article></div>
    <div class="actions"><button class="primary" data-action="new-article">Créer un article</button><a class="button" href="${config.publicBasePath}/">Voir le front end</a></div>
    <h3 style="margin-top:2rem">Données d’exemple</h3><label><input id="demo-visible" type="checkbox" ${bundle.demoVisible !== false ? 'checked' : ''}> Afficher les exemples publiés dans le front end</label>
    <div class="actions"><button data-action="remove-demo">Supprimer les exemples non modifiés</button><button data-action="reset-demo">Restaurer Le Quorum</button></div>
  </section>`;
}

function articles() {
  return `<section class="panel"><div class="toolbar"><div><h2>Articles</h2><p>Seul le statut Publié apparaît dans le journal.</p></div><button class="primary" data-action="new-article">Nouvel article</button></div><ul class="entity-list">${bundle.articles.map((article) => `<li><div><strong>${esc(article.title)}</strong>${article.isDemo ? ' <small>Exemple local' + (article.isUserModified ? ' modifié' : '') + '</small>' : ''}<small>/${esc(article.slug)} · <span class="status-pill status-${esc(article.status)}">${statusLabel(article.status)}</span></small></div><div><button data-edit-article="${esc(article.id)}">Modifier</button> <button class="danger" data-delete-article="${esc(article.id)}">Supprimer</button></div></li>`).join('')}</ul></section>`;
}

const MEDIA_USAGE_LABELS = {
  exterior: 'Extérieur', interior: 'Intérieur', sport: 'Sport', masthead: 'Mât illustré', article: 'Article',
};

function mediaSrc(media) {
  const src = String(media?.src || '');
  return src.startsWith('/') ? `${config.publicBasePath}${src}` : src;
}

function cropFrames(media, prefix) {
  if (!media) return `<p class="media-quality" data-empty-crop>Aucune photo sélectionnée.</p>`;
  const position = `${media.focalPoint?.x ?? 50}% ${media.focalPoint?.y ?? 50}%`;
  return `<div class="crop-previews" data-crop-prefix="${esc(prefix)}" style="--crop-position:${esc(position)}">
    <figure class="crop-preview crop-desktop"><img src="${esc(mediaSrc(media))}" alt=""><figcaption>Ordinateur</figcaption></figure>
    <figure class="crop-preview crop-tablet"><img src="${esc(mediaSrc(media))}" alt=""><figcaption>Tablette</figcaption></figure>
    <figure class="crop-preview crop-mobile"><img src="${esc(mediaSrc(media))}" alt=""><figcaption>Mobile</figcaption></figure>
  </div>`;
}

function mediaCards(selectable = false) {
  return (bundle.media || []).map((media) => `<article class="media-card" data-media-card data-search="${esc([media.institution, media.campus, ...(media.keywords || [])].join(' ').toLowerCase())}" data-usages="${esc((media.usages || []).join(' '))}">
    <img src="${esc(mediaSrc(media))}" alt="${esc(media.alt)}" loading="lazy" style="object-position:${media.focalPoint?.x ?? 50}% ${media.focalPoint?.y ?? 50}%">
    <div class="media-card-body"><h3>${esc(media.institution)}</h3><p>${esc(media.campus)}</p><p class="media-tags">${(media.usages || []).map((usage) => esc(MEDIA_USAGE_LABELS[usage] || usage)).join(' · ')}</p>
    <p><a href="${esc(media.creditUrl)}" target="_blank" rel="noopener">Photo : ${esc(media.credit)}</a> · <a href="${esc(media.licenseUrl)}" target="_blank" rel="noopener">${esc(media.license)}</a></p>
    ${selectable ? `<button type="button" class="primary" data-select-media="${esc(media.id)}">Choisir cette photo</button>` : `<a href="${esc(media.sourceUrl)}" target="_blank" rel="noopener">Voir la source</a>`}</div>
  </article>`).join('');
}

function mediaFilters() {
  return `<div class="media-filters"><label>Rechercher un établissement, un campus ou un mot-clé<input type="search" data-media-search placeholder="Ex. : Jonquière, sport, intérieur"></label><label>Usage<select data-media-usage><option value="">Tous</option>${Object.entries(MEDIA_USAGE_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label></div>`;
}

function bindMediaFilters(host) {
  const search = host.querySelector('[data-media-search]');
  const usage = host.querySelector('[data-media-usage]');
  const filter = () => {
    const needle = search.value.trim().toLowerCase();
    host.querySelectorAll('[data-media-card]').forEach((card) => {
      card.hidden = Boolean((needle && !card.dataset.search.includes(needle)) || (usage.value && !card.dataset.usages.split(' ').includes(usage.value)));
    });
  };
  search.addEventListener('input', filter);
  usage.addEventListener('change', filter);
}

function mediaLibrary() {
  return `<section class="panel"><div class="toolbar"><div><h2>Photos</h2><p>Photos libres utilisées pour illustrer les articles et le mât. Les campus réels ne représentent pas l’établissement fictif du journal.</p></div></div>${mediaFilters()}<div class="media-grid">${mediaCards()}</div></section>`;
}

function chooseSharedMedia(onSelect, usage = '') {
  const dialog = document.createElement('dialog');
  dialog.className = 'media-picker';
  dialog.innerHTML = `<div class="toolbar"><h2>Choisir une photo</h2><button type="button" data-close-media aria-label="Fermer">×</button></div><p>La sélection copie une référence locale ; aucun téléversement distant n’est lancé.</p>${mediaFilters()}<div class="media-grid">${mediaCards(true)}</div>`;
  document.body.appendChild(dialog);
  if (usage) dialog.querySelector('[data-media-usage]').value = usage;
  bindMediaFilters(dialog);
  dialog.querySelector('[data-media-usage]').dispatchEvent(new Event('change'));
  dialog.querySelector('[data-close-media]').onclick = () => dialog.close();
  dialog.querySelectorAll('[data-select-media]').forEach((button) => button.onclick = () => {
    const media = bundle.media.find((item) => item.id === button.dataset.selectMedia);
    if (media) onSelect(structuredClone(media));
    dialog.close();
  });
  dialog.addEventListener('close', () => dialog.remove());
  dialog.showModal();
}

async function readArticleImage(file, details = {}) {
  const allowed = ['image/png', 'image/webp', 'image/jpeg'];
  if (!allowed.includes(file.type)) throw new Error('Utilisez une photo JPEG, PNG ou WebP.');
  if (file.size > 10 * 1024 * 1024) throw new Error('La photo dépasse 10 Mo.');
  const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
  const dimensions = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight }); image.onerror = reject; image.src = data; });
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  const checksum = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
  return { id: crypto.randomUUID(), kind: 'image', src: data, alt: details.alt || '', caption: details.caption || '', credit: details.credit || '', license: details.license || '', mime: file.type, checksum, ...dimensions, source: source('media', file.name) };
}

function articleEditor(article) {
  const current = article || {
    id: crypto.randomUUID(), slug: '', title: '', excerpt: '', subtitle: '', dek: '', authors: [], section: bundle.taxonomies.sections[0]?.slug || '', categories: [], tags: [], lang: bundle.publication.lang || 'fr-CA', status: 'draft', body: { format: 'markdown', raw: '' }, media: [], publication: bundle.publication.slug, updatedAt: new Date().toISOString(), canonicalUrl: '', source: source('article', 'local'),
  };
  main.innerHTML = `<section class="panel"><div class="toolbar"><h2>${article ? 'Modifier' : 'Créer'} un article</h2><button data-action="articles">Retour à la liste</button></div><form id="article-form" class="grid">
    <input type="hidden" name="id" value="${esc(current.id)}"><div class="field"><label for="article-title">Titre</label><input id="article-title" name="title" required value="${esc(current.title)}"></div><div class="field"><label for="article-slug">Identifiant URL</label><input id="article-slug" name="slug" required value="${esc(current.slug)}"></div>
    <div class="field full"><label for="article-excerpt">Résumé</label><textarea id="article-excerpt" name="excerpt" required>${esc(current.excerpt)}</textarea></div>
    <div class="field"><label for="article-section">Section</label><select id="article-section" name="section">${bundle.taxonomies.sections.map((item) => `<option value="${esc(item.slug)}" ${item.slug === current.section ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="article-status">Statut</label><select id="article-status" name="status"><option value="draft" ${current.status === 'draft' ? 'selected' : ''}>Brouillon</option><option value="in-review" ${current.status === 'in-review' ? 'selected' : ''}>En révision</option><option value="published" ${current.status === 'published' ? 'selected' : ''}>Publié</option></select></div>
    <div class="field full"><label for="article-published-at">Date et heure de publication</label><input id="article-published-at" name="publishedAt" type="datetime-local" value="${esc(localDateTime(current.publishedAt))}"><small>L’heure locale exacte sera conservée avec son fuseau et transmise au flux de LE-RADAR.</small></div>
    <fieldset class="field"><legend>Auteurs</legend>${bundle.authors.map((author) => `<label><input type="checkbox" name="authors" value="${esc(author.slug)}" ${current.authors.includes(author.slug) ? 'checked' : ''}> ${esc(author.name)}</label>`).join('')}</fieldset>
    <fieldset class="field"><legend>Catégories</legend>${bundle.taxonomies.categories.map((item) => `<label><input type="checkbox" name="categories" value="${esc(item.slug)}" ${current.categories.includes(item.slug) ? 'checked' : ''}> ${esc(item.name)}</label>`).join('')}</fieldset>
    <fieldset class="field full"><legend>Mots-clés</legend>${bundle.taxonomies.tags.map((item) => `<label><input type="checkbox" name="tags" value="${esc(item.slug)}" ${current.tags.includes(item.slug) ? 'checked' : ''}> ${esc(item.name)}</label>`).join('')}</fieldset>
    <fieldset class="field full media-editor"><legend>Photo principale</legend><label>Photo JPEG, PNG ou WebP<input id="article-lead-file" type="file" accept="image/jpeg,image/png,image/webp"></label><button type="button" data-action="choose-lead-media">Choisir une photo</button><label>Description accessible<input name="leadAlt" value="${esc(current.lead?.alt || '')}"></label><label>Crédit<input name="leadCredit" value="${esc(current.lead?.credit || '')}"></label><label>Légende<input name="leadCaption" value="${esc(current.lead?.caption || '')}"></label><label>Licence<input name="leadLicense" value="${esc(current.lead?.license || '')}"></label><label>Point focal X<input name="leadFocalX" type="range" min="0" max="100" value="${current.lead?.focalPoint?.x ?? 50}"></label><label>Point focal Y<input name="leadFocalY" type="range" min="0" max="100" value="${current.lead?.focalPoint?.y ?? 50}"></label><div id="article-lead-preview" class="full">${cropFrames(current.lead, 'article')}</div>${current.lead ? `<p class="media-quality">Photo actuelle : ${current.lead.width || '?'} × ${current.lead.height || '?'} px${current.lead.width && (current.lead.width < 720 || current.lead.height < 405) ? ' — résolution faible pour la vedette' : ''}.</p>` : ''}</fieldset>
    <div class="field full"><label for="article-format">Format du texte</label><select id="article-format" name="bodyFormat"><option value="markdown" ${current.body?.format !== 'html' ? 'selected' : ''}>Markdown</option><option value="html" ${current.body?.format === 'html' ? 'selected' : ''}>HTML assaini</option></select></div>
    <div class="field full editor-shell"><div class="editor-toolbar"><button type="button" data-editor-mode="visual">Visuel</button><button type="button" data-editor-mode="source">Source</button><span data-html-tools><button type="button" data-command="bold"><strong>G</strong></button><button type="button" data-command="italic"><em>I</em></button><button type="button" data-command="formatBlock" data-value="h2">Titre</button><button type="button" data-command="createLink">Lien</button></span><label class="button">Ajouter une photo<input id="article-inline-file" type="file" accept="image/jpeg,image/png,image/webp" hidden></label></div><label for="article-body" class="sr-only">Texte de l’article</label><textarea class="body" id="article-body" name="body">${esc(current.body?.raw || '')}</textarea><div id="article-visual" class="visual-editor" contenteditable="true"></div><p class="media-quality">Les photos téléversées restent dans ce navigateur et seront incluses dans les exports. Recommandation : 720 × 405 px pour une vedette.</p></div>
    <div class="actions full"><button class="primary" type="submit">Enregistrer</button><button type="button" data-action="preview">Prévisualiser sans publier</button></div></form><div id="article-preview"></div></section>`;
  const title = document.getElementById('article-title');
  const slug = document.getElementById('article-slug');
  title.addEventListener('input', () => { if (!article && !slug.dataset.touched) slug.value = slugify(title.value); });
  slug.addEventListener('input', () => { slug.dataset.touched = 'true'; });
  const format = document.getElementById('article-format');
  const body = document.getElementById('article-body');
  const visual = document.getElementById('article-visual');
  const articleForm = document.getElementById('article-form');
  const refreshLeadCrop = () => {
    const x = Number(articleForm.elements.leadFocalX.value), y = Number(articleForm.elements.leadFocalY.value);
    articleForm.querySelector('.crop-previews')?.style.setProperty('--crop-position', `${x}% ${y}%`);
  };
  articleForm.elements.leadFocalX.addEventListener('input', refreshLeadCrop);
  articleForm.elements.leadFocalY.addEventListener('input', refreshLeadCrop);
  main.querySelector('[data-action="choose-lead-media"]').onclick = () => chooseSharedMedia((media) => {
    current.lead = media;
    for (const [name, value] of [['leadAlt', media.alt], ['leadCredit', media.credit], ['leadCaption', media.caption], ['leadLicense', media.license]]) articleForm.elements[name].value = value || '';
    articleForm.elements.leadFocalX.value = media.focalPoint?.x ?? 50;
    articleForm.elements.leadFocalY.value = media.focalPoint?.y ?? 50;
    document.getElementById('article-lead-preview').innerHTML = cropFrames(media, 'article');
    notify('Photo sélectionnée.');
  }, 'article');
  let editorMode = current.body?.format === 'html' ? 'visual' : 'source';
  visual.innerHTML = current.body?.format === 'html' ? sanitizePreview(current.body.raw || '') : sanitizePreview(marked.parse(current.body?.raw || '', { async: false }));
  const syncEditor = (next = editorMode) => {
    if (editorMode === 'visual' && next === 'source' && format.value === 'html') body.value = sanitizePreview(visual.innerHTML);
    if (editorMode === 'source' && next === 'visual') visual.innerHTML = format.value === 'html' ? sanitizePreview(body.value) : sanitizePreview(marked.parse(body.value, { async: false }));
    editorMode = next;
    body.hidden = next !== 'source';
    visual.hidden = next !== 'visual';
    main.querySelector('[data-html-tools]').hidden = format.value !== 'html' || next !== 'visual';
  };
  main.querySelectorAll('[data-editor-mode]').forEach((button) => button.onclick = () => syncEditor(button.dataset.editorMode));
  format.onchange = () => { if (editorMode === 'visual') syncEditor('source'); syncEditor(format.value === 'html' ? 'visual' : 'source'); };
  main.querySelectorAll('[data-command]').forEach((button) => button.onclick = () => { visual.focus(); const value = button.dataset.command === 'createLink' ? prompt('Adresse du lien (https://…)') : button.dataset.value || null; if (value !== null) document.execCommand(button.dataset.command, false, value); });
  document.getElementById('article-inline-file').onchange = async (event) => {
    const file = event.target.files[0]; if (!file) return;
    const alt = prompt('Décrivez ce que montre la photo.'); if (!alt?.trim()) { notify('Description obligatoire.'); return; }
    try {
      const media = await readArticleImage(file, { alt: alt.trim(), credit: prompt('Crédit photo (facultatif)') || '' });
      current.media.push(media);
      if (format.value === 'html') {
        syncEditor('visual'); visual.focus(); document.execCommand('insertHTML', false, `<figure><img src="${media.src}" alt="${esc(media.alt)}"><figcaption>${esc(media.credit ? `Photo : ${media.credit}` : '')}</figcaption></figure>`);
      } else {
        syncEditor('source'); const insertion = `\n\n![${media.alt}](${media.src})${media.credit ? `\n\n*Photo : ${media.credit}*` : ''}\n\n`; body.setRangeText(insertion, body.selectionStart, body.selectionEnd, 'end');
      }
      notify(media.width < 640 || media.height < 360 ? 'Photo ajoutée — résolution faible.' : 'Photo ajoutée.');
    } catch (error) { notify(error.message); }
  };
  document.getElementById('article-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (editorMode === 'visual' && format.value === 'html') body.value = sanitizePreview(visual.innerHTML);
    let lead = current.lead;
    const leadFile = document.getElementById('article-lead-file').files[0];
    if (leadFile) lead = { ...await readArticleImage(leadFile, { alt: form.get('leadAlt').trim(), credit: form.get('leadCredit').trim(), caption: form.get('leadCaption').trim(), license: form.get('leadLicense').trim() }), focalPoint: { x: Number(form.get('leadFocalX')), y: Number(form.get('leadFocalY')) } };
    else if (lead) lead = { ...lead, alt: form.get('leadAlt').trim(), credit: form.get('leadCredit').trim(), caption: form.get('leadCaption').trim(), license: form.get('leadLicense').trim(), focalPoint: { x: Number(form.get('leadFocalX')), y: Number(form.get('leadFocalY')) } };
    if (form.get('status') === 'published' && lead && !lead.alt.trim()) { notify('La description de la photo principale est obligatoire.'); return; }
    const requestedPublication = form.get('publishedAt');
    const enteredPublication = requestedPublication ? new Date(requestedPublication).toISOString() : undefined;
    const saved = {
      ...current, id: form.get('id'), title: form.get('title').trim(), slug: slugify(form.get('slug')), excerpt: form.get('excerpt').trim(), section: form.get('section'), status: form.get('status'), authors: form.getAll('authors'), categories: form.getAll('categories'), tags: form.getAll('tags'), body: { format: format.value, raw: body.value }, lead, media: current.media, publishedAt: enteredPublication || (form.get('status') === 'published' ? (current.publishedAt || new Date().toISOString()) : current.publishedAt), updatedAt: new Date().toISOString(), canonicalUrl: `${bundle.publication.siteUrl.replace(/\/$/, '')}/articles/${slugify(form.get('slug'))}/`, source: current.source || source('article', form.get('id')),
    };
    await backend.save('article', saved); await refresh(); notify('Article enregistré.'); setView('articles');
  });
  main.querySelector('[data-action="preview"]').addEventListener('click', () => {
    if (editorMode === 'visual' && format.value === 'html') body.value = sanitizePreview(visual.innerHTML);
    const html = format.value === 'html' ? sanitizePreview(body.value) : sanitizePreview(marked.parse(body.value, { async: false }));
    document.getElementById('article-preview').innerHTML = `<article class="preview-frame"><p class="status-pill">Prévisualisation privée</p><h1>${esc(title.value)}</h1>${html}</article>`;
  });
  syncEditor(editorMode);
}

function authors() {
  return `<section class="panel"><div class="toolbar"><h2>Auteurs et rôles informatifs</h2><button class="primary" data-action="new-author">Nouvelle signature</button></div><div class="notice">Ces rôles ne donnent aucun accès et ne constituent pas une authentification.</div><ul class="entity-list">${bundle.authors.map((author) => `<li><div><strong>${esc(author.name)}</strong><small>${esc(author.role || '')} · ${esc(author.editorialRole || 'auteur')}</small></div><div><button data-edit-author="${esc(author.id)}">Modifier</button> <button class="danger" data-delete-author="${esc(author.id)}">Supprimer</button></div></li>`).join('')}</ul></section>`;
}

function authorEditor(author) {
  const current = author || { id: crypto.randomUUID(), name: '', slug: '', role: '', editorialRole: 'auteur', bio: '', cohort: '', active: true, source: source('author', 'local') };
  main.innerHTML = `<section class="panel"><h2>${author ? 'Modifier' : 'Créer'} une signature</h2><form id="author-form" class="grid"><div class="field"><label>Nom<input name="name" required value="${esc(current.name)}"></label></div><div class="field"><label>Identifiant URL<input name="slug" required value="${esc(current.slug)}"></label></div><div class="field"><label>Fonction affichée<input name="role" value="${esc(current.role || '')}"></label></div><div class="field"><label>Rôle informatif<select name="editorialRole"><option>auteur</option><option ${current.editorialRole === 'reviseur' ? 'selected' : ''}>reviseur</option><option ${current.editorialRole === 'editeur' ? 'selected' : ''}>editeur</option></select></label></div><div class="field full"><label>Biographie<textarea name="bio">${esc(current.bio || '')}</textarea></label></div><div class="actions full"><button class="primary">Enregistrer</button><button type="button" data-action="authors">Annuler</button></div></form></section>`;
  main.querySelector('form').onsubmit = async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); await backend.save('author', { ...current, name: data.get('name').trim(), slug: slugify(data.get('slug')), role: data.get('role').trim(), editorialRole: data.get('editorialRole'), bio: data.get('bio').trim() }); await refresh(); notify('Signature enregistrée.'); setView('authors'); };
}

function taxonomies() {
  const swatch = (item) => item.color
    ? `<span class="taxonomy-swatch" style="--c:${esc(item.color)}" title="${esc(item.color)}"></span>`
    : '';
  const group = (title, kind, values, withColor = false) => `<section><div class="toolbar"><h3>${title}</h3><button data-add-taxonomy="${kind}">Ajouter</button></div><p class="media-quality">${withColor ? 'Chaque rubrique peut avoir sa propre couleur d’étiquette (pastille sur les cartes), distincte de la couleur de marque du journal.' : ''}</p><ul class="entity-list">${values.map((item) => `<li><div>${swatch(item)}<strong>${esc(item.name)}</strong><small>/${esc(item.slug)}${item.color ? ` · ${esc(item.color)}` : ''}</small></div><div><button data-edit-taxonomy="${kind}:${esc(item.id)}">Modifier</button> <button class="danger" data-delete-taxonomy="${kind}:${esc(item.id)}">Supprimer</button></div></li>`).join('')}</ul></section>`;
  return `<section class="panel"><h2>Structure éditoriale</h2>${group('Sections', 'section', bundle.taxonomies.sections, true)}${group('Catégories', 'category', bundle.taxonomies.categories, true)}${group('Mots-clés', 'tag', bundle.taxonomies.tags, false)}</section>`;
}

function settings() {
  const publication = bundle.publication;
  const masthead = publication.masthead || {};
  return `<section class="panel"><h2>Configuration du journal</h2><form id="settings-form" class="grid">
    <div class="field"><label>Nom<input name="name" required value="${esc(publication.name)}"></label></div><div class="field"><label>Signature<input name="tagline" value="${esc(publication.tagline || '')}"></label></div><div class="field"><label>Institution<input name="institution" value="${esc(publication.institution || '')}"></label></div><div class="field"><label>Typographie<select name="typography"><option value="modern-accessible">Moderne accessible</option><option value="editorial-classic" ${publication.theme?.typography === 'editorial-classic' ? 'selected' : ''}>Éditoriale classique</option><option value="institutional" ${publication.theme?.typography === 'institutional' ? 'selected' : ''}>Institutionnelle</option></select></label></div>
    <div class="field"><label>Fuseau horaire<select name="timeZone"><option value="America/Toronto" ${publication.timeZone !== 'America/Blanc-Sablon' ? 'selected' : ''}>Heure de l’Est — majorité du Québec</option><option value="America/Blanc-Sablon" ${publication.timeZone === 'America/Blanc-Sablon' ? 'selected' : ''}>Heure de l’Atlantique — Blanc-Sablon</option></select></label></div>
    <div class="field"><label>Couleur principale<input name="accent" type="color" value="${esc(publication.theme?.accent || '#6c2163')}"></label></div><div class="field"><label>Couleur sombre<input name="accentDark" type="color" value="${esc(publication.theme?.accentDark || '#cf7ec1')}"></label></div><div id="admin-contrast" class="notice full" role="status"></div>
    <fieldset class="field full"><legend>Mât illustré</legend><label><input name="backgroundsEnabled" type="checkbox" ${masthead.backgrounds?.enabled !== false ? 'checked' : ''}> Afficher les images de fond</label><label>Ajouter mes propres images<input id="background-files" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><div class="actions"><button type="button" data-action="choose-masthead-media">Choisir une photo</button><button type="button" data-action="clear-backgrounds">Retirer toutes les images</button></div><p>${masthead.backgrounds?.images?.length || 0} image(s) enregistrée(s). Un nouvel envoi les ajoute à la rotation.</p><label>Point focal X<input name="mastheadFocalX" type="range" min="0" max="100" value="${masthead.backgrounds?.images?.[0]?.focalPoint?.x ?? 50}"></label><label>Point focal Y<input name="mastheadFocalY" type="range" min="0" max="100" value="${masthead.backgrounds?.images?.[0]?.focalPoint?.y ?? 50}"></label><label>Force du voile<input name="overlayStrength" type="range" min="0" max="0.9" step="0.05" value="${masthead.overlayStrength ?? 0.55}"></label><label>Alignement du titre<select name="textAlignment"><option value="left">Gauche</option><option value="center" ${masthead.textAlignment === 'center' ? 'selected' : ''}>Centre</option><option value="right" ${masthead.textAlignment === 'right' ? 'selected' : ''}>Droite</option></select></label><div id="masthead-crop-preview">${cropFrames(masthead.backgrounds?.images?.[0], 'masthead')}</div></fieldset>
    <fieldset class="field"><legend>Météo</legend><label><input name="weatherEnabled" type="checkbox" ${masthead.weather?.enabled ? 'checked' : ''}> Afficher la météo</label><label>Localités, séparées par des virgules<input name="weatherLocalities" value="${esc((masthead.weather?.localities || []).join(', '))}" placeholder="Québec"></label><small>Maximum quatre.</small></fieldset>
    <fieldset class="field"><legend>Outils</legend><label><input name="pomodoro" type="checkbox" ${masthead.tools?.pomodoro !== false ? 'checked' : ''}> Pomodoro LE-RADAR.ca</label><label><input name="solitaire" type="checkbox" ${masthead.tools?.solitaire !== false ? 'checked' : ''}> Solitaire LE-RADAR.ca</label></fieldset>
    <div class="field"><label><input name="radioEnabled" type="checkbox" ${publication.radio?.enabled !== false ? 'checked' : ''}> Barre radio sombre LE-RADAR.ca</label></div><div class="field"><label>Station<input name="station" value="${esc(publication.radio?.station || '')}"></label></div>
    <div class="field full"><label>Logo local (SVG, PNG, WebP ou JPEG)<input id="logo-file" type="file" accept="image/svg+xml,image/png,image/webp,image/jpeg"></label><label>Texte alternatif<input name="logoAlt" value="${esc(publication.logo?.alt || publication.name)}"></label><small>Vérifiez vos droits d’utilisation pour chaque image téléversée.</small></div>
    <div class="actions full"><button class="primary">Enregistrer</button><button type="button" data-action="recommended-theme">Réinitialiser le thème recommandé</button></div></form></section>`;
}

async function readLogo(file, alt) {
  const allowed = ['image/svg+xml', 'image/png', 'image/webp', 'image/jpeg'];
  if (!allowed.includes(file.type)) throw new Error('Format de logo non pris en charge.');
  const limit = file.type === 'image/svg+xml' ? 512 * 1024 : 2 * 1024 * 1024;
  if (file.size > limit) throw new Error('Le logo dépasse la taille maximale permise.');
  let data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
  if (file.type === 'image/svg+xml') {
    const raw = await file.text();
    const documentSvg = new DOMParser().parseFromString(raw, 'image/svg+xml');
    documentSvg.querySelectorAll('script,foreignObject').forEach((node) => node.remove());
    documentSvg.querySelectorAll('*').forEach((node) => [...node.attributes].forEach((attribute) => { if (/^on/i.test(attribute.name) || /^(?:https?:|javascript:)/i.test(attribute.value)) node.removeAttribute(attribute.name); }));
    data = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(documentSvg.documentElement))))}`;
  }
  return { id: crypto.randomUUID(), kind: 'image', src: data, alt: alt || bundle.publication.name, mime: file.type, source: source('media', file.name) };
}

function exportsView() {
  return `<section class="panel"><h2>Exporter mon journal</h2><p>Les archives sont créées dans ce navigateur. Elles ne contiennent aucun mot de passe, jeton ou secret.</p><div class="field"><label>Contenu de l’export<select id="export-filter"><option value="all">Tout, exemples compris</option><option value="without-demo">Exclure les exemples</option><option value="user-content">Créé ou modifié par moi</option></select></label></div><div class="actions"><button class="primary" data-action="export-zip">Télécharger le journal Markdown</button><button data-action="export-json">Télécharger la sauvegarde JSON</button><button data-action="import-json">Importer une sauvegarde</button><input id="import-file" type="file" accept="application/json" hidden></div><hr><h2>Après la démonstration</h2><div class="post-demo"><article><h3>1. Exporter mon journal</h3><p>Gardez le ZIP Markdown et une sauvegarde JSON.</p></article><article><h3>2. Passer à Sveltia + GitHub</h3><p>Créez un dépôt avec « Use this template », copiez l’export, puis activez Actions et Pages. Cette étape est manuelle et demande les droits GitHub du dépôt.</p><a href="https://github.com/azdak919/le-kiosque/generate">Créer le dépôt</a></article><article><h3>3. Future option PocketBase</h3><p>Point d’extension prévu, mais aucun backend PocketBase, compte ou hébergement n’est offert actuellement.</p></article></div><section class="panel danger-zone"><h3>Réinitialiser Le Quorum</h3><p>La réinitialisation complète efface les changements locaux de ce navigateur. Exportez-les d’abord.</p><button class="danger" data-action="full-reset">Réinitialiser Le Quorum</button></section></section>`;
}

function bindCommon() {
  main.querySelectorAll('[data-action="new-article"]').forEach((button) => button.onclick = () => articleEditor());
  main.querySelectorAll('[data-action="articles"]').forEach((button) => button.onclick = () => setView('articles'));
  main.querySelectorAll('[data-action="authors"]').forEach((button) => button.onclick = () => setView('authors'));
  main.querySelectorAll('[data-edit-article]').forEach((button) => button.onclick = () => articleEditor(bundle.articles.find((item) => item.id === button.dataset.editArticle)));
  main.querySelectorAll('[data-delete-article]').forEach((button) => button.onclick = async () => { if (!confirm('Supprimer cet article de ce navigateur?')) return; await backend.remove('article', button.dataset.deleteArticle); await refresh(); render(); });
  main.querySelectorAll('[data-edit-author]').forEach((button) => button.onclick = () => authorEditor(bundle.authors.find((item) => item.id === button.dataset.editAuthor)));
  main.querySelectorAll('[data-delete-author]').forEach((button) => button.onclick = async () => { if (!confirm('Supprimer cette signature?')) return; await backend.remove('author', button.dataset.deleteAuthor); await refresh(); render(); });
  main.querySelector('[data-action="new-author"]')?.addEventListener('click', () => authorEditor());
}

function render() {
  main.innerHTML = ({ dashboard, articles, media: mediaLibrary, authors, taxonomies, settings, exports: exportsView }[view] || dashboard)();
  bindCommon();
  if (view === 'dashboard') {
    document.getElementById('demo-visible').onchange = async (event) => { await backend.setDemoVisibility(event.target.checked); await refresh(); notify('Affichage des exemples mis à jour.'); };
    main.querySelector('[data-action="remove-demo"]').onclick = async () => { if (!confirm('Supprimer uniquement les exemples jamais modifiés? Vos contenus seront conservés.')) return; await backend.removeDemo(); await refresh(); render(); };
    main.querySelector('[data-action="reset-demo"]').onclick = async (event) => {
      if (!confirm('Restaurer une copie propre des exemples du Quorum? La configuration et vos contenus seront conservés.')) return;
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = 'Restauration en cours…';
      await backend.resetDemo();
      await refresh();
      notify('Les exemples du Quorum sont restaurés.');
      render();
    };
  }
  if (view === 'taxonomies') {
    main.querySelectorAll('[data-add-taxonomy]').forEach((button) => button.onclick = async () => {
      const name = prompt('Nom');
      if (!name) return;
      const kind = button.dataset.addTaxonomy;
      let color;
      if (kind === 'section' || kind === 'category') {
        color = prompt('Couleur d’étiquette (hex, ex. #0b5cab) — laisser vide pour la couleur de marque', '#6c2163') || undefined;
        if (color && !/^#[0-9a-fA-F]{3,8}$/.test(color.trim())) { notify('Couleur invalide.'); return; }
        color = color?.trim();
      }
      await backend.save(kind, {
        id: crypto.randomUUID(),
        name,
        slug: slugify(name),
        order: kind === 'section' ? bundle.taxonomies.sections.length + 1 : undefined,
        color,
      });
      await refresh();
      render();
    });
    main.querySelectorAll('[data-edit-taxonomy]').forEach((button) => button.onclick = async () => {
      const [kind, id] = button.dataset.editTaxonomy.split(':');
      const values = kind === 'section' ? bundle.taxonomies.sections : kind === 'category' ? bundle.taxonomies.categories : bundle.taxonomies.tags;
      const current = values.find((item) => item.id === id);
      const name = prompt('Nom', current.name);
      if (!name) return;
      let color = current.color;
      if (kind === 'section' || kind === 'category') {
        const next = prompt('Couleur d’étiquette (hex) — vide pour retirer', current.color || '');
        if (next === null) return;
        if (next.trim() && !/^#[0-9a-fA-F]{3,8}$/.test(next.trim())) { notify('Couleur invalide.'); return; }
        color = next.trim() || undefined;
      }
      await backend.save(kind, { ...current, name, slug: current.slug, color });
      await refresh();
      render();
    });
    main.querySelectorAll('[data-delete-taxonomy]').forEach((button) => button.onclick = async () => { const [kind, id] = button.dataset.deleteTaxonomy.split(':'); if (!confirm('Supprimer cette entrée?')) return; await backend.remove(kind, id); await refresh(); render(); });
  }
  if (view === 'media') bindMediaFilters(main);
  if (view === 'settings') {
    const form = document.getElementById('settings-form');
    let selectedMasthead = structuredClone(bundle.publication.masthead?.backgrounds?.images?.[0] || null);
    let clearMastheadImages = false;
    const refreshMastheadCrop = () => {
      const x = Number(form.elements.mastheadFocalX.value), y = Number(form.elements.mastheadFocalY.value);
      form.querySelector('#masthead-crop-preview .crop-previews')?.style.setProperty('--crop-position', `${x}% ${y}%`);
    };
    form.elements.mastheadFocalX.addEventListener('input', refreshMastheadCrop);
    form.elements.mastheadFocalY.addEventListener('input', refreshMastheadCrop);
    main.querySelector('[data-action="choose-masthead-media"]').onclick = () => chooseSharedMedia((media) => {
      selectedMasthead = media;
      clearMastheadImages = false;
      form.elements.mastheadFocalX.value = media.focalPoint?.x ?? 50;
      form.elements.mastheadFocalY.value = media.focalPoint?.y ?? 50;
      document.getElementById('masthead-crop-preview').innerHTML = cropFrames(media, 'masthead');
      form.elements.backgroundsEnabled.checked = true;
      notify('Photo du mât sélectionnée.');
    }, 'masthead');
    const updateContrast = () => { const ratio = contrastRatio(form.elements.accent.value); document.getElementById('admin-contrast').textContent = ratio >= 4.5 ? `Contraste AA avec du texte blanc : ${ratio.toFixed(2)}:1.` : `Avertissement : contraste de ${ratio.toFixed(2)}:1 avec du texte blanc. La sauvegarde reste permise.`; };
    form.elements.accent.addEventListener('input', updateContrast); updateContrast();
    form.onsubmit = async (event) => { event.preventDefault(); const data = new FormData(form); const publication = structuredClone(bundle.publication); publication.name = data.get('name').trim(); publication.tagline = data.get('tagline').trim(); publication.institution = data.get('institution').trim(); publication.timeZone = data.get('timeZone'); publication.theme = { accent: data.get('accent'), accentDark: data.get('accentDark'), typography: data.get('typography') }; publication.radio = { ...publication.radio, enabled: data.has('radioEnabled'), station: data.get('station').trim(), theme: 'dark', position: 'top' }; const localities = data.get('weatherLocalities').split(',').map((value) => value.trim()).filter(Boolean).slice(0, 4); const priorImages = clearMastheadImages ? [] : (publication.masthead?.backgrounds?.images || []); const selected = selectedMasthead ? { ...selectedMasthead, focalPoint: { x: Number(data.get('mastheadFocalX')), y: Number(data.get('mastheadFocalY')) } } : null; publication.masthead = { backgrounds: { enabled: data.has('backgroundsEnabled'), images: selected ? [selected, ...priorImages.filter((item) => item.id !== selected.id)] : priorImages }, weather: { enabled: data.has('weatherEnabled'), localities }, tools: { pomodoro: data.has('pomodoro'), solitaire: data.has('solitaire') }, overlayStrength: Math.min(0.9, Math.max(0, Number(data.get('overlayStrength')))), textAlignment: data.get('textAlignment') }; for (const file of document.getElementById('background-files').files) publication.masthead.backgrounds.images.push({ ...await readArticleImage(file, { alt: `Arrière-plan du journal ${publication.name}` }), focalPoint: { x: 50, y: 50 } }); const logoFile = document.getElementById('logo-file').files[0]; if (logoFile) publication.logo = await readLogo(logoFile, data.get('logoAlt').trim()); else if (publication.logo) publication.logo.alt = data.get('logoAlt').trim() || publication.name; await backend.savePublication(publication); await refresh(); notify('Configuration enregistrée.'); render(); };
    main.querySelector('[data-action="clear-backgrounds"]').onclick = () => { selectedMasthead = null; clearMastheadImages = true; form.elements.backgroundsEnabled.checked = false; document.getElementById('masthead-crop-preview').innerHTML = cropFrames(null, 'masthead'); notify('Les images seront retirées à l’enregistrement.'); };
    main.querySelector('[data-action="recommended-theme"]').onclick = () => { form.elements.typography.value = 'modern-accessible'; form.elements.accent.value = '#6c2163'; form.elements.accentDark.value = '#cf7ec1'; };
  }
  if (view === 'exports') {
    const backup = () => backend.createBackup({ filter: document.getElementById('export-filter').value });
    main.querySelector('[data-action="export-json"]').onclick = async () => download(`${bundle.publication.slug}-sauvegarde.json`, JSON.stringify(await backup(), null, 2), 'application/json');
    main.querySelector('[data-action="export-zip"]').onclick = async () => { const data = await backup(); download(`${bundle.publication.slug}-journal.zip`, zipStore(await markdownFiles(data, config.publicBasePath))); };
    const input = document.getElementById('import-file'); main.querySelector('[data-action="import-json"]').onclick = () => input.click(); input.onchange = async () => { const file = input.files[0]; if (!file) return; const data = JSON.parse(await file.text()); if (!confirm(`Importer la sauvegarde « ${data.bundle?.publication?.name || file.name} »? Les données locales actuelles seront remplacées.`)) return; await backend.restoreBackup(data); await refresh(); notify('Sauvegarde importée.'); setView('dashboard'); };
    main.querySelector('[data-action="full-reset"]').onclick = async () => { if (!confirm('Réinitialiser complètement Le Quorum et effacer tous les changements locaux? Cette action est irréversible sans sauvegarde.')) return; await backend.resetDemo({ full: true }); await refresh(); notify('Le Quorum a été réinitialisé.'); setView('dashboard'); };
  }
}

document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));

try {
  backend = await getBackend();
  backend.subscribe(async () => { await refresh(); if (!main.querySelector('form')) render(); });
  await refresh();
  render();
} catch (error) {
  console.error(error);
  main.innerHTML = `<section class="panel"><h2>Impossible d’ouvrir les données locales</h2><p>${esc(error.message)}</p><div class="actions"><button onclick="location.reload()">Réessayer</button><a class="button" href="${config.publicBasePath}/">Utiliser le journal statique</a></div></section>`;
}
