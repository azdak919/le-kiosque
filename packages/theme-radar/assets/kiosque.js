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

  function initMastheadBackgrounds() {
    var image = document.querySelector('[data-masthead-background]');
    var data = document.getElementById('masthead-backgrounds');
    if (!image || !data) return;
    var images = [];
    try { images = JSON.parse(data.textContent || '[]'); } catch (_) {}
    if (!Array.isArray(images) || !images.length) return;

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

    // Normaliser les src (basePath, /./, query) pour comparer et charger sans 404.
    images = images.filter(function (item) { return item && item.src; }).map(function (item) {
      return Object.assign({}, item, { src: resolveAssetUrl(item.src) });
    });
    if (!images.length) return;
    var credit = document.querySelector('[data-masthead-credit]');
    var masthead = image.closest('.masthead');
    /**
     * Index = photo déjà peinte par le HTML (images[0] côté SSR).
     * Un Math.random() ici provoquait un flash : image A charge, puis B
     * (souvent en cache) remplace soudain — bug signalé sur la démo.
     * La variété reste au bouton shuffle (et éventuellement une autre
     * page/visite si l’éditeur change l’ordre du manifeste).
     */
    var paintedSrc = image.getAttribute('src') || image.currentSrc || '';
    var index = 0;
    for (var i = 0; i < images.length; i++) {
      if (sameSrc(images[i].src, paintedSrc)) {
        index = i;
        break;
      }
    }
    /** Transition active (LE-RADAR _activePhotoTransition) — annule un shuffle rapide. */
    var activeTransition = null;
    var hasShown = false;
    var shuffleBusy = false;

    function computeObjectPosition(item, imgEl) {
      var authored = parseAuthoredFocalY(item.backgroundPosition);
      var ar = mastheadAspectRatio(masthead);
      var focalY = 0.5;
      try {
        // Les points YAML ~50 % sont des défauts génériques : on affine.
        // Un focal explicite hors [0.42, 0.58] est respecté (choix éditorial).
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

    function applyPosition(item) {
      function place() {
        masthead?.classList.remove('masthead--image-error');
        image.style.objectPosition = computeObjectPosition(item, image);
      }
      if (image.complete && image.naturalWidth > 0) place();
      else image.addEventListener('load', place, { once: true });
    }

    function updateCredit(item) {
      if (!credit) return;
      credit.replaceChildren();
      if (!item.credit) return;
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

    image.addEventListener('error', function () { masthead?.classList.add('masthead--image-error'); });

    function commit(item, options) {
      options = options || {};
      masthead?.classList.remove('masthead--image-error');
      var nextSrc = resolveAssetUrl(item.src);
      var current = image.currentSrc || image.getAttribute('src') || '';
      // Ne jamais réassigner le même fichier (évite un rechargement cache inutile).
      if (!sameSrc(current, nextSrc)) {
        image.src = nextSrc;
      }
      // Premier paint SSR : garder object-position inline tant qu’on n’a pas
      // besoin de recalculer (shuffle / resize) — le auto-focal au load
      // faisait « sauter » le cadrage comme un second chargement.
      if (options.preservePosition) {
        var existing = (image.style && image.style.objectPosition) || '';
        if (!existing) applyPosition(item);
      } else {
        applyPosition(item);
      }
      updateCredit(item);
      hasShown = true;
    }

    function cancelActiveTransition() {
      if (activeTransition && typeof activeTransition.cancel === 'function') {
        activeTransition.cancel();
      }
      activeTransition = null;
      masthead?.querySelectorAll('.masthead-background-transition').forEach(function (node) {
        node.remove();
      });
    }

    /**
     * Affiche l’image d’index `next`. Au premier affichage : pose directe.
     * Ensuite : crossfade façon LE-RADAR (calque temporaire sous le voile).
     */
    function show(next, options) {
      options = options || {};
      index = (next + images.length) % images.length;
      var item = images[index];
      var reduceMotion = false;
      try {
        reduceMotion = !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch (_) {}

      var currentSrc = image.currentSrc || image.getAttribute('src') || '';
      var nextSrc = resolveAssetUrl(item.src);
      var shouldCrossfade =
        options.animate !== false &&
        hasShown &&
        currentSrc &&
        !sameSrc(currentSrc, nextSrc) &&
        !reduceMotion;

      if (!shouldCrossfade) {
        cancelActiveTransition();
        commit(item, { preservePosition: options.preservePosition === true });
        shuffleBusy = false;
        return;
      }

      cancelActiveTransition();

      var incoming = document.createElement('img');
      incoming.className = 'masthead-background masthead-background-transition';
      incoming.alt = '';
      incoming.setAttribute('aria-hidden', 'true');
      incoming.decoding = 'async';
      // Insérer juste après la photo de base, avant le voile (z-order correct).
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
        // Base déjà à jour pendant le fondu ; finaliser crédit/cadrage au besoin.
        applyPosition(item);
        updateCredit(item);
        hasShown = true;
        shuffleBusy = false;
        try { incoming.remove(); } catch (_) {}
        if (activeTransition && activeTransition.incoming === incoming) {
          activeTransition = null;
        }
      }

      activeTransition = {
        incoming: incoming,
        cancel: function () {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          shuffleBusy = false;
          try { incoming.remove(); } catch (_) {}
          if (activeTransition && activeTransition.incoming === incoming) {
            activeTransition = null;
          }
        },
      };

      function startFade() {
        if (settled || fadeStarted) return;
        fadeStarted = true;
        masthead?.classList.remove('masthead--image-error');
        var position;
        try {
          position = computeObjectPosition(item, incoming);
        } catch (_) {
          position = item.backgroundPosition || '50% 50%';
        }
        incoming.style.objectPosition = position;
        // Préparer la couche persistante sous le fondu (évite un flash au settle).
        if (!sameSrc(image.currentSrc || image.getAttribute('src') || '', nextSrc)) {
          image.src = nextSrc;
        }
        image.style.objectPosition = position;
        updateCredit(item);
        hasShown = true;

        incoming.addEventListener('transitionend', function (event) {
          if (event.propertyName === 'opacity') settle();
        }, { once: true });
        // Double rAF : laisse le navigateur peindre opacity:0 avant d’animer.
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            if (!settled) incoming.classList.add('is-visible');
          });
        });
        timer = window.setTimeout(settle, 560);
      }

      incoming.addEventListener('error', function () {
        // Échec du preload : bascule sans fondu.
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        try { incoming.remove(); } catch (_) {}
        activeTransition = null;
        commit(item);
        shuffleBusy = false;
      }, { once: true });

      incoming.addEventListener('load', startFade, { once: true });
      incoming.src = nextSrc;
      // Cache navigateur : load peut ne pas se re-déclencher si déjà complete.
      if (incoming.complete && incoming.naturalWidth > 0) startFade();
    }

    // Sync index/crédit avec la photo déjà visible — sans recharger ni recadrer.
    show(index, { animate: false, preservePosition: true });

    function pickNextIndex() {
      if (images.length < 2) return 0;
      // Évite de retomber sur la même photo (src normalisée).
      var current = resolveAssetUrl(images[index] && images[index].src);
      var candidates = [];
      for (var i = 0; i < images.length; i++) {
        if (!sameSrc(images[i].src, current)) candidates.push(i);
      }
      if (!candidates.length) return (index + 1) % images.length;
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    function onShuffle(event) {
      var btn = event.target && event.target.closest
        ? event.target.closest('#masthead-shuffle, .masthead-shuffle')
        : null;
      if (!btn) return;
      event.preventDefault();
      if (shuffleBusy) return;
      shuffleBusy = true;
      show(pickNextIndex(), { animate: true });
      releaseToolButton(btn);
      // Filet de sécurité si la transition ne se termine pas.
      window.setTimeout(function () { shuffleBusy = false; }, 900);
    }

    // Délégation (comme LE-RADAR #masthead-bg-shuffle) : robuste si le bouton
    // est re-rendu par l’admin éditorial, et ne dépend pas d’un nœud figé.
    document.addEventListener('click', onShuffle);
    var shuffleBtn = document.getElementById('masthead-shuffle');
    if (shuffleBtn) {
      shuffleBtn.type = 'button';
      shuffleBtn.removeAttribute('disabled');
    }

    // Recadrer si le bandeau change de taille (rotation, redimensionnement).
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (images[index]) applyPosition(images[index]);
      }, 160);
    }, { passive: true });
  }

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

  /* Rotation scoreboard — mêmes repères que LE-RADAR météo (gare) :
   * intervalle 5200 ms, deck brassé (Fisher–Yates), animation is-arriving. */
  var SPORTS_ROTATE_MS = 5200;
  var sportsPayloadCache = null;
  var sportsSlides = [];
  var sportsDeck = [];
  var sportsTimer = null;
  var sportsReducedMotion = false;
  try {
    sportsReducedMotion = !!(window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (_) {}

  function sportsResultTone(result) {
    if (result === 'W') return '#3d9a6a';
    if (result === 'L') return '#c45c5c';
    if (result === 'D' || result === 'T') return '#8fa3b0';
    return '#6c2163';
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
        slides.push({
          mode: 'result',
          team: team,
          game: game,
          tone: sportsResultTone(game.result),
          key: 'r:' + team.id + ':' + game.date + ':' + (game.opponentCode || game.opponent),
        });
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
        slides.push({
          mode: 'next',
          team: team,
          game: next,
          tone: (team.colors && team.colors.primary) || '#6c2163',
          key: 'n:' + team.id + ':' + next.date + ':' + (next.opponentCode || next.opponent),
        });
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

  function applySportsLineMarquee(viewport) {
    if (!viewport) return;
    var inner = viewport.firstElementChild;
    if (!inner) return;
    viewport.classList.remove('is-sports-marquee');
    viewport.style.removeProperty('--sports-marquee-shift');
    viewport.style.removeProperty('--sports-marquee-duration');
    if (sportsReducedMotion) return;
    /* Mesure après paint (arrive anim + fonts). */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var overflow = inner.scrollWidth - viewport.clientWidth;
        if (overflow <= 2) return;
        viewport.classList.add('is-sports-marquee');
        viewport.style.setProperty('--sports-marquee-shift', '-' + Math.round(overflow) + 'px');
        /* ~28 px/s comme applyMarquee des titres kiosque / météo LE-RADAR. */
        viewport.style.setProperty(
          '--sports-marquee-duration',
          Math.max(6, overflow / 28).toFixed(1) + 's',
        );
      });
    });
  }

  function paintSportsChip(host, display, animate) {
    if (!host || !display) return;
    host.textContent = '';
    var team = display.team;
    var code = String(team.code || 'EQ').toUpperCase().slice(0, 4);
    var sport = display.game.sport || team.sport || '';
    var sportLabel = team.sportLabel || sport || '';
    var href = (sportsPayloadCache && sportsPayloadCache.href) || '';
    var chip = document.createElement(href ? 'a' : 'span');
    chip.className = 'sports-chip masthead-sports__chip';
    if (animate && !sportsReducedMotion) chip.classList.add('is-arriving');
    chip.style.setProperty('--sports-tone', display.tone);
    if (team.colors && team.colors.primary) {
      chip.style.setProperty('--sports-brand', team.colors.primary);
    }
    if (chip.tagName === 'A') chip.href = href;

    var glyph = document.createElement('span');
    glyph.className = 'sports-chip__glyph';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = sportsGlyph(sport);

    /*
     * Ligne enrichie + viewport marquee (défilement L→R si trop long),
     * même principe que les noms météo LE-RADAR / titres is-marquee.
     */
    var viewport = document.createElement('span');
    viewport.className = 'sports-chip__line';
    var inner = document.createElement('span');
    inner.className = 'sports-chip__line-inner';

    var titleParts = [];
    var aria = '';
    var lineText = '';
    if (display.mode === 'result') {
      var g = display.game;
      var score = g.scoreFor + '–' + g.scoreAgainst;
      var badge = g.result === 'W' ? 'V' : g.result === 'L' ? 'D' : 'N';
      var issue = g.result === 'W' ? 'Victoire' : g.result === 'L' ? 'Défaite' : 'Match nul';
      var oppName = g.opponent || g.opponentCode || 'Adversaire';
      /* Code · V/D · score · nom adversaire (pas seulement le code). */
      lineText = code + ' · ' + badge + ' ' + score + ' · ' + oppName;
      if (sportLabel) lineText += ' · ' + sportLabel;
      aria = issue + ' des ' + team.name + ' (' + sportLabel + ') : '
        + g.scoreFor + ' à ' + g.scoreAgainst + ' contre ' + oppName;
      titleParts.push(issue + ' · ' + team.name + ' · ' + sportLabel);
      titleParts.push(score + ' vs ' + oppName);
      if (g.opponentInstitution) titleParts.push(g.opponentInstitution);
      if (g.competition) titleParts.push(g.competition);
      if (g.date) titleParts.push(formatSportsChipWhen(g.date));
    } else {
      var n = display.game;
      var nextOpp = n.opponent || n.opponentCode || 'Adversaire';
      var when = formatSportsChipWhen(n.date, n.time);
      lineText = code + ' · À venir vs ' + nextOpp;
      if (when) lineText += ' · ' + when;
      if (sportLabel) lineText += ' · ' + sportLabel;
      if (n.home === true) lineText += ' · domicile';
      else if (n.home === false) lineText += ' · extérieur';
      aria = 'Prochain match des ' + team.name + ' (' + sportLabel + ') contre '
        + nextOpp + (when ? ' le ' + when : '');
      titleParts.push('Prochain · ' + team.name + ' · ' + sportLabel);
      titleParts.push('vs ' + nextOpp);
      if (when) titleParts.push(when);
    }
    if (team.fictional) titleParts.push('Formation fictive (démonstration)');

    inner.textContent = lineText;
    viewport.appendChild(inner);

    chip.title = titleParts.join(' · ');
    chip.setAttribute('aria-label', aria);
    if (team.fictional) chip.dataset.fictional = 'true';
    chip.dataset.sportsKey = display.key || '';

    chip.appendChild(glyph);
    chip.appendChild(viewport);
    host.appendChild(chip);
    host.hidden = false;
    applySportsLineMarquee(viewport);
    if (animate && !sportsReducedMotion) {
      window.setTimeout(function () {
        chip.classList.remove('is-arriving');
        applySportsLineMarquee(viewport);
      }, 500);
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

  function startSportsRotation() {
    if (sportsTimer) {
      window.clearInterval(sportsTimer);
      sportsTimer = null;
    }
    if (sportsSlides.length < 2 || sportsReducedMotion) return;
    sportsTimer = window.setInterval(rotateSportsChip, SPORTS_ROTATE_MS);
  }

  function initMastheadSports() {
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
    startSportsRotation();
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

  function initNewsTailCollapse() {
    var tail = document.querySelector('.news-tail');
    if (!tail) return;

    // Délégation : un seul handler, survivant aux re-renders.
    if (!newsTailBound) {
      newsTailBound = true;
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

  // ── Barre radio LE-RADAR ───────────────────────────────────────────────
  // Le composant reste invisible jusqu'à ce que LE-RADAR confirme explicitement
  // le protocole kiosque-v1. En cas de panne, il disparaît et laisse la simple
  // ligne de séparation du thème à sa place.
  function initRadarTuner() {
    if (!('customElements' in window) || customElements.get('radar-tuner')) return;

    function RadarTuner() { return Reflect.construct(HTMLElement, [], RadarTuner); }
    RadarTuner.prototype = Object.create(HTMLElement.prototype);
    RadarTuner.prototype.constructor = RadarTuner;
    Object.setPrototypeOf(RadarTuner, HTMLElement);

    RadarTuner.prototype.connectedCallback = function () {
      var host = this;
      var loaded = false;
      var timeout;
      function load() {
        if (loaded) return;
        loaded = true;
        var src = host.getAttribute('data-src');
        if (!src) return;
        var frame = document.createElement('iframe');
        frame.src = src;
        frame.title = 'Barre d’écoute de LE-RADAR';
        // Le parent est volontairement masqué jusqu'au message de disponibilité.
        // Un iframe lazy sous [hidden] peut ne jamais être chargé par le navigateur,
        // ce qui empêcherait précisément ce message d'arriver.
        frame.loading = 'eager';
        frame.allow = 'autoplay';
        host.appendChild(frame);
        timeout = setTimeout(function () { host.remove(); }, 6500);
        window.addEventListener('message', function (event) {
          if (event.source !== frame.contentWindow || event.origin !== 'https://le-radar.ca') return;
          var message = event.data;
          if (!message || message.type !== 'radar-embed' || message.protocol !== 1 || message.surface !== 'kiosque-v1') return;
          if (message.ready && message.available === false) {
            clearTimeout(timeout);
            host.remove();
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
              host.style.zIndex = '60';
              host.style.overflow = 'visible';
              host.style.background = 'transparent';
              /* Garder l’ombre de barre (ne pas la virer avec le popover). */
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
            host.querySelector('a')?.remove();
            host.hidden = false;
            host.dataset.state = 'ready';
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
    initMarquees();
    initRadarTuner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
