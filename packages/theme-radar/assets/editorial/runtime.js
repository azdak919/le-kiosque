import { DemoBackendPGlite } from './demo-backend.js';

let backendPromise;

function manifest() {
  const value = window.KIOSQUE_EDITORIAL;
  if (!value) throw new Error('Le manifeste éditorial local est absent.');
  return value;
}

export async function readConfiguratorBootstrap() {
  const config = manifest();
  return new Promise((resolve) => {
    const request = indexedDB.open('kiosque-configurateur', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('bootstraps');
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const tx = request.result.transaction('bootstraps', 'readonly');
      const get = tx.objectStore('bootstraps').get(config.databaseKey);
      get.onerror = () => resolve(null);
      get.onsuccess = () => resolve(get.result || null);
      tx.oncomplete = () => request.result.close();
    };
  });
}

/**
 * PGlite (≈ 5 Mo wasm + données) ne se charge que pour /admin/ ou pour un
 * navigateur qui a déjà ouvert l’admin (ou le configurateur) : les lecteurs
 * reçoivent le HTML statique, identique au rendu initial.
 */
export function editorialFlagKey() {
  return `kiosque-editorial-actif:${manifest().databaseKey}`;
}

export function markEditorialActive() {
  try { localStorage.setItem(editorialFlagKey(), '1'); } catch (_) { /* stockage bloqué */ }
}

export async function editorialNeeded() {
  if (/\/admin(\/|$)/.test(location.pathname)) return true;
  try { if (localStorage.getItem(editorialFlagKey())) return true; } catch (_) { return true; }
  return Boolean(await readConfiguratorBootstrap());
}

export async function getBackend() {
  markEditorialActive();
  if (!backendPromise) {
    backendPromise = (async () => {
      const config = manifest();
      const backend = new DemoBackendPGlite();
      await backend.init({
        basePath: config.publicBasePath,
        publicationSlug: config.publicationSlug,
        databaseName: config.databaseKey,
        assetsBase: config.assetsBase,
        seedUrl: config.seedUrl,
        bootstrap: await readConfiguratorBootstrap(),
      });
      return backend;
    })();
  }
  return backendPromise;
}

export function slugify(input) {
  return String(input || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 96);
}

export function download(name, content, type = 'application/octet-stream') {
  const href = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
