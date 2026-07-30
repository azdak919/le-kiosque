/*
 * LE KIOSQUE — JavaScript du site publié (progressive enhancement).
 *
 * Thème clair/sombre (système + choix), mât (shuffle, météo), suite du fil
 * (« Plus d’articles »), défilement des titres, barre radio. Le site reste
 * lisible si ce fichier ne se charge jamais.
 */
(function () {
  'use strict';

  // ── Thème ────────────────────────────────────────────────────────────────
  // Le choix explicite l'emporte sur la préférence système ; sans choix, on
  // suit le système (géré en CSS, pas ici).
  var STORAGE_KEY = 'kiosque-theme';
  var root = document.documentElement;

  function currentTheme() {
    var stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (_) {}
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark' : 'light';
  }

  function applyTheme(theme, persist) {
    var isDark = theme === 'dark';
    // Attribut explicite (comme LE-RADAR) pour que le CSS dark/light soit déterministe.
    root.setAttribute('data-theme', theme);
    if (persist !== false) {
      try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
    }
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      // Icône = action au clic, pas l’état courant (LE-RADAR app.js applyTheme) :
      // mode sombre → soleil (passer en clair) ; mode clair → lune (passer en sombre).
      var sun = btn.querySelector('.ico-sun');
      var moon = btn.querySelector('.ico-moon');
      if (sun) sun.classList.toggle('hidden', !isDark);
      if (moon) moon.classList.toggle('hidden', isDark);
      var label = isDark ? 'Passer en mode clair' : 'Passer en mode sombre';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
      btn.removeAttribute('aria-pressed');
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#0e0f12' : '#ffffff');
  }

  function releaseToolButton(btn) {
    // Évite l’état « engagé » (focus clavier / :active sticky sur mobile).
    if (!btn) return;
    try {
      requestAnimationFrame(function () {
        if (document.activeElement === btn) btn.blur();
      });
    } catch (_) {
      try { btn.blur(); } catch (__) {}
    }
  }

  /** Comme LE-RADAR initMastheadActions : blur après tap/clic sur les outils du mât. */
  function initMastheadToolRelease() {
    document.querySelectorAll('.masthead-tools .masthead-tool').forEach(function (el) {
      var release = function () { releaseToolButton(el); };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('click', release);
      // Liens (accueil, RSS…) : évite le style :hover « collé » après un tap tactile.
      el.addEventListener('touchend', function () {
        window.setTimeout(function () { releaseToolButton(el); }, 50);
      }, { passive: true });
    });
  }

  // ── Mât : heure, photos locales et météo facultative ───────────────────
  function initMastheadClock() {
    var date = document.querySelector('[data-masthead-date]');
    var time = document.querySelector('[data-masthead-time]');
    if (!date || !time) return;
    function refresh() {
      var now = new Date();
      date.textContent = new Intl.DateTimeFormat('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
      time.textContent = new Intl.DateTimeFormat('fr-CA', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
      time.dateTime = now.toISOString();
    }
    refresh();
    setInterval(refresh, 30000);
  }

  /**
   * Cadrage vertical auto pour object-fit:cover — port simplifié de
   * LE-RADAR (quebec-backgrounds.js#computeBestFocalY, mode campus).
   * Retourne focalY ∈ [0,1] (0 = haut de l’image, 1 = bas) pour
   * object-position: 50% {focalY*100}%.
   */
  function computeMastheadFocalY(img, mastheadAr) {
    var w = img.naturalWidth || 0;
    var h = img.naturalHeight || 0;
    if (w < 32 || h < 32) return 0.5;
    var ar = w / h;
    var visibleFrac = ar / Math.max(mastheadAr || 3.55, 1.5);
    if (visibleFrac >= 0.98) return 0.5;
    visibleFrac = Math.min(0.95, Math.max(0.12, visibleFrac));

    var sampleW = 160;
    var sampleH = Math.max(48, Math.round(sampleW / ar));
    var canvas = document.createElement('canvas');
    canvas.width = sampleW;
    canvas.height = sampleH;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 0.5;
    try { ctx.drawImage(img, 0, 0, sampleW, sampleH); }
    catch (_) { return 0.5; }
    var data;
    try { data = ctx.getImageData(0, 0, sampleW, sampleH).data; }
    catch (_) { return 0.5; }

    var rowEdge = new Float32Array(sampleH);
    var rowMean = new Float32Array(sampleH);
    var rowSky = new Float32Array(sampleH);
    var rowBuild = new Float32Array(sampleH);
    for (var y = 0; y < sampleH; y++) {
      var edge = 0, mean = 0, sky = 0, build = 0;
      for (var x = 0; x < sampleW; x++) {
        var i = (y * sampleW + x) * 4;
        var r = data[i], g = data[i + 1], b = data[i + 2];
        var L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        mean += L;
        // Ciel approximatif : bleu-gris clair, saturation faible.
        if (L > 0.55 && b >= g * 0.9 && b >= r * 0.95) sky += 1;
        // Masse bâtie : brique/béton/vitrage (pas trop saturé, bords).
        if (L > 0.18 && L < 0.72) {
          var mx = Math.max(r, g, b) / 255;
          var mn = Math.min(r, g, b) / 255;
          var sat = (mx - mn) / (mx + 1e-6);
          if (sat < 0.35) build += 1;
        }
        if (x > 0) {
          var j = (y * sampleW + x - 1) * 4;
          var L0 = (0.2126 * data[j] + 0.7152 * data[j + 1] + 0.0722 * data[j + 2]) / 255;
          edge += Math.abs(L - L0);
        }
        if (y > 0) {
          var k = ((y - 1) * sampleW + x) * 4;
          var L1 = (0.2126 * data[k] + 0.7152 * data[k + 1] + 0.0722 * data[k + 2]) / 255;
          edge += Math.abs(L - L1);
        }
      }
      rowEdge[y] = edge / sampleW;
      rowMean[y] = mean / sampleW;
      rowSky[y] = sky / sampleW;
      rowBuild[y] = build / sampleW;
    }

    var win = Math.max(4, Math.round(sampleH * visibleFrac));
    var bestY0 = 0;
    var bestScore = -1e9;
    var maxY0 = Math.max(0, sampleH - win);
    for (var y0 = 0; y0 <= maxY0; y0++) {
      var e = 0, sk = 0, bd = 0, m = 0;
      for (var yy = y0; yy < y0 + win; yy++) {
        e += rowEdge[yy];
        sk += rowSky[yy];
        bd += rowBuild[yy];
        m += rowMean[yy];
      }
      e /= win; sk /= win; bd /= win; m /= win;
      // Campus : structure + un peu de ciel en tête, éviter parking/vase bas.
      var score = e * 1.35 + bd * 1.1 - Math.max(0, sk - 0.42) * 0.9;
      // Pénaliser une fenêtre trop basse (souvent parking / herbe).
      var bottomBias = y0 / Math.max(1, maxY0);
      score -= Math.max(0, bottomBias - 0.55) * 0.45;
      // Un peu de ciel en haut de bande est bienvenu.
      var topSky = 0;
      for (var t = y0; t < y0 + Math.max(2, Math.round(win * 0.22)); t++) topSky += rowSky[t];
      topSky /= Math.max(1, Math.round(win * 0.22));
      if (topSky > 0.12 && topSky < 0.7) score += 0.25;
      if (score > bestScore) { bestScore = score; bestY0 = y0; }
    }

    // topFrac = (1 − visibleFrac) · focalY  ⇒  focalY = topFrac / (1 − visibleFrac)
    var topFrac = bestY0 / sampleH;
    var denom = 1 - visibleFrac;
    if (denom < 1e-6) return 0.5;
    return Math.min(1, Math.max(0, topFrac / denom));
  }

  function mastheadAspectRatio(masthead) {
    if (masthead && masthead.clientWidth > 40 && masthead.clientHeight > 20) {
      return Math.max(2.5, masthead.clientWidth / masthead.clientHeight);
    }
    return 3.55;
  }

  function parseAuthoredFocalY(position) {
    // "50% 48%" → 0.48 ; null si absent ou purement horizontal.
    if (!position || typeof position !== 'string') return null;
    var parts = position.trim().split(/\s+/);
    if (parts.length < 2) return null;
    var m = /^([\d.]+)%$/.exec(parts[1]);
    if (!m) return null;
    var y = Number(m[1]) / 100;
    return Number.isFinite(y) ? Math.min(1, Math.max(0, y)) : null;
  }

  /**
   * Mât illustré — lit toujours le DOM courant.
   * Important : applyBranding (PGlite) remplace img + #masthead-backgrounds ;
   * on ne doit jamais garder de références mortes (sinon shuffle « mort »).
   */
  var mastheadBgState = {
    index: 0,
    hasShown: false,
    shuffleBusy: false,
    activeTransition: null,
    bound: false,
    resizeBound: false,
  };

  function resolveAssetUrl(src) {
    if (!src) return '';
    try { return new URL(src, window.location.href).href; }
    catch (_) { return String(src); }
  }

  function sameSrc(a, b) {
    if (!a || !b) return false;
    try {
      var ua = new URL(a, window.location.href);
      var ub = new URL(b, window.location.href);
      return ua.pathname === ub.pathname;
    } catch (_) {
      return String(a) === String(b);
    }
  }

  function readMastheadImages() {
    var data = document.getElementById('masthead-backgrounds');
    if (!data) return [];
    var images = [];
    try { images = JSON.parse(data.textContent || '[]'); } catch (_) { images = []; }
    if (!Array.isArray(images)) return [];
    return images.filter(function (item) { return item && item.src; }).map(function (item) {
      return Object.assign({}, item, { src: resolveAssetUrl(item.src) });
    });
  }

  function liveMastheadImage() {
    return document.querySelector('[data-masthead-background]');
  }

  function liveMasthead() {
    var image = liveMastheadImage();
    return image ? image.closest('.masthead') : document.querySelector('.masthead');
  }

  function cancelMastheadTransition() {
    if (mastheadBgState.activeTransition && typeof mastheadBgState.activeTransition.cancel === 'function') {
      mastheadBgState.activeTransition.cancel();
    }
    mastheadBgState.activeTransition = null;
    var masthead = liveMasthead();
    masthead?.querySelectorAll('.masthead-background-transition').forEach(function (node) {
      node.remove();
    });
  }

  function computeObjectPosition(item, imgEl, masthead) {
    var authored = parseAuthoredFocalY(item.backgroundPosition);
    var ar = mastheadAspectRatio(masthead);
    var focalY = 0.5;
    try {
      if (authored != null && (authored < 0.42 || authored > 0.58)) {
        focalY = authored;
      } else if (imgEl && imgEl.naturalWidth > 32) {
        focalY = computeMastheadFocalY(imgEl, ar);
        if (authored != null) focalY = authored * 0.25 + focalY * 0.75;
      } else if (authored != null) {
        focalY = authored;
      }
    } catch (_) {
      focalY = authored != null ? authored : 0.5;
    }
    var pct = Math.round(focalY * 1000) / 10;
    return '50% ' + pct + '%';
  }

  function updateMastheadCredit(item) {
    var credit = document.querySelector('[data-masthead-credit]');
    if (!credit) return;
    credit.replaceChildren();
    if (!item || !item.credit) return;
    var label = 'Photo : ' + item.credit;
    if (item.creditUrl && /^https:\/\//i.test(item.creditUrl)) {
      var link = document.createElement('a');
      link.href = item.creditUrl;
      link.rel = 'noopener';
      link.textContent = label;
      credit.appendChild(link);
    } else {
      credit.textContent = label;
    }
  }

  function commitMastheadImage(item, options) {
    options = options || {};
    var image = liveMastheadImage();
    var masthead = liveMasthead();
    if (!image || !item) return;
    masthead?.classList.remove('masthead--image-error');
    var nextSrc = resolveAssetUrl(item.src);
    var current = image.currentSrc || image.getAttribute('src') || '';
    if (!sameSrc(current, nextSrc)) image.src = nextSrc;
    function place() {
      masthead?.classList.remove('masthead--image-error');
      image.style.objectPosition = computeObjectPosition(item, image, masthead);
    }
    if (options.preservePosition) {
      var existing = (image.style && image.style.objectPosition) || '';
      if (!existing) {
        if (image.complete && image.naturalWidth > 0) place();
        else image.addEventListener('load', place, { once: true });
      }
    } else {
      if (image.complete && image.naturalWidth > 0) place();
      else image.addEventListener('load', place, { once: true });
    }
    updateMastheadCredit(item);
    mastheadBgState.hasShown = true;
  }

  function showMastheadIndex(next, options) {
    options = options || {};
    var images = readMastheadImages();
    var image = liveMastheadImage();
    var masthead = liveMasthead();
    if (!images.length || !image) {
      mastheadBgState.shuffleBusy = false;
      return;
    }
    mastheadBgState.index = ((next % images.length) + images.length) % images.length;
    var item = images[mastheadBgState.index];
    var reduceMotion = false;
    try {
      reduceMotion = !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_) {}

    var currentSrc = image.currentSrc || image.getAttribute('src') || '';
    var nextSrc = resolveAssetUrl(item.src);
    var shouldCrossfade =
      options.animate !== false &&
      mastheadBgState.hasShown &&
      currentSrc &&
      !sameSrc(currentSrc, nextSrc) &&
      !reduceMotion &&
      image.isConnected;

    if (!shouldCrossfade) {
      cancelMastheadTransition();
      commitMastheadImage(item, { preservePosition: options.preservePosition === true });
      mastheadBgState.shuffleBusy = false;
      return;
    }

    cancelMastheadTransition();
    var incoming = document.createElement('img');
    incoming.className = 'masthead-background masthead-background-transition';
    incoming.alt = '';
    incoming.setAttribute('aria-hidden', 'true');
    incoming.decoding = 'async';
    if (image.parentNode) {
      if (image.nextSibling) image.parentNode.insertBefore(incoming, image.nextSibling);
      else image.parentNode.appendChild(incoming);
    }

    var settled = false;
    var fadeStarted = false;
    var timer = 0;

    function settle() {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      commitMastheadImage(item);
      mastheadBgState.shuffleBusy = false;
      try { incoming.remove(); } catch (_) {}
      if (mastheadBgState.activeTransition && mastheadBgState.activeTransition.incoming === incoming) {
        mastheadBgState.activeTransition = null;
      }
    }

    mastheadBgState.activeTransition = {
      incoming: incoming,
      cancel: function () {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        mastheadBgState.shuffleBusy = false;
        try { incoming.remove(); } catch (_) {}
        if (mastheadBgState.activeTransition && mastheadBgState.activeTransition.incoming === incoming) {
          mastheadBgState.activeTransition = null;
        }
      },
    };

    function startFade() {
      if (settled || fadeStarted) return;
      fadeStarted = true;
      masthead?.classList.remove('masthead--image-error');
      var position;
      try {
        position = computeObjectPosition(item, incoming, masthead);
      } catch (_) {
        position = item.backgroundPosition || '50% 50%';
      }
      incoming.style.objectPosition = position;
      if (!sameSrc(image.currentSrc || image.getAttribute('src') || '', nextSrc)) {
        image.src = nextSrc;
      }
      image.style.objectPosition = position;
      updateMastheadCredit(item);
      mastheadBgState.hasShown = true;
      incoming.addEventListener('transitionend', function (event) {
        if (event.propertyName === 'opacity') settle();
      }, { once: true });
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (!settled) incoming.classList.add('is-visible');
        });
      });
      timer = window.setTimeout(settle, 560);
    }

    incoming.addEventListener('error', function () {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      try { incoming.remove(); } catch (_) {}
      mastheadBgState.activeTransition = null;
      commitMastheadImage(item);
      mastheadBgState.shuffleBusy = false;
    }, { once: true });
    incoming.addEventListener('load', startFade, { once: true });
    incoming.src = nextSrc;
    if (incoming.complete && incoming.naturalWidth > 0) startFade();
  }

  function pickNextMastheadIndex() {
    var images = readMastheadImages();
    if (images.length < 2) return 0;
    var image = liveMastheadImage();
    var current = resolveAssetUrl(
      (image && (image.currentSrc || image.getAttribute('src'))) ||
      (images[mastheadBgState.index] && images[mastheadBgState.index].src) ||
      '',
    );
    var candidates = [];
    for (var i = 0; i < images.length; i++) {
      if (!sameSrc(images[i].src, current)) candidates.push(i);
    }
    if (!candidates.length) return (mastheadBgState.index + 1) % images.length;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function rebindMastheadBackgrounds() {
    var images = readMastheadImages();
    var image = liveMastheadImage();
    if (!images.length || !image) return;
    // Resync l’index sur la photo actuellement peinte (après applyBranding).
    var paintedSrc = image.getAttribute('src') || image.currentSrc || '';
    mastheadBgState.index = 0;
    for (var i = 0; i < images.length; i++) {
      if (sameSrc(images[i].src, paintedSrc)) {
        mastheadBgState.index = i;
        break;
      }
    }
    // Ne pas recharger si c’est déjà la bonne photo ; marquer hasShown pour le prochain shuffle.
    mastheadBgState.hasShown = true;
    cancelMastheadTransition();
    if (!image.dataset.errorBound) {
      image.dataset.errorBound = '1';
      image.addEventListener('error', function () {
        liveMasthead()?.classList.add('masthead--image-error');
      });
    }
    var shuffleBtn = document.getElementById('masthead-shuffle');
    if (shuffleBtn) {
      shuffleBtn.type = 'button';
      shuffleBtn.removeAttribute('disabled');
      shuffleBtn.hidden = images.length < 2;
    }
  }

  function initMastheadBackgrounds() {
    rebindMastheadBackgrounds();
    if (mastheadBgState.bound) return;
    mastheadBgState.bound = true;

    document.addEventListener('click', function (event) {
      var btn = event.target && event.target.closest
        ? event.target.closest('#masthead-shuffle, .masthead-shuffle')
        : null;
      if (!btn) return;
      event.preventDefault();
      if (mastheadBgState.shuffleBusy) return;
      if (readMastheadImages().length < 2) return;
      mastheadBgState.shuffleBusy = true;
      showMastheadIndex(pickNextMastheadIndex(), { animate: true });
      releaseToolButton(btn);
      window.setTimeout(function () { mastheadBgState.shuffleBusy = false; }, 900);
    });

    if (!mastheadBgState.resizeBound) {
      mastheadBgState.resizeBound = true;
      var resizeTimer;
      window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
          var images = readMastheadImages();
          var image = liveMastheadImage();
          var item = images[mastheadBgState.index];
          if (item && image) {
            image.style.objectPosition = computeObjectPosition(item, image, liveMasthead());
          }
        }, 160);
      }, { passive: true });
    }
  }

  window.KiosqueRefreshMastheadBackgrounds = rebindMastheadBackgrounds;

  /** Mêmes libellés de fichier que LE-RADAR (assets/meteocons/animated). */
  function weatherIconName(code, isDay) {
    var day = isDay !== 0;
    if (code === 0) return day ? 'clear-day' : 'clear-night';
    if (code === 1 || code === 2) return day ? 'partly-cloudy-day' : 'partly-cloudy-night';
    if (code === 3) return day ? 'overcast-day' : 'overcast-night';
    if (code === 45 || code === 48) return day ? 'fog-day' : 'fog-night';
    if ([51, 53, 55, 56, 57].indexOf(code) !== -1) return 'drizzle';
    if ([61, 63, 65, 66, 67, 80, 81, 82].indexOf(code) !== -1) return 'rain';
    if ([71, 73, 75, 77, 85, 86].indexOf(code) !== -1) return 'snow';
    if ([95, 96, 99].indexOf(code) !== -1) return day ? 'thunderstorms-day' : 'thunderstorms-night';
    return day ? 'overcast-day' : 'overcast-night';
  }

  function weatherTone(code) {
    if (code === 0 || code === 1 || code === 2) return '#f0b429';
    if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].indexOf(code) !== -1) return '#5b9fd4';
    if ([71, 73, 75, 77, 85, 86].indexOf(code) !== -1) return '#a8c5d4';
    if ([95, 96, 99].indexOf(code) !== -1) return '#8b7ec8';
    return '#8fa3b0';
  }

  /**
   * Normalise une localité YAML (string ou objet CMS).
   * Coords optionnelles = OpenStreetMap / Open-Meteo ; slugs optionnels = liens officiels.
   */
  function normalizeWeatherLocality(raw) {
    if (typeof raw === 'string') return { name: raw.trim() };
    if (!raw || typeof raw !== 'object') return null;
    var name = String(raw.name || '').trim();
    if (!name) return null;
    var lat = Number(raw.latitude);
    var lon = Number(raw.longitude);
    return {
      name: name,
      latitude: Number.isFinite(lat) ? lat : undefined,
      longitude: Number.isFinite(lon) ? lon : undefined,
      meteomediaSlug: raw.meteomediaSlug ? String(raw.meteomediaSlug).trim() : '',
      envcanUrl: raw.envcanUrl ? String(raw.envcanUrl).trim() : '',
      osmId: raw.osmId != null && raw.osmId !== '' ? String(raw.osmId) : '',
    };
  }

  /** Slug MétéoMédia (même algorithme que LE-RADAR weatherLocationSlug). */
  function weatherLocationSlug(name, override) {
    if (override) return String(override).replace(/^\/+|\/+$/g, '');
    return String(name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2019\u0027`]/g, '')
      .replace(/[–—]/g, '-')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .split('-')
      .filter(Boolean)
      .join('-');
  }

  function meteomediaUrl(name, slugOverride) {
    var slug = weatherLocationSlug(name, slugOverride);
    if (!slug) return '';
    return 'https://www.meteomedia.com/fr/ville/ca/quebec/' + slug + '/actuelle';
  }

  /** Page ville Environnement Canada (coords WGS84 — API location). */
  function envcanUrl(lat, lon, override) {
    if (override && /^https:\/\//i.test(override)) return override;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
    return 'https://weather.gc.ca/fr/location/index.html?coords='
      + encodeURIComponent(Number(lat).toFixed(4) + ',' + Number(lon).toFixed(4));
  }

  var weatherDocked = false;
  var weatherHomeParent = null;
  var weatherHomeNext = null;
  var WEATHER_PHONE_MQ = typeof window.matchMedia === 'function'
    ? window.matchMedia('(max-width: 720px)')
    : null;

  /**
   * Dock mobile : on déplace le bandeau .masthead-status (météo + sports)
   * sous le tuner, pour ne pas écraser le mât et éviter le clipping.
   * Repli : ancienne cible .masthead-weather seule.
   */
  function mastheadStatusHost() {
    return document.querySelector('[data-masthead-status]')
      || document.querySelector('.masthead-weather[data-weather-localities]')
      || document.querySelector('.masthead-sports[data-sports-payload]');
  }

  function setMastheadWeatherDocked(docked) {
    var host = mastheadStatusHost();
    var dock = document.getElementById('masthead-weather-dock');
    if (!host || !dock) return;
    if (!weatherHomeParent) {
      weatherHomeParent = host.parentNode;
      weatherHomeNext = host.nextSibling;
    }
    if (docked === weatherDocked) return;
    weatherDocked = docked;
    host.classList.toggle('masthead-weather--docked', docked);
    host.classList.toggle('masthead-status--docked', docked);
    if (docked) {
      dock.hidden = false;
      dock.appendChild(host);
    } else if (weatherHomeParent) {
      weatherHomeParent.insertBefore(host, weatherHomeNext);
      if (!dock.childNodes.length) dock.hidden = true;
    }
  }

  function syncMastheadWeatherDock() {
    var shouldDock = WEATHER_PHONE_MQ ? WEATHER_PHONE_MQ.matches : (window.innerWidth <= 720);
    setMastheadWeatherDocked(shouldDock);
  }

  /* Rotation scoreboard — deck brassé (Fisher–Yates), animation is-arriving.
   * Format type RDS/TVA : codes + score (pas de prose longue).
   * Marquee : pauses aux extrémités (keyframes) + dwell = 1 cycle aller-retour. */
  var SPORTS_ROTATE_MIN_MS = 5600;
  /* Vitesse lente (~20 px/s) pour laisser lire score + codes. */
  var SPORTS_MARQUEE_PX_PER_S = 20;
  var SPORTS_MARQUEE_MIN_SEC = 7;
  var SPORTS_ARRIVE_MS = 500;
  /* Palette par sport (import LE-RADAR) — évite le tout-rouge des prochains matchs. */
  var SPORTS_SPORT_TONES = {
    football: '#c45c2a',
    basketball: '#d88a0a',
    soccer: '#3d9a6a',
    volleyball: '#3b82c4',
    hockey: '#5498bb',
    default: '#66839e',
  };
  /** Bureau mât : noms d’équipes + institutions (carte plus large). */
  var SPORTS_DESKTOP_MQ = '(min-width: 721px)';
  var sportsPayloadCache = null;
  var sportsSlides = [];
  var sportsDeck = [];
  var sportsTimer = null;
  var sportsReducedMotion = false;
  try {
    sportsReducedMotion = !!(window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (_) {}

  function clearSportsRotateTimer() {
    if (sportsTimer) {
      window.clearTimeout(sportsTimer);
      sportsTimer = null;
    }
  }

  function scheduleSportsRotate(delayMs) {
    clearSportsRotateTimer();
    if (sportsSlides.length < 2 || sportsReducedMotion) return;
    var wait = Math.max(SPORTS_ROTATE_MIN_MS, delayMs | 0);
    sportsTimer = window.setTimeout(function () {
      sportsTimer = null;
      rotateSportsChip();
    }, wait);
  }

  function sportsResultTone(result) {
    if (result === 'W') return '#3d9a6a';
    if (result === 'L') return '#c45c5c';
    if (result === 'D' || result === 'T') return '#8fa3b0';
    return SPORTS_SPORT_TONES.default;
  }

  function sportsSportTone(sport) {
    var s = String(sport || '').toLowerCase();
    if (s.indexOf('basket') !== -1) return SPORTS_SPORT_TONES.basketball;
    if (s.indexOf('hockey') !== -1) return SPORTS_SPORT_TONES.hockey;
    if (s.indexOf('soccer') !== -1) return SPORTS_SPORT_TONES.soccer;
    if (s.indexOf('volley') !== -1) return SPORTS_SPORT_TONES.volleyball;
    if (s.indexOf('football') !== -1 || s.indexOf('flag') !== -1) return SPORTS_SPORT_TONES.football;
    return SPORTS_SPORT_TONES.default;
  }

  function sportsSlideTone(display) {
    if (!display) return SPORTS_SPORT_TONES.default;
    if (display.mode === 'result' && display.game && display.game.result) {
      return sportsResultTone(display.game.result);
    }
    return sportsSportTone((display.game && display.game.sport) || (display.team && display.team.sport));
  }

  /** Mobile : codes institution. Bureau (≥721 px) : noms + institutions. */
  function sportsIsDesktopLabel() {
    try {
      return !!(window.matchMedia && window.matchMedia(SPORTS_DESKTOP_MQ).matches);
    } catch (_) {
      return false;
    }
  }

  /** « Les Élans » → « Élans » pour la puce (place limitée). */
  function sportsShortTeamName(name) {
    var n = String(name || '').trim();
    return n.replace(/^(Les|Le|La|L’|L')\s+/i, '') || n;
  }

  function sportsShortInstitution(inst) {
    var s = String(inst || '').trim();
    if (!s) return '';
    return s
      .replace(/^Cégep\s+(de\s+|du\s+|d’|d')?/i, '')
      .replace(/^Collège\s+/i, '')
      .replace(/^Champlain\s+College\s+/i, 'Champlain ')
      .replace(/^Université\s+(de\s+|du\s+|d’|d')?/i, '');
  }

  /**
   * Bureau : équipe maison = surnom seul (le journal est déjà celui du campus).
   * Adversaire = surnom (institution) — focus-group le-kiosque-team-nickname.
   */
  function sportsHomeRichLabel(team) {
    return sportsShortTeamName(team && team.name) || String((team && team.code) || 'EQ').toUpperCase().slice(0, 4);
  }

  function sportsOppRichLabel(name, institution) {
    var short = sportsShortTeamName(name) || String(name || '').trim();
    var inst = sportsShortInstitution(institution);
    return short + (inst ? ' (' + inst + ')' : '');
  }

  function sportsGlyph(sport) {
    var s = String(sport || '').toLowerCase();
    if (s.indexOf('basket') !== -1) return '🏀';
    if (s.indexOf('hockey') !== -1) return '🏒';
    if (s.indexOf('soccer') !== -1 || (s.indexOf('foot') !== -1 && s.indexOf('flag') === -1)) return '⚽';
    if (s.indexOf('flag') !== -1 || s.indexOf('football') !== -1) return '🏈';
    if (s.indexOf('volley') !== -1) return '🏐';
    if (s.indexOf('cross') !== -1 || s.indexOf('athl') !== -1) return '🏃';
    return '🏅';
  }

  function shuffleSportsDeck(items) {
    var shuffled = items.slice();
    for (var i = shuffled.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }
    return shuffled;
  }

  function sportsTeamList(payload) {
    if (Array.isArray(payload.teams) && payload.teams.length) return payload.teams;
    if (payload.team) return [payload.team];
    return [];
  }

  function buildSportsSlides(payload) {
    var teams = sportsTeamList(payload);
    if (!teams.length) return [];
    var byId = {};
    teams.forEach(function (t) { byId[t.id] = t; });
    var slides = [];
    var globalResults = Array.isArray(payload.results) ? payload.results : [];

    teams.forEach(function (team) {
      var nested = Array.isArray(team.results) ? team.results : [];
      var fromGlobal = globalResults.filter(function (g) {
        return !g.teamId || g.teamId === team.id;
      });
      var merged = nested.concat(fromGlobal).slice().sort(function (a, b) {
        return String(b.date || '').localeCompare(String(a.date || ''));
      });
      /* Jusqu’à 2 résultats récents par équipe pour la variance du deck. */
      merged.slice(0, 2).forEach(function (game) {
        var slide = {
          mode: 'result',
          team: team,
          game: game,
          key: 'r:' + team.id + ':' + game.date + ':' + (game.opponentCode || game.opponent),
        };
        slide.tone = sportsSlideTone(slide);
        slides.push(slide);
      });
      var next = team.nextGame || null;
      if (!next && payload.nextGame && (!payload.nextGame.teamId || payload.nextGame.teamId === team.id)) {
        next = payload.nextGame;
      }
      if (!next && Array.isArray(payload.nextGames)) {
        next = payload.nextGames.find(function (n) {
          return !n.teamId || n.teamId === team.id;
        }) || null;
      }
      if (next) {
        var nextSlide = {
          mode: 'next',
          team: team,
          game: next,
          key: 'n:' + team.id + ':' + next.date + ':' + (next.opponentCode || next.opponent),
        };
        nextSlide.tone = sportsSlideTone(nextSlide);
        slides.push(nextSlide);
      }
    });
    return slides;
  }

  function refillSportsDeck(preferNotKey) {
    var pool = sportsSlides.slice();
    if (pool.length <= 1) {
      sportsDeck = pool.slice();
      return;
    }
    sportsDeck = shuffleSportsDeck(pool);
    /* Évite de rejouer tout de suite la même carte après un cycle (variance). */
    if (preferNotKey && sportsDeck.length > 1 && sportsDeck[0].key === preferNotKey) {
      var swap = sportsDeck[1];
      sportsDeck[1] = sportsDeck[0];
      sportsDeck[0] = swap;
    }
  }

  function formatSportsChipWhen(iso, time) {
    if (!iso) return '';
    var label = '';
    try {
      label = new Intl.DateTimeFormat('fr-CA', {
        day: 'numeric',
        month: 'short',
      }).format(new Date(iso + 'T12:00:00'));
    } catch (_) {
      label = iso;
    }
    if (time) {
      label += ' · ' + String(time).replace(':', ' h ');
    }
    return label;
  }

  /**
   * Marquee type bandeau météo LE-RADAR / RDS :
   * pauses aux extrémités dans les keyframes ; dwell = 1 aller-retour complet.
   */
  function applySportsLineMarquee(viewport, onReady) {
    if (!viewport) {
      if (onReady) onReady(SPORTS_ROTATE_MIN_MS);
      return;
    }
    var inner = viewport.querySelector('.sports-chip__line-inner') || viewport.firstElementChild;
    if (!inner) {
      if (onReady) onReady(SPORTS_ROTATE_MIN_MS);
      return;
    }
    viewport.classList.remove('is-sports-marquee');
    viewport.style.removeProperty('--sports-marquee-shift');
    viewport.style.removeProperty('--sports-marquee-duration');
    if (sportsReducedMotion) {
      if (onReady) onReady(SPORTS_ROTATE_MIN_MS);
      return;
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        /* +2 px : fin de course = dernier glyphe entièrement dans le viewport
         * (évite une carte qui semble encore coupée à droite en fin de défilement). */
        var overflow = Math.ceil(inner.scrollWidth - viewport.clientWidth) + 2;
        var dwellMs = SPORTS_ROTATE_MIN_MS;
        if (overflow > 4) {
          /* Une direction = pauses (keyframes ~20 %+20 %) + déplacement.
           * durationSec = un sens ; ×2 = aller + retour (animation alternate). */
          var durationSec = Math.max(
            SPORTS_MARQUEE_MIN_SEC,
            overflow / SPORTS_MARQUEE_PX_PER_S,
          );
          viewport.classList.add('is-sports-marquee');
          viewport.style.setProperty('--sports-marquee-shift', '-' + Math.round(overflow) + 'px');
          viewport.style.setProperty('--sports-marquee-duration', durationSec.toFixed(1) + 's');
          /* 2 sens + petite marge pour finir le hold de fin de cycle. */
          dwellMs = Math.round(durationSec * 1000) * 2 + 400;
        }
        if (onReady) onReady(Math.max(SPORTS_ROTATE_MIN_MS, dwellMs));
      });
    });
  }

  function sportsEl(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null && text !== '') el.textContent = text;
    return el;
  }

  /**
   * Format scoreboard (parité LE-RADAR / RDS) :
   *   mobile  — codes institution :  🏐 V  SLHH  3–1  GAR
   *   bureau  —  🏐 V  Élans  3–1  Boomerang (Garneau)
   *             (maison = surnom seul ; adversaire = surnom + institution)
   * Détail long toujours dans title/aria.
   */
  /**
   * Deep-link Au tableau — parité LE-RADAR sportsBoardHref :
   * /sports/?team=<id>&sport=<sport> → scroll + pulse de la carte formation.
   */
  function sportsBoardHref(display) {
    var base = (sportsPayloadCache && sportsPayloadCache.href) || '/sports/';
    try {
      var u = new URL(base, window.location.href);
      var teamId = display && display.team && display.team.id
        ? String(display.team.id).trim()
        : '';
      var sport = '';
      if (display && display.game && display.game.sport) sport = String(display.game.sport).toLowerCase();
      else if (display && display.team && display.team.sport) sport = String(display.team.sport).toLowerCase();
      if (sport) u.searchParams.set('sport', sport);
      if (teamId) u.searchParams.set('team', teamId);
      return u.pathname + u.search;
    } catch (_) {
      return base;
    }
  }

  function paintSportsChip(host, display, animate) {
    if (!host || !display) return;
    host.textContent = '';
    var team = display.team;
    var code = String(team.code || 'EQ').toUpperCase().slice(0, 4);
    var sport = display.game.sport || team.sport || '';
    var sportLabel = team.sportLabel || sport || '';
    var tone = display.tone || sportsSlideTone(display);
    var desktop = sportsIsDesktopLabel();
    var href = sportsBoardHref(display);
    var chip = document.createElement(href ? 'a' : 'span');
    chip.className = 'sports-chip masthead-sports__chip';
    if (desktop) chip.classList.add('sports-chip--rich');
    if (animate && !sportsReducedMotion) chip.classList.add('is-arriving');
    chip.style.setProperty('--sports-tone', tone);
    if (team.colors && team.colors.primary) {
      chip.style.setProperty('--sports-brand', team.colors.primary);
    }
    if (chip.tagName === 'A') {
      chip.href = href;
      /* SPA démo : même routeur que le menu (évite un full reload hors basePath). */
      chip.setAttribute('data-editorial-link', '');
    }
    if (team && team.id) chip.dataset.sportsTeam = String(team.id);

    var glyph = sportsEl('span', 'sports-chip__glyph', sportsGlyph(sport));
    glyph.setAttribute('aria-hidden', 'true');

    var viewport = sportsEl('span', 'sports-chip__line');
    var inner = sportsEl('span', 'sports-chip__line-inner');

    var homeCode = code;
    var homeRich = sportsHomeRichLabel(team);
    var homeLabel = desktop ? homeRich : homeCode;

    var titleParts = [];
    var aria = '';

    if (display.mode === 'result') {
      var g = display.game;
      var score = g.scoreFor + '–' + g.scoreAgainst;
      var badge = g.result === 'W' ? 'V' : g.result === 'L' ? 'D' : 'N';
      var badgeMod = g.result === 'W' ? 'w' : g.result === 'L' ? 'l' : 'd';
      var issue = g.result === 'W' ? 'Victoire' : g.result === 'L' ? 'Défaite' : 'Match nul';
      var oppCode = String(g.opponentCode || '').toUpperCase().slice(0, 4);
      var oppName = g.opponent || oppCode || 'Adversaire';
      var oppCompact = oppCode || String(oppName).slice(0, 8);
      var oppRich = sportsOppRichLabel(oppName, g.opponentInstitution);
      var oppLabel = desktop ? oppRich : oppCompact;

      var badgeEl = sportsEl('span', 'sports-chip__badge sports-chip__badge--' + badgeMod, badge);
      badgeEl.setAttribute('aria-hidden', 'true');
      chip.appendChild(glyph);
      chip.appendChild(badgeEl);

      inner.appendChild(sportsEl('span', desktop ? 'sports-chip__name' : 'sports-chip__code', homeLabel));
      inner.appendChild(document.createTextNode(' '));
      inner.appendChild(sportsEl('span', 'sports-chip__score', score));
      inner.appendChild(document.createTextNode(' '));
      inner.appendChild(sportsEl('span', (desktop ? 'sports-chip__name' : 'sports-chip__code') + ' sports-chip__opp', oppLabel));

      aria = issue + ' des ' + team.name
        + (sportLabel ? ' (' + sportLabel + ')' : '')
        + ' : ' + g.scoreFor + ' à ' + g.scoreAgainst + ' contre ' + oppName
        + (g.opponentInstitution ? ' (' + g.opponentInstitution + ')' : '');
      titleParts.push(issue + ' · ' + team.name);
      if (sportLabel) titleParts.push(sportLabel);
      titleParts.push(homeCode + ' ' + score + ' ' + oppCompact);
      if (oppName) titleParts.push(oppName);
      if (g.opponentInstitution) titleParts.push(g.opponentInstitution);
      if (g.competition) titleParts.push(g.competition);
      if (g.date) titleParts.push(formatSportsChipWhen(g.date));
    } else {
      var n = display.game;
      var nextCode = String(n.opponentCode || '').toUpperCase().slice(0, 4);
      var nextName = n.opponent || nextCode || 'Adversaire';
      var nextCompact = nextCode || String(nextName).slice(0, 8);
      var nextRich = sportsOppRichLabel(nextName, n.opponentInstitution);
      var nextLabel = desktop ? nextRich : nextCompact;
      var when = formatSportsChipWhen(n.date, n.time);

      chip.appendChild(glyph);

      inner.appendChild(sportsEl('span', desktop ? 'sports-chip__name' : 'sports-chip__code', homeLabel));
      inner.appendChild(document.createTextNode(' '));
      inner.appendChild(sportsEl('span', 'sports-chip__vs', 'vs'));
      inner.appendChild(document.createTextNode(' '));
      inner.appendChild(sportsEl('span', (desktop ? 'sports-chip__name' : 'sports-chip__code') + ' sports-chip__opp', nextLabel));
      if (when) {
        inner.appendChild(document.createTextNode(' · '));
        inner.appendChild(sportsEl('span', 'sports-chip__when', when));
      }

      aria = 'Prochain match des ' + team.name
        + (sportLabel ? ' (' + sportLabel + ')' : '')
        + ' contre ' + nextName
        + (n.opponentInstitution ? ' (' + n.opponentInstitution + ')' : '')
        + (when ? ' le ' + when : '');
      titleParts.push('Prochain · ' + team.name);
      if (sportLabel) titleParts.push(sportLabel);
      titleParts.push(homeCode + ' vs ' + nextCompact);
      if (nextName) titleParts.push(nextName);
      if (n.opponentInstitution) titleParts.push(n.opponentInstitution);
      if (when) titleParts.push(when);
      if (n.home === true) titleParts.push('Domicile');
      else if (n.home === false) titleParts.push('Extérieur');
      if (n.competition) titleParts.push(n.competition);
    }
    viewport.appendChild(inner);
    chip.title = titleParts.join(' · ');
    chip.setAttribute('aria-label', aria);
    chip.dataset.sportsKey = display.key || '';
    chip.dataset.sportsMode = display.mode || '';
    chip.dataset.sportsSport = sport || '';
    chip.dataset.sportsDensity = desktop ? 'rich' : 'codes';

    chip.appendChild(viewport);
    host.appendChild(chip);
    host.hidden = false;

    function afterMarqueeReady(dwellMs) {
      scheduleSportsRotate(dwellMs);
    }
    if (animate && !sportsReducedMotion) {
      applySportsLineMarquee(viewport);
      window.setTimeout(function () {
        if (!chip.isConnected) return;
        chip.classList.remove('is-arriving');
        applySportsLineMarquee(viewport, afterMarqueeReady);
      }, SPORTS_ARRIVE_MS);
    } else {
      applySportsLineMarquee(viewport, afterMarqueeReady);
    }
  }

  function rotateSportsChip() {
    var host = document.querySelector('.masthead-sports[data-sports-payload]');
    if (!host || sportsSlides.length < 2) return;
    if (!sportsDeck.length) {
      var current = host.querySelector('.sports-chip');
      refillSportsDeck(current && current.dataset.sportsKey);
    }
    var next = sportsDeck.shift();
    if (!next) return;
    paintSportsChip(host, next, true);
    syncMastheadWeatherDock();
  }

  function initMastheadSports() {
    clearSportsRotateTimer();
    var host = document.querySelector('.masthead-sports[data-sports-payload]');
    if (!host) return;
    var payload;
    try {
      payload = JSON.parse(host.getAttribute('data-sports-payload') || host.dataset.sportsPayload || 'null');
    } catch (_) {
      payload = null;
    }
    if (!payload) {
      host.remove();
      return;
    }
    sportsPayloadCache = payload;
    sportsSlides = buildSportsSlides(payload);
    if (!sportsSlides.length) {
      host.remove();
      sportsPayloadCache = null;
      return;
    }
    /* Départ aléatoire (variance) — comme le brassage initial LE-RADAR. */
    refillSportsDeck(null);
    var first = sportsDeck.shift() || sportsSlides[0];
    paintSportsChip(host, first, false);
    syncMastheadWeatherDock();
    /* Re-peindre codes ↔ noms+institutions au passage mobile/bureau. */
    if (!initMastheadSports._densityBound) {
      initMastheadSports._densityBound = true;
      var mq;
      try { mq = window.matchMedia(SPORTS_DESKTOP_MQ); } catch (_) { mq = null; }
      function onDensityChange() {
        var h = document.querySelector('.masthead-sports[data-sports-payload]');
        if (!h || !sportsSlides.length) return;
        var cur = h.querySelector('.sports-chip');
        var key = cur && cur.dataset.sportsKey;
        var slide = sportsSlides.find(function (s) { return s.key === key; }) || sportsSlides[0];
        paintSportsChip(h, slide, false);
        syncMastheadWeatherDock();
      }
      if (mq) {
        if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onDensityChange);
        else if (typeof mq.addListener === 'function') mq.addListener(onDensityChange);
      }
    }
  }

  /** Appelé après applyBranding (front éditorial) pour peindre la puce sports. */
  function refreshMastheadStatus() {
    initMastheadSports();
    syncMastheadWeatherDock();
  }
  try {
    window.KiosqueRefreshMasthead = refreshMastheadStatus;
  } catch (_) {}

  function initMastheadWeather() {
    var host = document.querySelector('[data-weather-localities]');
    if (!host || typeof fetch !== 'function') return;
    var localities = [];
    try {
      localities = JSON.parse(host.dataset.weatherLocalities || '[]')
        .map(normalizeWeatherLocality)
        .filter(Boolean)
        .slice(0, 4);
    } catch (_) {}
    if (!localities.length) return;
    var meteoBase = host.dataset.meteoconsBase || '';
    if (!meteoBase) {
      var tokens = document.querySelector('link[href*="tokens.css"]');
      if (tokens) meteoBase = tokens.href.replace(/tokens\.css.*$/, 'meteocons/animated/');
      else meteoBase = 'assets/meteocons/animated/';
    }

    /* Dock immédiat sur téléphone (même avant le fetch) pour éviter un flash dans le mât. */
    syncMastheadWeatherDock();

    Promise.all(localities.map(async function (loc) {
      var cacheKey = 'kiosque-weather:v2:' + loc.name.toLowerCase();
      try {
        var cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (cached && Date.now() - cached.savedAt < 30 * 60 * 1000) return cached.value;
      } catch (_) {}

      var lat = loc.latitude;
      var lon = loc.longitude;
      var displayName = loc.name;
      // Géocodage Open-Meteo (données OpenStreetMap) si le CMS n’a pas posé de coords.
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        var geocode = await fetch(
          'https://geocoding-api.open-meteo.com/v1/search?count=1&language=fr&countryCode=CA&name='
            + encodeURIComponent(loc.name),
        ).then(function (r) { if (!r.ok) throw new Error('geocoding'); return r.json(); });
        var place = geocode.results && geocode.results[0];
        if (!place) throw new Error('locality');
        lat = place.latitude;
        lon = place.longitude;
        displayName = place.name || loc.name;
      }

      var forecast = await fetch(
        'https://api.open-meteo.com/v1/forecast?current=temperature_2m,weather_code,is_day&timezone=auto&latitude='
          + encodeURIComponent(lat) + '&longitude=' + encodeURIComponent(lon),
      ).then(function (r) { if (!r.ok) throw new Error('forecast'); return r.json(); });

      var value = {
        name: displayName,
        temperature: Math.round(forecast.current.temperature_2m),
        code: Number(forecast.current.weather_code),
        isDay: Number(forecast.current.is_day),
        latitude: lat,
        longitude: lon,
        envcan: envcanUrl(lat, lon, loc.envcanUrl),
        meteomedia: meteomediaUrl(displayName, loc.meteomediaSlug),
        osmId: loc.osmId || '',
      };
      try { localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), value: value })); } catch (_) {}
      return value;
    })).then(function (values) {
      values.forEach(function (value) {
        // Lien principal = Environnement Canada ; MétéoMédia associé (title + data-).
        var href = value.envcan || value.meteomedia || '#';
        var chip = document.createElement(href !== '#' ? 'a' : 'span');
        chip.className = 'weather-chip masthead-weather__city';
        chip.style.setProperty('--weather-tone', weatherTone(value.code));
        if (chip.tagName === 'A') {
          chip.href = href;
          chip.target = '_blank';
          chip.rel = 'noopener noreferrer';
          var titleParts = ['Prévisions Environnement Canada — ' + value.name];
          if (value.meteomedia) titleParts.push('MétéoMédia : ' + value.meteomedia);
          chip.title = titleParts.join(' · ');
          chip.setAttribute('aria-label', 'Météo à ' + value.name + ' — ouvrir Environnement Canada');
          if (value.meteomedia) chip.dataset.meteomedia = value.meteomedia;
          if (value.envcan) chip.dataset.envcan = value.envcan;
          if (Number.isFinite(value.latitude) && Number.isFinite(value.longitude)) {
            chip.dataset.lat = String(value.latitude);
            chip.dataset.lon = String(value.longitude);
          }
          if (value.osmId) chip.dataset.osmId = value.osmId;
        }
        var img = document.createElement('img');
        img.className = 'weather-icon-meteocon';
        img.src = meteoBase + weatherIconName(value.code, value.isDay) + '.svg';
        img.alt = '';
        img.setAttribute('aria-hidden', 'true');
        img.width = 22;
        img.height = 22;
        var nameEl = document.createElement('span');
        nameEl.className = 'weather-chip__name masthead-weather__name';
        nameEl.textContent = value.name;
        var temp = document.createElement('span');
        temp.className = 'weather-chip__temp masthead-weather__temp';
        temp.textContent = value.temperature + '°';
        chip.appendChild(img);
        chip.appendChild(nameEl);
        chip.appendChild(temp);
        host.appendChild(chip);
      });
      syncMastheadWeatherDock();
    }).catch(function () {
      host.remove();
      var dock = document.getElementById('masthead-weather-dock');
      if (dock && !dock.childNodes.length) dock.hidden = true;
    });
  }

  // ── Nav mobile : 1 rangée + peek flouté + « Toutes les rubriques » ──
  function initNavCollapse() {
    var shell = document.querySelector('[data-nav-shell]');
    if (!shell) return;
    var nav = shell.querySelector('.nav');
    var btn = shell.querySelector('[data-nav-toggle]');
    if (!nav || !btn) return;

    var expanded = false;
    var phoneMq = typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 720px)')
      : null;

    function isPhone() {
      return phoneMq ? phoneMq.matches : window.innerWidth <= 720;
    }

    function sync() {
      if (!isPhone()) {
        shell.classList.remove('has-overflow', 'is-expanded');
        btn.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
        expanded = false;
        return;
      }
      /* Mesure avec max-height levée. */
      var wasExpanded = shell.classList.contains('is-expanded');
      shell.classList.add('is-expanded');
      var fullH = nav.scrollHeight;
      if (!wasExpanded) shell.classList.remove('is-expanded');
      var oneRow = 44; /* ~2.65rem */
      var overflow = fullH > oneRow + 8;
      shell.classList.toggle('has-overflow', overflow);
      btn.hidden = !overflow;
      if (!overflow) {
        expanded = false;
        shell.classList.remove('is-expanded');
      } else if (expanded) {
        shell.classList.add('is-expanded');
      }
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      btn.textContent = expanded ? 'Réduire le menu' : 'Toutes les rubriques';
    }

    btn.addEventListener('click', function () {
      expanded = !expanded;
      shell.classList.toggle('is-expanded', expanded);
      btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      btn.textContent = expanded ? 'Réduire le menu' : 'Toutes les rubriques';
      releaseToolButton(btn);
    });
    btn.addEventListener('pointerup', function () { releaseToolButton(btn); });
    btn.addEventListener('touchend', function () {
      window.setTimeout(function () { releaseToolButton(btn); }, 50);
    }, { passive: true });

    sync();
    var pending;
    window.addEventListener('resize', function () {
      clearTimeout(pending);
      pending = setTimeout(sync, 120);
    }, { passive: true });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(sync).catch(function () {});
    }
  }

  function initTheme() {
    var initial = currentTheme();
    // Si un choix est stocké, on le persiste ; sinon on applique le système sans
    // écrire localStorage (pour continuer à suivre prefers-color-scheme).
    var hasStored = false;
    try { hasStored = !!localStorage.getItem(STORAGE_KEY); } catch (_) {}
    applyTheme(initial, hasStored);

    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.hidden = false;
      btn.addEventListener('click', function () {
        var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next, true);
        releaseToolButton(btn);
      });
    }
    // Suivre le système tant qu'aucun choix explicite n'est stocké (LE-RADAR).
    if (window.matchMedia) {
      try {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
          try {
            if (localStorage.getItem(STORAGE_KEY)) return;
          } catch (_) { return; }
          applyTheme(currentTheme(), false);
        });
      } catch (_) {}
    }
  }

  // ── Défilement des textes qui débordent ──────────────────────────────────
  /*
   * Un titre trop long défile doucement plutôt que d'être coupé par une ellipse.
   * L'animation ne se déclenche qu'au-delà de 2 px de débordement : en deçà,
   * c'est du bruit de mesure et le mouvement serait perçu comme un tremblement.
   * Le décalage est arrondi au pixel entier — un décalage fractionnaire rend le
   * texte flou pendant tout le trajet.
   */
  function applyMarquee(el) {
    var span = el.firstElementChild;
    if (!span) return;
    var overflow = span.scrollWidth - el.clientWidth;
    if (overflow <= 2) {
      el.classList.remove('is-marquee');
      el.style.removeProperty('--marquee-shift');
      el.style.removeProperty('--marquee-duration');
      return;
    }
    el.classList.add('is-marquee');
    el.style.setProperty('--marquee-shift', '-' + Math.round(overflow) + 'px');
    // Vitesse constante (~28 px/s) : un titre deux fois plus long met deux fois
    // plus de temps, au lieu de défiler deux fois plus vite.
    el.style.setProperty('--marquee-duration', Math.max(6, overflow / 28).toFixed(1) + 's');
  }

  function initMarquees() {
    var targets = document.querySelectorAll('[data-marquee]');
    if (!targets.length) return;

    function refresh() {
      for (var i = 0; i < targets.length; i++) applyMarquee(targets[i]);
    }

    // Les polices web changent la largeur du texte après le premier rendu :
    // mesurer avant leur chargement donnerait un débordement faux.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(refresh).catch(refresh);
    } else {
      refresh();
    }

    var pending;
    window.addEventListener('resize', function () {
      clearTimeout(pending);
      pending = setTimeout(refresh, 120);
    }, { passive: true });
  }

  // ── Équité magazine (parité LE-RADAR balanceMagazineColumns — TRIM) ──
  // ≥1100 px : En bref ne doit pas dépasser la colonne une + vedettes.
  // Tolérance < ½ carte compacte pour éviter « 1 article de trop ».
  var MAGAZINE_BALANCE_MQ = '(min-width: 1100px)';
  var MAGAZINE_HEIGHT_TOL = 40;
  var MAGAZINE_BRIEF_HARD_MIN = 2;
  var magazineBalanceTimer = 0;

  function canBalanceMagazineColumns() {
    try {
      return !!(window.matchMedia && window.matchMedia(MAGAZINE_BALANCE_MQ).matches);
    } catch (_) {
      return false;
    }
  }

  function magazineColumnContentHeight(col) {
    if (!col) return 0;
    var h = 0;
    var children = col.children;
    for (var i = 0; i < children.length; i += 1) {
      var child = children[i];
      if (child.classList && (
        child.classList.contains('news-hero-spacer')
        || child.classList.contains('brief-rail-spacer')
      )) continue;
      var style = window.getComputedStyle(child);
      var mt = parseFloat(style.marginTop) || 0;
      var mb = parseFloat(style.marginBottom) || 0;
      h += child.offsetHeight + mt + mb;
    }
    var cs = window.getComputedStyle(col);
    h += (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    return h;
  }

  function ensureNewsTailSection(layout) {
    var tail = layout.querySelector('.news-tail');
    if (tail) return tail;
    tail = document.createElement('section');
    tail.className = 'news-tail';
    tail.setAttribute('data-tail-visible', '10');
    tail.innerHTML = '<h2 class="news-tail-title">Suite du fil</h2><div class="news-tail-body news-tail-grid"></div>';
    layout.appendChild(tail);
    return tail;
  }

  /**
   * Déplace la dernière carte En bref vers la suite du fil (équité).
   * Rôle compact → tail (classes + structure déjà en DOM).
   */
  function demoteLastBriefToTail(layout, brief) {
    var cards = brief.querySelectorAll(':scope > .article');
    if (!cards.length) return false;
    var card = cards[cards.length - 1];
    if (!card) return false;
    card.remove();
    /* Gabarit suite : rôle tail sans image (parité source-view / noImageRoles). */
    card.classList.remove('article--compact', 'article--brief', 'article--thumb', 'has-image');
    card.classList.add('article--tail');
    card.querySelectorAll('.article-media').forEach(function (media) {
      media.remove();
    });
    var tail = ensureNewsTailSection(layout);
    var body = tail.querySelector('.news-tail-body') || tail;
    /* En tête de suite (plus frais que le bas du fil historique). */
    if (body.firstChild) body.insertBefore(card, body.firstChild);
    else body.appendChild(card);
    if (!brief.querySelector(':scope > .article')) {
      brief.remove();
    }
    return true;
  }

  function balanceMagazineColumns() {
    if (!canBalanceMagazineColumns()) return;
    var layout = document.querySelector('.magazine-layout:not(.magazine-layout--article):not(.magazine-layout--team)');
    if (!layout) return;
    var hero = layout.querySelector('.news-hero');
    var brief = layout.querySelector('.brief-rail');
    if (!hero || !brief) return;

    var guard = 0;
    while (guard < 20) {
      guard += 1;
      var hH = magazineColumnContentHeight(hero);
      var bH = magazineColumnContentHeight(brief);
      if (bH <= hH + MAGAZINE_HEIGHT_TOL) break;
      var n = brief.querySelectorAll(':scope > .article').length;
      if (n <= MAGAZINE_BRIEF_HARD_MIN) break;
      if (!demoteLastBriefToTail(layout, brief)) break;
      brief = layout.querySelector('.brief-rail');
      if (!brief) break;
    }
    /* Replier la suite après un trim (peut avoir créé / enrichi .news-tail). */
    if (typeof syncNewsTailCollapse === 'function') {
      try { syncNewsTailCollapse(); } catch (_) { /* init order */ }
    }
  }

  function scheduleMagazineColumnBalance() {
    window.clearTimeout(magazineBalanceTimer);
    magazineBalanceTimer = window.setTimeout(function () {
      balanceMagazineColumns();
      /* 2e / 3e passes : images une/vedettes/En bref souvent plus lentes. */
      window.setTimeout(balanceMagazineColumns, 450);
      window.setTimeout(balanceMagazineColumns, 1200);
      /* Après trim éventuel : le bouton « Plus d'articles » doit réapparaître. */
      window.setTimeout(function () {
        try { syncNewsTailCollapse(); } catch (_) { /* init order */ }
      }, 1300);
    }, 80);
  }

  function initMagazineColumnBalance() {
    scheduleMagazineColumnBalance();
    try {
      var mq = window.matchMedia(MAGAZINE_BALANCE_MQ);
      var onChange = function () { scheduleMagazineColumnBalance(); };
      if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
      else if (typeof mq.addListener === 'function') mq.addListener(onChange);
    } catch (_) { /* ignore */ }
    document.querySelectorAll('.magazine-layout .news-hero img, .magazine-layout .brief-rail img').forEach(function (img) {
      if (img.dataset.magazineBalanceBound) return;
      img.dataset.magazineBalanceBound = '1';
      if (!img.complete) {
        img.addEventListener('load', scheduleMagazineColumnBalance, { once: true });
        img.addEventListener('error', scheduleMagazineColumnBalance, { once: true });
      }
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleMagazineColumnBalance).catch(function () {});
    }
  }

  // ── Suite du fil : « Plus d'articles » (repli initial, dépliage manuel) ──
  // 10 cartes = 5 rangées en 2 colonnes ; peek 6e rangée = titre + auteurs floutés.
  // Une fois déplié : tout le fil reste ouvert, sans bouton « Réduire ».
  var NEWS_TAIL_VISIBLE = 10;
  /** Plancher peek (rubrique + titre + auteurs) ; affiné par mesure DOM. */
  var NEWS_TAIL_PEEK_MIN_PX = 72;
  var NEWS_TAIL_PEEK_MAX_PX = 130;
  var newsTailExpanded = false;
  var newsTailBound = false;

  function newsTailBody(tail) {
    if (!tail) return null;
    var body = tail.querySelector('.news-tail-body') || tail.querySelector('.news-tail-grid');
    if (body && !body.classList.contains('news-tail-body')) body.classList.add('news-tail-body');
    return body;
  }

  function getNewsTailCards(tail) {
    var body = newsTailBody(tail);
    if (!body) return [];
    // Enfants directs seulement (évite de compter des .article imbriqués).
    return Array.prototype.filter.call(body.children, function (el) {
      return el.classList && el.classList.contains('article');
    });
  }

  /**
   * Hauteur de la zone peek = bas du byline (ou titre) de la 6e rangée.
   * Inclut la rubrique (meta) ; extrait et date restent masqués en CSS.
   */
  function measureNewsTailPeekPx(cards, visibleCount) {
    var peekCards = cards.slice(visibleCount, visibleCount + 2);
    var peek = NEWS_TAIL_PEEK_MIN_PX;
    for (var i = 0; i < peekCards.length; i++) {
      var card = peekCards[i];
      var end = card.querySelector('.article-byline')
        || card.querySelector('.article-title')
        || card.querySelector('.article-meta');
      if (!end) continue;
      var cardTop = card.getBoundingClientRect().top;
      var endBottom = end.getBoundingClientRect().bottom;
      peek = Math.max(peek, Math.ceil(endBottom - cardTop + 8));
    }
    return Math.min(NEWS_TAIL_PEEK_MAX_PX, Math.max(NEWS_TAIL_PEEK_MIN_PX, peek));
  }

  function measureNewsTailCollapsedHeight(body, cards, visibleCount, peekPx) {
    if (!body || !cards.length) return 0;
    var lastIdx = Math.min(visibleCount, cards.length) - 1;
    var last = cards[lastIdx];
    if (!last) return 0;
    // Forcer un reflow propre avant mesure (grille 1/2 col + polices + peek CSS).
    void body.offsetHeight;
    var bodyTop = body.getBoundingClientRect().top;
    var lastBottom = last.getBoundingClientRect().bottom;
    var h = lastBottom - bodyTop + peekPx;
    return Math.max(120, Math.ceil(h));
  }

  function applyNewsTailCollapsedHeight(tail) {
    var body = newsTailBody(tail);
    if (!body) return;
    if (!tail.classList.contains('has-overflow') || tail.classList.contains('is-expanded')) {
      body.style.removeProperty('--news-tail-collapsed-h');
      body.style.removeProperty('--news-tail-peek');
      body.style.removeProperty('max-height');
      return;
    }
    var cards = getNewsTailCards(tail);
    var peekPx = measureNewsTailPeekPx(cards, NEWS_TAIL_VISIBLE);
    tail.style.setProperty('--news-tail-peek', peekPx + 'px');
    body.style.setProperty('--news-tail-peek', peekPx + 'px');
    var h = measureNewsTailCollapsedHeight(body, cards, NEWS_TAIL_VISIBLE, peekPx);
    if (h > 0) {
      body.style.setProperty('--news-tail-collapsed-h', h + 'px');
      body.style.maxHeight = h + 'px';
    }
  }

  function syncNewsTailCollapse() {
    var tail = document.querySelector('.news-tail');
    if (!tail) return;
    var body = newsTailBody(tail);
    if (!body) return;

    var cards = getNewsTailCards(tail);
    var overflow = cards.length > NEWS_TAIL_VISIBLE;

    cards.forEach(function (el, i) {
      var pastFull = overflow && !newsTailExpanded && i >= NEWS_TAIL_VISIBLE;
      el.classList.toggle('is-tail-overflow', pastFull);
    });

    if (!overflow) {
      tail.classList.remove('has-overflow', 'is-expanded');
      body.style.maxHeight = 'none';
      body.style.removeProperty('--news-tail-collapsed-h');
      body.style.removeProperty('--news-tail-peek');
      tail.style.removeProperty('--news-tail-peek');
      var stale = tail.querySelector('.news-tail-toggle');
      if (stale) stale.remove();
      newsTailExpanded = false;
      return;
    }

    tail.classList.add('has-overflow');
    tail.classList.toggle('is-expanded', newsTailExpanded);
    tail.dataset.tailVisible = String(NEWS_TAIL_VISIBLE);

    var toggle = tail.querySelector('.news-tail-toggle');
    var hidden = cards.length - NEWS_TAIL_VISIBLE;

    if (newsTailExpanded) {
      /* Déplié : retirer le bouton (pas de « Réduire » en bas du fil). */
      if (toggle) toggle.remove();
      void body.offsetHeight;
      var fullH = Math.max(body.scrollHeight, body.offsetHeight);
      body.style.maxHeight = fullH + 'px';
      body.style.removeProperty('--news-tail-collapsed-h');
      body.style.removeProperty('--news-tail-peek');
      tail.style.removeProperty('--news-tail-peek');
      requestAnimationFrame(function () {
        body.style.maxHeight = 'none';
      });
      return;
    }

    /* Replié : bouton « Plus d'articles » uniquement (jamais auto-déplié). */
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'news-tail-toggle';
      toggle.innerHTML = '<span class="news-tail-toggle__label">Plus d\'articles</span>';
      toggle.setAttribute('aria-expanded', 'false');
    }
    if (toggle.parentNode !== tail || tail.lastElementChild !== toggle) {
      tail.appendChild(toggle);
    }
    var label = toggle.querySelector('.news-tail-toggle__label');
    if (label) label.textContent = 'Plus d\'articles (' + hidden + ')';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Plus d\'articles, ' + hidden + ' restants');

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        applyNewsTailCollapsedHeight(tail);
      });
    });
  }

  function bindNewsTailCollapseOnce() {
    if (newsTailBound) return;
    newsTailBound = true;
    // Délégation document : survit aux re-renders et à une suite créée plus tard
    // (ex. demote En bref → ensureNewsTailSection).
    document.addEventListener('click', function (event) {
      var btn = event.target && event.target.closest
        ? event.target.closest('.news-tail-toggle')
        : null;
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      var section = btn.closest('.news-tail');
      if (!section) return;
      /* Une seule action : déplier. Pas de repli / pas de « Réduire ». */
      if (newsTailExpanded) return;

      var yBefore = window.scrollY || window.pageYOffset || 0;
      newsTailExpanded = true;
      syncNewsTailCollapse();
      releaseToolButton(btn);

      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          // Contenu s’ouvre vers le bas : ne pas suivre le bouton.
          window.scrollTo({ top: yBefore, left: 0, behavior: 'auto' });
        });
      });
    });

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (!newsTailExpanded) syncNewsTailCollapse();
      }, 120);
    }, { passive: true });
  }

  function initNewsTailCollapse() {
    bindNewsTailCollapseOnce();

    /* Toujours replié au chargement — jamais de dépliage automatique. */
    newsTailExpanded = false;
    syncNewsTailCollapse();

    // Remesure après polices (titres/auteurs changent la hauteur des cartes).
    function remeasure() {
      if (!newsTailExpanded) syncNewsTailCollapse();
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(remeasure).catch(remeasure);
    }
    window.setTimeout(remeasure, 300);
    window.setTimeout(remeasure, 900);
  }

  // ── Au tableau : « Plus de matchs » (1 rangée de cartes, puis tout) ──
  var sportsBoardExpanded = false;
  var sportsBoardBound = false;

  function measureSportsBoardRowHeight(board) {
    if (!board) return 0;
    var panels = board.querySelectorAll('.sports-panel');
    if (!panels.length) return 0;
    void board.offsetHeight;
    var boardTop = board.getBoundingClientRect().top;
    var firstBottom = panels[0].getBoundingClientRect().bottom;
    var rowBottom = firstBottom;
    var firstTop = panels[0].getBoundingClientRect().top;
    for (var i = 1; i < panels.length; i++) {
      var r = panels[i].getBoundingClientRect();
      /* Même rangée ≈ même top (tolérance 12 px). */
      if (Math.abs(r.top - firstTop) < 12) {
        rowBottom = Math.max(rowBottom, r.bottom);
      } else {
        break;
      }
    }
    return Math.max(160, Math.ceil(rowBottom - boardTop + 8));
  }

  function syncSportsBoardCollapse() {
    var wrap = document.querySelector('[data-sports-board-wrap]');
    if (!wrap) return;
    var scroll = wrap.querySelector('.sports-board-scroll');
    var board = wrap.querySelector('.sports-board');
    var toggle = wrap.querySelector('[data-sports-board-toggle]') || wrap.querySelector('.sports-board-toggle');
    if (!scroll || !board) return;

    var panels = board.querySelectorAll('.sports-panel');
    var rowH = measureSportsBoardRowHeight(board);
    var fullH = board.scrollHeight;
    var overflow = panels.length > 1 && fullH > rowH + 48;

    if (!overflow) {
      wrap.classList.remove('has-overflow', 'is-expanded');
      scroll.style.removeProperty('max-height');
      scroll.style.removeProperty('--sports-board-collapsed-h');
      if (toggle) {
        toggle.hidden = true;
        toggle.setAttribute('hidden', '');
      }
      sportsBoardExpanded = false;
      return;
    }

    wrap.classList.add('has-overflow');
    wrap.classList.toggle('is-expanded', sportsBoardExpanded);

    if (!toggle) {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'sports-board-toggle';
      toggle.setAttribute('data-sports-board-toggle', '');
      toggle.innerHTML = '<span class="sports-board-toggle__label">Plus de matchs</span>';
      wrap.appendChild(toggle);
    }
    toggle.hidden = false;
    toggle.removeAttribute('hidden');

    if (sportsBoardExpanded) {
      toggle.hidden = true;
      toggle.setAttribute('hidden', '');
      scroll.style.maxHeight = 'none';
      scroll.style.removeProperty('--sports-board-collapsed-h');
      return;
    }

    var extra = Math.max(0, panels.length - Math.max(1, Math.round(board.getBoundingClientRect().width / 280)));
    var label = toggle.querySelector('.sports-board-toggle__label');
    if (label) {
      label.textContent = extra > 0
        ? 'Plus de matchs (' + extra + ' formations)'
        : 'Plus de matchs';
    }
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Plus de matchs — afficher toutes les formations');
    wrap.style.setProperty('--sports-board-collapsed-h', rowH + 'px');
    scroll.style.setProperty('--sports-board-collapsed-h', rowH + 'px');
    scroll.style.maxHeight = rowH + 'px';
  }

  function bindSportsBoardCollapseOnce() {
    if (sportsBoardBound) return;
    sportsBoardBound = true;
    document.addEventListener('click', function (event) {
      var btn = event.target && event.target.closest
        ? event.target.closest('[data-sports-board-toggle], .sports-board-toggle')
        : null;
      if (!btn) return;
      event.preventDefault();
      if (sportsBoardExpanded) return;
      var yBefore = window.scrollY || window.pageYOffset || 0;
      sportsBoardExpanded = true;
      syncSportsBoardCollapse();
      requestAnimationFrame(function () {
        window.scrollTo({ top: yBefore, left: 0, behavior: 'auto' });
      });
    });
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (!sportsBoardExpanded) syncSportsBoardCollapse();
      }, 120);
    }, { passive: true });
  }

  function initSportsBoardCollapse() {
    bindSportsBoardCollapseOnce();
    sportsBoardExpanded = false;
    requestAnimationFrame(function () {
      requestAnimationFrame(syncSportsBoardCollapse);
    });
    window.setTimeout(syncSportsBoardCollapse, 200);
    window.setTimeout(syncSportsBoardCollapse, 700);
  }

  window.KiosqueRefreshSportsBoard = function () {
    sportsBoardExpanded = false;
    syncSportsBoardCollapse();
    focusSportsTeamFromUrl();
  };

  /**
   * Deep-link ?team=… (puce mât) : ouvrir le tableau si replié, scroller
   * jusqu’à la carte formation et pulser le contour (parité LE-RADAR).
   */
  function clearSportsTeamSpotlight() {
    document.querySelectorAll('.sports-panel.is-spotlight').forEach(function (p) {
      p.classList.remove('is-spotlight');
    });
  }

  function focusSportsTeam(teamId) {
    clearSportsTeamSpotlight();
    if (!teamId) return null;
    var panel = null;
    try {
      if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        panel = document.querySelector('.sports-panel[data-team="' + CSS.escape(teamId) + '"]');
      }
    } catch (_) { panel = null; }
    if (!panel) {
      var all = document.querySelectorAll('.sports-panel[data-team]');
      for (var i = 0; i < all.length; i++) {
        if (all[i].getAttribute('data-team') === teamId) {
          panel = all[i];
          break;
        }
      }
    }
    if (!panel) return null;

    /* Déplier « Plus de matchs » pour que la carte ne soit pas hors vue. */
    sportsBoardExpanded = true;
    try { syncSportsBoardCollapse(); } catch (_) { /* ignore */ }

    panel.classList.add('is-spotlight');
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        try {
          panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (_) {
          try { panel.scrollIntoView(true); } catch (__) { /* ignore */ }
        }
      });
    });
    return panel;
  }

  function focusSportsTeamFromUrl() {
    var teamId = '';
    try {
      teamId = new URLSearchParams(window.location.search).get('team') || '';
    } catch (_) {
      teamId = '';
    }
    teamId = String(teamId || '').trim();
    if (!teamId) {
      clearSportsTeamSpotlight();
      return;
    }
    /* Laisser le layout (repli board) se mesurer avant le scroll. */
    window.requestAnimationFrame(function () {
      focusSportsTeam(teamId);
    });
    window.setTimeout(function () { focusSportsTeam(teamId); }, 200);
    window.setTimeout(function () { focusSportsTeam(teamId); }, 700);
  }

  window.KiosqueFocusSportsTeam = focusSportsTeamFromUrl;

  // ── Barre radio LE-RADAR ───────────────────────────────────────────────
  // Coque sombre réservée dès le HTML (data-state=loading, min-height 68).
  // L’iframe charge en eager ; à ready on passe data-state=ready (opacity 1).
  // En cas de panne / unavailable → data-state=gone (collapse), pas de pop.
  function initRadarTuner() {
    if (!('customElements' in window) || customElements.get('radar-tuner')) return;

    function RadarTuner() { return Reflect.construct(HTMLElement, [], RadarTuner); }
    RadarTuner.prototype = Object.create(HTMLElement.prototype);
    RadarTuner.prototype.constructor = RadarTuner;
    Object.setPrototypeOf(RadarTuner, HTMLElement);

    RadarTuner.prototype.connectedCallback = function () {
      var host = this;
      if (host.dataset.tunerBound === '1') return;
      host.dataset.tunerBound = '1';
      var loaded = false;
      var timeout;
      function markGone() {
        host.dataset.state = 'gone';
        host.setAttribute('aria-busy', 'false');
        host.hidden = true;
        /* Retrait différé : laisse le CSS collapser sans flash intermédiaire. */
        window.setTimeout(function () {
          if (host.isConnected && host.dataset.state === 'gone') host.remove();
        }, 50);
      }
      function load() {
        if (loaded) return;
        loaded = true;
        var src = host.getAttribute('data-src') || host.dataset.src;
        if (!src) {
          markGone();
          return;
        }
        if (!host.dataset.state) host.dataset.state = 'loading';
        host.setAttribute('aria-busy', 'true');
        host.hidden = false;
        var frame = host.querySelector('iframe');
        if (!frame) {
          frame = document.createElement('iframe');
          frame.title = 'Barre d’écoute de LE-RADAR';
          frame.loading = 'eager';
          frame.allow = 'autoplay';
          frame.src = src;
          host.appendChild(frame);
        }
        timeout = setTimeout(function () { markGone(); }, 6500);
        window.addEventListener('message', function (event) {
          if (event.source !== frame.contentWindow || event.origin !== 'https://le-radar.ca') return;
          var message = event.data;
          if (!message || message.type !== 'radar-embed' || message.protocol !== 1 || message.surface !== 'kiosque-v1') return;
          if (message.ready && message.available === false) {
            clearTimeout(timeout);
            markGone();
            return;
          }
          var height = Number(message.height);
          if (Number.isFinite(height) && height >= 40 && height <= 500) {
            var h = Math.round(height);
            /* Première hauteur idle (≤72) = base barre (68 desktop / 62 mobile embed). */
            if (!frame.dataset.baseH && h <= 72) frame.dataset.baseH = String(h);
            var baseH = Number(frame.dataset.baseH) || 68;
            /*
             * Popover volume : d’abord rendre l’hôte transparent et plafonner
             * sa hauteur, PUIS agrandir l’iframe — sinon un flash noir pleine
             * largeur apparaît le temps du reflow.
             */
            if (h > baseH + 4) {
              host.style.height = baseH + 'px';
              host.style.zIndex = '105';
              host.style.overflow = 'visible';
              host.style.background = 'transparent';
              host.style.boxShadow = '0 8px 24px -14px rgba(0, 0, 0, 0.78)';
              frame.classList.add('is-vol-overlay');
              frame.style.background = 'transparent';
              frame.style.marginBottom = (baseH - h) + 'px';
              frame.style.height = h + 'px';
            } else {
              frame.classList.remove('is-vol-overlay');
              frame.style.marginBottom = '';
              frame.style.background = '';
              frame.style.height = h + 'px';
              host.style.height = '';
              host.style.zIndex = '';
              host.style.overflow = '';
              host.style.background = '';
              host.style.boxShadow = '';
            }
          }
          if (message.ready && message.available === true) {
            clearTimeout(timeout);
            var fallback = host.querySelector('a');
            if (fallback) fallback.remove();
            host.hidden = false;
            host.dataset.state = 'ready';
            host.setAttribute('aria-busy', 'false');
            if (!frame.dataset.baseH) {
              frame.dataset.baseH = String(frame.offsetHeight || 68);
            }
          }
        });
      }
      load();
    };

    customElements.define('radar-tuner', RadarTuner);
  }

  function initMastheadStatusDock() {
    syncMastheadWeatherDock();
    if (!WEATHER_PHONE_MQ) return;
    var onMq = function () { syncMastheadWeatherDock(); };
    if (typeof WEATHER_PHONE_MQ.addEventListener === 'function') {
      WEATHER_PHONE_MQ.addEventListener('change', onMq);
    } else if (typeof WEATHER_PHONE_MQ.addListener === 'function') {
      WEATHER_PHONE_MQ.addListener(onMq);
    }
  }

  // ── Haut de page + loupe (recherche locale dans le DOM) ────────────────
  function normalizeSearchText(str) {
    return String(str || '')
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/['’`]/g, '')
      .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function searchTokens(query) {
    var q = normalizeSearchText(query);
    if (!q) return [];
    return q.split(' ').filter(function (t) { return t.length >= 1; });
  }

  function initPageScrollTop() {
    var btn = document.getElementById('page-scroll-top');
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    var SHOW_PX = 360;
    function sync() {
      var y = window.scrollY || document.documentElement.scrollTop || 0;
      var show = y > SHOW_PX;
      btn.hidden = !show;
      btn.setAttribute('aria-hidden', show ? 'false' : 'true');
    }
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      } catch (_) {
        window.scrollTo(0, 0);
      }
    });
    window.addEventListener('scroll', sync, { passive: true });
    sync();
  }

  var newsSearchState = {
    bound: false,
    open: false,
    timer: 0,
    cards: [],
  };

  function collectSearchCards() {
    var list = Array.prototype.slice.call(
      document.querySelectorAll(
        'main .article, main .post, .magazine-layout .article, .news-tail .article, .brief-rail .article',
      ),
    );
    var seen = new Set();
    return list.filter(function (el) {
      if (seen.has(el)) return false;
      seen.add(el);
      return true;
    });
  }

  function refreshNewsSearchCards() {
    newsSearchState.cards = collectSearchCards();
    var input = document.getElementById('news-search-input');
    if (input && (input.value || '').trim()) {
      applyNewsSearchQuery(input.value);
    } else {
      // Nettoyer d’éventuels masques d’un rendu précédent.
      document.querySelectorAll('.is-search-hidden').forEach(function (el) {
        el.classList.remove('is-search-hidden');
      });
      document.querySelectorAll('.news-features, .brief-rail, .news-tail').forEach(function (block) {
        block.style.display = '';
      });
    }
  }

  function applyNewsSearchQuery(raw) {
    var root = document.getElementById('news-search');
    var toggle = document.getElementById('news-search-toggle');
    var clear = document.getElementById('news-search-clear');
    var hint = document.getElementById('news-search-hint');
    var tokens = searchTokens(raw);
    var hasQuery = tokens.length > 0;
    if (root) root.classList.toggle('has-query', hasQuery);
    if (toggle) toggle.classList.toggle('is-active', hasQuery);
    if (clear) clear.classList.toggle('hidden', !hasQuery);
    if (!newsSearchState.cards.length) newsSearchState.cards = collectSearchCards();
    var visible = 0;
    newsSearchState.cards.forEach(function (card) {
      if (!card.isConnected) return;
      if (!tokens.length) {
        card.classList.remove('is-search-hidden');
        visible += 1;
        return;
      }
      var hay = normalizeSearchText(card.textContent || '');
      var ok = tokens.every(function (t) { return hay.indexOf(t) !== -1; });
      card.classList.toggle('is-search-hidden', !ok);
      if (ok) visible += 1;
    });
    document.querySelectorAll('.news-features, .brief-rail').forEach(function (block) {
      var any = block.querySelector('.article:not(.is-search-hidden)');
      block.style.display = (!hasQuery || any) ? '' : 'none';
    });
    var tail = document.querySelector('.news-tail');
    if (tail) {
      if (hasQuery) {
        var anyTail = tail.querySelector('.article:not(.is-search-hidden)');
        tail.style.display = anyTail ? '' : 'none';
      } else {
        tail.style.display = '';
      }
    }
    if (hint) {
      hint.textContent = hasQuery
        ? (visible === 0
          ? 'Aucun article ne correspond à « ' + String(raw).trim() + ' ».'
          : visible + ' article' + (visible > 1 ? 's' : '') + ' pour « ' + String(raw).trim() + ' ».')
        : 'Recherche locale : titres, auteurs, rubriques et extraits déjà sur la page.';
    }
  }

  function initNewsSearch() {
    var root = document.getElementById('news-search');
    var toggle = document.getElementById('news-search-toggle');
    var panel = document.getElementById('news-search-panel');
    var input = document.getElementById('news-search-input');
    var clear = document.getElementById('news-search-clear');
    var tools = document.getElementById('page-tools');
    if (!root || !toggle || !panel || !input) return;

    newsSearchState.cards = collectSearchCards();
    if (newsSearchState.bound) return;
    newsSearchState.bound = true;

    function setOpen(next) {
      newsSearchState.open = !!next;
      root.classList.toggle('is-open', newsSearchState.open);
      toggle.setAttribute('aria-expanded', newsSearchState.open ? 'true' : 'false');
      panel.hidden = !newsSearchState.open;
      panel.setAttribute('aria-hidden', newsSearchState.open ? 'false' : 'true');
      var loupe = toggle.querySelector('.news-search__fab-loupe');
      var closeIco = toggle.querySelector('.news-search__fab-close');
      if (loupe) loupe.classList.toggle('hidden', newsSearchState.open);
      if (closeIco) closeIco.classList.toggle('hidden', !newsSearchState.open);
      if (newsSearchState.open) {
        window.requestAnimationFrame(function () {
          try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); }
        });
      }
      updateVkInset();
    }

    function scheduleApply() {
      window.clearTimeout(newsSearchState.timer);
      newsSearchState.timer = window.setTimeout(function () {
        applyNewsSearchQuery(input.value || '');
      }, 120);
    }

    function updateVkInset() {
      if (!tools) return;
      var vv = window.visualViewport;
      if (!vv || !newsSearchState.open) {
        tools.style.removeProperty('--vk-inset');
        return;
      }
      var occluded = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      if (occluded > 1) tools.style.setProperty('--vk-inset', Math.round(occluded) + 'px');
      else tools.style.removeProperty('--vk-inset');
    }

    toggle.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!newsSearchState.open && (input.value || '').trim()) {
        input.value = '';
        applyNewsSearchQuery('');
        setOpen(false);
        return;
      }
      setOpen(!newsSearchState.open);
    });
    input.addEventListener('input', scheduleApply);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (input.value) {
          input.value = '';
          applyNewsSearchQuery('');
        } else {
          setOpen(false);
        }
      }
    });
    if (clear) {
      clear.addEventListener('click', function (e) {
        e.preventDefault();
        input.value = '';
        applyNewsSearchQuery('');
        try { input.focus({ preventScroll: true }); } catch (_) { input.focus(); }
      });
    }
    document.addEventListener('click', function (e) {
      if (!newsSearchState.open) return;
      if (root.contains(e.target)) return;
      setOpen(false);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateVkInset);
      window.visualViewport.addEventListener('scroll', updateVkInset);
    }
  }

  /**
   * Re-applique collaps suite du fil + équité magazine + index recherche
   * après un re-render éditorial (PGlite remplace main.innerHTML).
   */
  function refreshFeedChrome() {
    newsTailExpanded = false;
    try {
      var tail = document.querySelector('.news-tail');
      if (tail) {
        tail.classList.remove('is-expanded');
        // Remettre le corps en état repliable avant sync.
        var body = newsTailBody(tail);
        if (body) {
          body.style.removeProperty('max-height');
          body.style.removeProperty('--news-tail-collapsed-h');
        }
      }
      syncNewsTailCollapse();
    } catch (_) { /* ignore */ }
    try {
      if (typeof scheduleMagazineColumnBalance === 'function') {
        scheduleMagazineColumnBalance();
      } else if (typeof balanceMagazineColumns === 'function') {
        balanceMagazineColumns();
      }
    } catch (_) { /* ignore */ }
    try { refreshNewsSearchCards(); } catch (_) { /* ignore */ }
    try { initMarquees(); } catch (_) { /* ignore */ }
    try { rebindMastheadBackgrounds(); } catch (_) { /* ignore */ }
    try {
      sportsBoardExpanded = false;
      syncSportsBoardCollapse();
    } catch (_) { /* ignore */ }
    try { focusSportsTeamFromUrl(); } catch (_) { /* ignore */ }
  }

  window.KiosqueRefreshFeed = refreshFeedChrome;

  function init() {
    initTheme();
    initMastheadClock();
    initMastheadBackgrounds();
    initMastheadSports();
    initMastheadWeather();
    initMastheadStatusDock();
    initMastheadToolRelease();
    initNavCollapse();
    initNewsTailCollapse();
    initSportsBoardCollapse();
    initMagazineColumnBalance();
    initMarquees();
    initRadarTuner();
    initPageScrollTop();
    initNewsSearch();
    focusSportsTeamFromUrl();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
