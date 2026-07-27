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

export async function getBackend() {
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
