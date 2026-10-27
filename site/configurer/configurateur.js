/**
 * Configurateur KIOSQUE — 4 étapes, aperçu en direct.
 * Toute la logique (défauts, validation, fichiers produits) vient du noyau
 * commun partagé avec l'installateur du kit : packages/config-core.
 */
import * as K from './kiosque-config.mjs';

const prefill = window.KIOSQUE_PREFILL || {};
const pub = prefill.publication || {};
const TOTAL = K.ETAPES.length;

function detectBasePath() {
  const p = window.location.pathname.replace(/\/index\.html$/, '');
  const i = p.indexOf('/configurer');
  if (i < 0) return '';
  const b = p.slice(0, i).replace(/\/+$/, '');
  return b === '/' ? '' : b;
}
const basePath = detectBasePath();
const storageKey = 'kiosque-configurateur:' + (basePath || '/');

// Démonstration : on part du journal fictif; le reste vient des défauts communs.
const initial = K.completer({
  name: pub.name || 'Le Quorum',
  institution: pub.institution || 'Cégep de démonstration',
  accent: pub.accent || '#6c2163',
  accentDark: pub.accentDark,
  tagline: pub.tagline || '',
  slug: pub.slug,
  siteUrl: pub.siteUrl,
  sections: (prefill.sections || []).map((s) => s.name).join('\n') || K.SECTIONS_PROPOSEES.join('\n'),
  demoContent: prefill.demoContent !== false,
  station: prefill.radio?.station || '',
  weatherLocalities: (prefill.masthead?.weather?.localities || []).map((l) => (typeof l === 'string' ? l : l.name || l.label || '')).filter(Boolean).join(', '),
  weatherEnabled: Boolean(prefill.masthead?.weather?.enabled),
});

let saved = {};
try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch {}
if (saved._version !== 2) saved = {}; // ancien configurateur en 12 étapes : on repart proprement
let state = { ...initial, ...saved };
let step = Math.min(TOTAL, Math.max(1, Number(saved._step) || 1));
let accentDarkManuel = Boolean(saved._accentDarkManuel);

const $ = (id) => document.getElementById(id);
const form = $('config-form');
const fields = [...form.querySelectorAll('[data-key]')];
const steps = [...form.querySelectorAll('.config-step')];
const stepItems = [...document.querySelectorAll('#steps-list li')];
const actualKey = (k) => (k === 'accentText' ? 'accent' : k === 'accentDarkText' ? 'accentDark' : k);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ ...state, _step: step, _version: 2, _accentDarkManuel: accentDarkManuel }));
    $('save-status').textContent = 'Enregistré localement';
  } catch { $('save-status').textContent = 'Stockage local indisponible'; }
}

function fillFields() {
  for (const f of fields) {
    const k = actualKey(f.dataset.key);
    if (f === document.activeElement && f.type !== 'checkbox' && f.type !== 'color') continue;
    if (f.type === 'checkbox') f.checked = Boolean(state[k]);
    else f.value = state[k] ?? '';
  }
}

function updatePreview() {
  const c = K.completer(state);
  const prev = $('live-preview');
  prev.style.setProperty('--preview-accent', c.accent);
  $('preview-name').textContent = c.name;
  $('preview-institution').textContent = state.institution || 'Établissement';
  $('preview-tagline').textContent = c.tagline || '';
  const sections = K.lireSections(state.sections);
  $('preview-nav').innerHTML = sections.slice(0, 7).map((s, i) => (i === 0 ? `<b>${esc(s.name)}</b>` : esc(s.name))).join(' ');
  $('preview-kicker').textContent = sections[0]?.name || 'À la une';
  const logo = $('preview-logo');
  logo.hidden = !state.logo?.src;
  if (state.logo?.src) { logo.src = state.logo.src; logo.alt = c.logoAlt; }
  const white = K.contraste(c.accent, '#ffffff');
  const dark = K.contraste(c.accent, '#16181c');
  const best = Math.max(white, dark);
  const r = $('contrast-result');
  r.className = 'contrast ' + (best >= 4.5 ? 'pass' : 'warn');
  r.textContent = (best >= 4.5 ? 'Contraste AA : ' : 'Contraste faible : ') + best.toFixed(2) + ':1 avec un texte ' + (white >= dark ? 'blanc' : 'foncé') + '.';
}

