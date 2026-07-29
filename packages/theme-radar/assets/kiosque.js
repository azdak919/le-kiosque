/*
 * LE KIOSQUE — le seul JavaScript du site publié.
 *
 * Deux choses, et rien d'autre : le bouton clair/sombre, et le défilement des
 * titres qui débordent. Le site doit rester entièrement lisible si ce fichier
 * ne se charge jamais — c'est la même exigence que le reste du projet : la
 * lecture ne dépend de rien.
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
      el.addEventListener('click', release);
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
    if (!images.length) return;
    var credit = document.querySelector('[data-masthead-credit]');
    var masthead = image.closest('.masthead');
    var index = Math.floor(Math.random() * images.length);
    /** Transition active (LE-RADAR _activePhotoTransition) — annule un shuffle rapide. */
    var activeTransition = null;
    var hasShown = false;

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

    function commit(item) {
      masthead?.classList.remove('masthead--image-error');
      if (image.getAttribute('src') !== item.src) image.src = item.src;
      applyPosition(item);
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

      var shouldCrossfade =
        options.animate !== false &&
        hasShown &&
        image.getAttribute('src') &&
        image.getAttribute('src') !== item.src &&
        !reduceMotion;

      if (!shouldCrossfade) {
        cancelActiveTransition();
        commit(item);
        return;
      }

      cancelActiveTransition();

      var incoming = document.createElement('img');
      incoming.className = 'masthead-background masthead-background-transition';
      incoming.alt = '';
      incoming.setAttribute('aria-hidden', 'true');
      incoming.decoding = 'async';
      // Insérer juste après la photo de base, avant le voile (z-order correct).
      if (image.nextSibling) image.parentNode.insertBefore(incoming, image.nextSibling);
      else image.parentNode.appendChild(incoming);

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
        incoming.remove();
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
          incoming.remove();
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
        if (image.getAttribute('src') !== item.src) image.src = item.src;
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
        incoming.remove();
        activeTransition = null;
        commit(item);
      }, { once: true });

      incoming.addEventListener('load', startFade, { once: true });
      incoming.src = item.src;
      // Cache navigateur : load peut ne pas se re-déclencher si déjà complete.
      if (incoming.complete && incoming.naturalWidth > 0) startFade();
    }

    show(index, { animate: false });

    var shuffleBtn = document.getElementById('masthead-shuffle');
    if (shuffleBtn) {
      shuffleBtn.addEventListener('click', function () {
        var nextIndex = images.length > 1
          ? index + 1 + Math.floor(Math.random() * (images.length - 1))
          : 0;
        show(nextIndex, { animate: true });
        releaseToolButton(shuffleBtn);
      });
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

  function initMastheadWeather() {
    var host = document.querySelector('[data-weather-localities]');
    if (!host || typeof fetch !== 'function') return;
    var localities = [];
    try { localities = JSON.parse(host.dataset.weatherLocalities || '[]').slice(0, 4); } catch (_) {}
    var meteoBase = host.dataset.meteoconsBase || '';
    if (!meteoBase) {
      var tokens = document.querySelector('link[href*="tokens.css"]');
      if (tokens) meteoBase = tokens.href.replace(/tokens\.css.*$/, 'meteocons/animated/');
      else meteoBase = 'assets/meteocons/animated/';
    }
    Promise.all(localities.map(async function (name) {
      var cacheKey = 'kiosque-weather:' + name.toLowerCase();
      try {
        var cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
        if (cached && Date.now() - cached.savedAt < 30 * 60 * 1000) return cached.value;
      } catch (_) {}
      var geocode = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=fr&countryCode=CA&name=' + encodeURIComponent(name)).then(function (r) { if (!r.ok) throw new Error('geocoding'); return r.json(); });
      var place = geocode.results && geocode.results[0];
      if (!place) throw new Error('locality');
      var forecast = await fetch('https://api.open-meteo.com/v1/forecast?current=temperature_2m,weather_code,is_day&timezone=auto&latitude=' + encodeURIComponent(place.latitude) + '&longitude=' + encodeURIComponent(place.longitude)).then(function (r) { if (!r.ok) throw new Error('forecast'); return r.json(); });
      var value = {
        name: place.name || name,
        temperature: Math.round(forecast.current.temperature_2m),
        code: Number(forecast.current.weather_code),
        isDay: Number(forecast.current.is_day),
      };
      try { localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), value: value })); } catch (_) {}
      return value;
    })).then(function (values) {
      values.forEach(function (value) {
        // Même vocabulaire de classes que LE-RADAR (villes secondaires / ardoise).
        var chip = document.createElement('span');
        chip.className = 'weather-chip masthead-weather__city';
        chip.style.setProperty('--weather-tone', weatherTone(value.code));
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
    }).catch(function () { host.remove(); });
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
            frame.style.height = Math.round(height) + 'px';
          }
          if (message.ready && message.available === true) {
            clearTimeout(timeout);
            host.querySelector('a')?.remove();
            host.hidden = false;
            host.dataset.state = 'ready';
          }
        });
      }
      load();
    };

    customElements.define('radar-tuner', RadarTuner);
  }

  function init() {
    initTheme();
    initMastheadClock();
    initMastheadBackgrounds();
    initMastheadWeather();
    initMastheadToolRelease();
    initMarquees();
    initRadarTuner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
