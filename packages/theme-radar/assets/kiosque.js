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
      btn.textContent = theme === 'dark' ? 'Clair' : 'Sombre';
    }
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

  // ── Barre radio LE RADAR ───────────────────────────────────────────────
  // L'iframe n'est créée qu'à l'approche de la zone visible. Le paramètre de
  // station et celui du thème sont déjà émis, même si l'intégration distante
  // ne les honore pas encore tous les deux depuis un domaine tiers.
  function initRadarTuner() {
    if (!('customElements' in window) || customElements.get('radar-tuner')) return;

    function RadarTuner() { return Reflect.construct(HTMLElement, [], RadarTuner); }
    RadarTuner.prototype = Object.create(HTMLElement.prototype);
    RadarTuner.prototype.constructor = RadarTuner;
    Object.setPrototypeOf(RadarTuner, HTMLElement);

    RadarTuner.prototype.connectedCallback = function () {
      var host = this;
      var loaded = false;
      function load() {
        if (loaded) return;
        loaded = true;
        var src = host.getAttribute('data-src');
        if (!src) return;
        var frame = document.createElement('iframe');
        frame.src = src;
        frame.title = 'Barre d’écoute de LE RADAR';
        frame.loading = 'lazy';
        frame.allow = 'autoplay';
        host.replaceChildren(frame);
        window.addEventListener('message', function (event) {
          if (event.source !== frame.contentWindow || event.origin !== 'https://le-radar.ca') return;
          var message = event.data;
          if (!message || message.type !== 'radar-embed') return;
          var height = Number(message.height);
          if (Number.isFinite(height) && height >= 40 && height <= 500) {
            frame.style.height = Math.round(height) + 'px';
          }
        });
      }
      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
          if (entries.some(function (entry) { return entry.isIntersecting; })) {
            observer.disconnect();
            load();
          }
        }, { rootMargin: '300px' });
        observer.observe(host);
      } else {
        load();
      }
    };

    customElements.define('radar-tuner', RadarTuner);
  }

  function init() {
    initTheme();
    initMarquees();
    initRadarTuner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
