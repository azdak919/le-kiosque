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

  function applyTheme(theme) {
    root.dataset.theme = theme;
    try { localStorage.setItem(STORAGE_KEY, theme); } catch (_) {}
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btn.setAttribute('aria-label', theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre');
      btn.title = btn.getAttribute('aria-label');
      var sun = btn.querySelector('.ico-sun');
      var moon = btn.querySelector('.ico-moon');
      if (sun) sun.hidden = theme === 'dark';
      if (moon) moon.hidden = theme !== 'dark';
    }
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

  function initMastheadBackgrounds() {
    var image = document.querySelector('[data-masthead-background]');
    var data = document.getElementById('masthead-backgrounds');
    if (!image || !data) return;
    var images = [];
    try { images = JSON.parse(data.textContent || '[]'); } catch (_) {}
    if (!images.length) return;
    var credit = document.querySelector('[data-masthead-credit]');
    var masthead = image.closest('.masthead');
    image.addEventListener('error', function () { masthead?.classList.add('masthead--image-error'); });
    image.addEventListener('load', function () { masthead?.classList.remove('masthead--image-error'); });
    var index = Math.floor(Math.random() * images.length);
    function show(next) {
      index = (next + images.length) % images.length;
      var item = images[index];
      image.src = item.src;
      image.style.objectPosition = item.backgroundPosition || '50% 50%';
      if (credit) {
        credit.replaceChildren();
        if (item.credit) {
          var label = 'Photo : ' + item.credit;
          if (item.creditUrl && /^https:\/\//i.test(item.creditUrl)) {
            var link = document.createElement('a');
            link.href = item.creditUrl;
            link.rel = 'noopener';
            link.textContent = label;
            credit.appendChild(link);
          } else credit.textContent = label;
        }
      }
    }
    show(index);
    document.getElementById('masthead-shuffle')?.addEventListener('click', function () {
      show(images.length > 1 ? index + 1 + Math.floor(Math.random() * (images.length - 1)) : 0);
    });
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
    applyTheme(currentTheme());
    var btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.hidden = false;
      btn.addEventListener('click', function () {
        applyTheme(root.dataset.theme === 'dark' ? 'light' : 'dark');
      });
    }
    // Suivre le système si aucun choix explicite n'est stocké.
    if (window.matchMedia) {
      try {
        if (!localStorage.getItem(STORAGE_KEY)) {
          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
            if (!localStorage.getItem(STORAGE_KEY)) applyTheme(currentTheme());
          });
        }
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
    initMarquees();
    initRadarTuner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