function showErrors(errs) {
  const box = steps[step - 1].querySelector('.step-error');
  for (const f of fields) f.removeAttribute('aria-invalid');
  for (const e of errs) form.querySelectorAll(`[data-key="${e.cle}"]`).forEach((f) => f.setAttribute('aria-invalid', 'true'));
  if (!box) return;
  box.hidden = !errs.length;
  box.textContent = errs.map((e) => e.message).join(' ');
}

function showStep() {
  steps.forEach((s, i) => { s.hidden = i + 1 !== step; });
  stepItems.forEach((li, i) => {
    li.classList.toggle('current', i + 1 === step);
    li.classList.toggle('done', i + 1 < step);
    if (i + 1 === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  });
  $('previous').disabled = step === 1;
  $('next').hidden = step === TOTAL;
  $('next').textContent = step === TOTAL - 1 ? 'Terminer' : 'Continuer';
  if (step === TOTAL) renderFinish();
  $('step-live').textContent = `Étape ${step} sur ${TOTAL}`;
  showErrors([]);
  save();
}

for (const f of fields) {
  const onInput = () => {
    const k = actualKey(f.dataset.key);
    state[k] = f.type === 'checkbox' ? f.checked : f.value;
    if (k === 'name') { if (!saved.slug) state.slug = K.slugify(state.name); state.logoAlt = state.name; }
    if (k === 'accentDark') accentDarkManuel = true;
    if (k === 'accent' && !accentDarkManuel) state.accentDark = K.couleurSombre(state.accent);
    fillFields();
    updatePreview();
    if (step === TOTAL) renderFinish();
    save();
  };
  f.addEventListener('input', onInput);
  f.addEventListener('change', onInput);
}

const logoInput = $('config-logo');
logoInput.addEventListener('change', () => {
  const file = logoInput.files?.[0];
  if (!file) return;
  const ok = ['image/svg+xml', 'image/png', 'image/webp', 'image/jpeg'].includes(file.type);
  const limit = file.type === 'image/svg+xml' ? 512 * 1024 : 2 * 1024 * 1024;
  if (!ok || file.size > limit) { window.alert('Ce logo est trop lourd ou utilise un format non pris en charge.'); logoInput.value = ''; return; }
  const keep = (src) => {
    state.logo = { id: crypto.randomUUID(), kind: 'image', src, alt: state.logoAlt || state.name, mime: file.type, source: { backend: 'configurateur', backendId: file.name, fetchedAt: new Date().toISOString() } };
    updatePreview(); save();
  };
  if (file.type === 'image/svg+xml') {
    file.text().then((raw) => {
      const svg = new DOMParser().parseFromString(raw, 'image/svg+xml');
      svg.querySelectorAll('script,foreignObject').forEach((n) => n.remove());
      svg.querySelectorAll('*').forEach((n) => [...n.attributes].forEach((a) => { if (/^on/i.test(a.name) || /^(?:https?:|javascript:)/i.test(a.value)) n.removeAttribute(a.name); }));
      keep('data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(svg.documentElement)))));
    });
    return;
  }
  const reader = new FileReader();
  reader.onload = () => keep(reader.result);
  reader.readAsDataURL(file);
});

$('previous').addEventListener('click', () => { if (step > 1) { step--; showStep(); } });
$('next').addEventListener('click', () => {
  const errs = K.erreursEtape(step, state);
  if (errs.length) { showErrors(errs); form.querySelector(`[data-key="${errs[0].cle}"]`)?.focus(); return; }
  if (step < TOTAL) { step++; showStep(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});
$('clear-data').addEventListener('click', () => {
  if (!window.confirm('Effacer toutes les réponses enregistrées dans ce navigateur?')) return;
  try { localStorage.removeItem(storageKey); } catch {}
  state = { ...initial }; step = 1; accentDarkManuel = false; saved = {};
  fillFields(); updatePreview(); showStep();
});

function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: type || 'text/plain;charset=utf-8' }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function renderFinish() {
  const c = K.completer(state);
  const files = K.fichiersKiosque(c, { categories: prefill.categories || [], tags: prefill.tags || [] });
  const sections = K.lireSections(c.sections);
  const fictif = /quorum|d[ée]monstration|exemple|nom-utilisateur/i.test([c.name, c.institution, c.siteUrl].join(' '));
  $('review-summary').innerHTML = [
    ['Journal', `${esc(c.name)}<br>${esc(c.institution)}`],
    ['Apparence', `<span class="swatch" style="background:${esc(c.accent)}"></span> ${esc(c.accent)} · sombre ${esc(c.accentDark)}${c.logo ? ' · logo' : ''}`],
    ['Sections', esc(sections.map((s) => s.name).join(', '))],
    ['À vérifier', fictif ? '<span class="warning">Des valeurs fictives restent : remplacez-les avant de publier.</span>' : 'Rien à signaler.'],
  ].map(([t, v]) => `<article><h2>${t}</h2><p>${v}</p></article>`).join('');
  $('generated-files').innerHTML = '<p class="hint">Fichiers produits :</p>' + files.map((f) => `<article class="file-card"><header><code>${esc(f.path)}</code></header><pre><code>${esc(f.content)}</code></pre></article>`).join('');
  $('download-zip').onclick = () => download(c.slug + '-configuration.zip', zipStore(files), 'application/zip');
  $('download-wp').onclick = () => download(K.FICHIER_EXPORT, files.find((f) => f.path === K.FICHIER_EXPORT).content, 'application/json');
  $('open-admin').href = prefill.adminPath || basePath + '/demo/admin/';
  persistDemoBootstrap(c);
}

function persistDemoBootstrap(c) {
  const bootstrap = { ...c, sections: K.lireSections(c.sections), users: K.lireUtilisateurs(c.users), demoContent: c.startEmpty ? false : c.demoContent };
  const req = indexedDB.open('kiosque-configurateur', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('bootstraps');
  req.onsuccess = () => {
    const tx = req.result.transaction('bootstraps', 'readwrite');
    tx.objectStore('bootstraps').put(bootstrap, prefill.databaseKey || 'kiosque-' + (basePath || 'root') + '-le-quorum');
    tx.oncomplete = () => req.result.close();
  };
}

// ZIP « stocké » (sans compression), sans dépendance.
function crc32(bytes) {
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) { crc ^= bytes[i]; for (let b = 0; b < 8; b++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ -1) >>> 0;
}
const word = (v) => [v & 255, (v >>> 8) & 255];
const dword = (v) => word(v).concat(word(v >>> 16));
function join(parts) {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function zipStore(files) {
  const enc = new TextEncoder();
  const local = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.path), data = enc.encode(f.content), sum = crc32(data);
    const h = new Uint8Array([80, 75, 3, 4, ...word(20), ...word(0x800), ...word(0), ...word(0), ...word(0), ...dword(sum), ...dword(data.length), ...dword(data.length), ...word(name.length), ...word(0)]);
    local.push(h, name, data);
    central.push(new Uint8Array([80, 75, 1, 2, ...word(20), ...word(20), ...word(0x800), ...word(0), ...word(0), ...word(0), ...dword(sum), ...dword(data.length), ...dword(data.length), ...word(name.length), ...word(0), ...word(0), ...word(0), ...word(0), ...dword(0), ...dword(offset)]), name);
    offset += h.length + name.length + data.length;
  }
  const L = join(local), C = join(central);
  return join([L, C, new Uint8Array([80, 75, 5, 6, ...word(0), ...word(0), ...word(files.length), ...word(files.length), ...dword(C.length), ...dword(L.length), ...word(0)])]);
}

fillFields();
updatePreview();
showStep();
