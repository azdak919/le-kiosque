(function () {
  'use strict';

  var prefill = window.KIOSQUE_PREFILL || {};
  var publication = prefill.publication || {};
  var governance = prefill.governance || {};
  var masthead = prefill.masthead || {};

  function detectBasePath() {
    var path = window.location.pathname.replace(/\/index\.html$/, '');
    var marker = path.indexOf('/configurer');
    if (marker < 0) return '';
    var base = path.slice(0, marker).replace(/\/+$/, '');
    return base === '/' ? '' : base;
  }

  var basePath = detectBasePath();
  var storageKey = 'kiosque-configurateur:' + (basePath || '/');
  var initial = {
    name: publication.name || 'Le Quorum',
    slug: publication.slug || 'le-quorum',
    tagline: publication.tagline || 'Journal de démonstration du Kiosque',
    institution: publication.institution || 'Cégep de démonstration',
    institutionType: publication.institutionType || 'cegep',
    region: publication.region || 'Québec',
    founded: publication.founded || '2026',
    repository: prefill.repository || 'nom-utilisateur/le-journal',
    deployment: prefill.deployment || 'github-pages',
    siteUrl: publication.siteUrl || 'https://journal-exemple.invalid',
    timeZone: publication.timeZone || 'America/Toronto',
    cname: '',
    accent: publication.accent || '#6c2163',
    accentDark: publication.accentDark || '#cf7ec1',
    typography: publication.typography || 'modern-accessible',
    logoAlt: publication.name || 'Le Quorum',
    logo: null,
    sections: (prefill.sections || []).map(function (section) {
      return [section.name, section.slug, section.description || ''].join(' | ');
    }).join('\n'),
    demoContent: prefill.demoContent !== false,
    startEmpty: false,
    radioEnabled: !prefill.radio || prefill.radio.enabled !== false,
    station: (prefill.radio && prefill.radio.station) || 'station-exemple',
    backgroundsEnabled: !masthead.backgrounds || masthead.backgrounds.enabled !== false,
    weatherEnabled: Boolean(masthead.weather && masthead.weather.enabled),
    weatherLocalities: (masthead.weather && masthead.weather.localities || ['Québec']).join(', '),
    pomodoro: !masthead.tools || masthead.tools.pomodoro !== false,
    solitaire: !masthead.tools || masthead.tools.solitaire !== false,
    users: (prefill.users || []).map(function (user) {
      return [user.name, user.email, user.role].join(' | ');
    }).join('\n'),
    authBaseUrl: '',
  };

  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (_) {}
  var state = Object.assign({}, initial, saved);
  var step = Math.min(12, Math.max(1, Number(saved._step) || 1));
  var generated = [];

  var form = document.getElementById('config-form');
  var fields = Array.from(form.querySelectorAll('[data-key]'));
  var steps = Array.from(form.querySelectorAll('.config-step'));
  var stepItems = Array.from(document.querySelectorAll('#steps-list li'));
  var previous = document.getElementById('previous');
  var next = document.getElementById('next');
  var status = document.getElementById('save-status');

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  }

  function normalizeHex(value, fallback) {
    var hex = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(hex) ? hex.toLowerCase() : fallback;
  }

  function slugify(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 96) || 'section';
  }

  function repoParts() {
    var match = /^([^/\s]+)\/([^/\s]+)$/.exec(String(state.repository || '').trim());
    return match ? { owner: match[1], repo: match[2] } : { owner: 'nom-utilisateur', repo: 'le-journal' };
  }

  function parseSections() {
    return String(state.sections || '').split(/\r?\n/).map(function (line, index) {
      var bits = line.split('|').map(function (part) { return part.trim(); });
      if (!bits[0]) return null;
      return { name: bits[0], slug: slugify(bits[1] || bits[0]), description: bits[2] || '', order: index + 1 };
    }).filter(Boolean);
  }

  function parseUsers() {
    return String(state.users || '').split(/\r?\n/).map(function (line) {
      var bits = line.split('|').map(function (part) { return part.trim(); });
      if (!bits[0]) return null;
      return { name: bits[0], email: bits[1] || '', role: bits[2] || 'auteur' };
    }).filter(Boolean);
  }

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(Object.assign({}, state, { _step: step })));
      status.textContent = 'Enregistré localement';
    } catch (_) {
      status.textContent = 'Stockage local indisponible';
    }
  }

  function fillFields() {
    fields.forEach(function (field) {
      var key = field.dataset.key;
      var actualKey = key === 'accentText' ? 'accent' : key === 'accentDarkText' ? 'accentDark' : key;
      if (field.type === 'checkbox') field.checked = Boolean(state[actualKey]);
      else field.value = state[actualKey] == null ? '' : state[actualKey];
    });
  }

  function relativeLuminance(hex) {
    var rgb = [1, 3, 5].map(function (offset) {
      var channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  }

  function contrastRatio(first, second) {
    var a = relativeLuminance(first);
    var b = relativeLuminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  function updatePreview() {
    var accent = normalizeHex(state.accent, '#6c2163');
    var result = document.getElementById('contrast-result');
    var preview = document.getElementById('live-preview');
    preview.style.setProperty('--preview-accent', accent);
    document.getElementById('preview-name').textContent = state.name || 'Votre journal';
    document.getElementById('preview-tagline').textContent = state.tagline || 'Votre signature éditoriale';
    var white = contrastRatio(accent, '#ffffff');
    var dark = contrastRatio(accent, '#16181c');
    var best = Math.max(white, dark);
    var foreground = white >= dark ? 'blanc' : 'foncé';
    result.className = 'contrast ' + (best >= 4.5 ? 'pass' : 'warn');
    result.textContent = (best >= 4.5 ? 'Contraste AA : ' : 'Avertissement, contraste faible : ') +
      best.toFixed(2) + ':1 avec un texte ' + foreground + '. La génération reste permise.';
  }

  function exampleWarnings() {
    var values = [state.name, state.institution, state.siteUrl, state.repository, state.users];
    return values.some(function (value) {
      return /quorum|d[ée]monstration|exemple|nom-utilisateur/i.test(String(value || ''));
    });
  }

  function updateReview() {
    var users = parseUsers();
    var sections = parseSections();
    var warning = exampleWarnings()
      ? '<p class="warning"><strong>Valeurs fictives restantes :</strong> remplacez-les avant la publication.</p>'
      : '<p>Aucune marque évidente de démonstration détectée.</p>';
    document.getElementById('review-summary').innerHTML = [
      ['Journal', escapeHtml(state.name) + '<br>' + escapeHtml(state.institution)],
      ['Publication', escapeHtml(state.deployment) + '<br>' + escapeHtml(state.siteUrl)],
      ['Structure', sections.length + ' section(s), ' + users.length + ' personne(s) à inviter'],
      ['Options', (state.demoContent ? 'Démonstration active' : 'Démonstration masquée') + '<br>' + (state.radioEnabled ? 'Radio active' : 'Radio masquée')],
      ['Administration', state.authBaseUrl ? 'Service déclaré : ' + escapeHtml(state.authBaseUrl) : 'Authentification à configurer'],
      ['Vérification', warning],
    ].map(function (entry) {
      return '<article><h2>' + entry[0] + '</h2><p>' + entry[1] + '</p></article>';
    }).join('');
  }

  function showStep() {
    steps.forEach(function (section, index) { section.hidden = index + 1 !== step; });
    stepItems.forEach(function (item, index) {
      item.classList.toggle('current', index + 1 === step);
      item.classList.toggle('done', index + 1 < step);
      if (index + 1 === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    previous.disabled = step === 1;
    next.hidden = step === 12;
    next.textContent = step === 1 ? 'Commencer' : step === 11 ? 'Voir les prochaines étapes' : 'Continuer';
    if (step === 10) updateReview();
    if (step === 11) renderGenerated();
    if (step === 12) renderFinish();
    document.getElementById('step-live').textContent = 'Étape ' + step + ' sur 12';
    save();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  fields.forEach(function (field) {
    field.addEventListener('input', function () {
      var key = field.dataset.key;
      var actualKey = key === 'accentText' ? 'accent' : key === 'accentDarkText' ? 'accentDark' : key;
      state[actualKey] = field.type === 'checkbox' ? field.checked : field.value;
      if (key === 'name' && (!state.slug || state.slug === slugify(initial.name))) state.slug = slugify(state.name);
      fillFields();
      updatePreview();
      status.textContent = 'Enregistrement…';
      save();
    });
    field.addEventListener('change', function () { field.dispatchEvent(new Event('input')); });
  });

  var logoInput = document.getElementById('config-logo');
  logoInput.addEventListener('change', function () {
    var file = logoInput.files && logoInput.files[0];
    if (!file) return;
    var allowed = ['image/svg+xml', 'image/png', 'image/webp', 'image/jpeg'];
    var limit = file.type === 'image/svg+xml' ? 512 * 1024 : 2 * 1024 * 1024;
    if (allowed.indexOf(file.type) < 0 || file.size > limit) {
      window.alert('Ce logo est trop lourd ou utilise un format non pris en charge.');
      logoInput.value = '';
      return;
    }
    function keepLogo(data) {
      state.logo = { id: crypto.randomUUID(), kind: 'image', src: data, alt: state.logoAlt || state.name, mime: file.type, source: { backend: 'configurateur', backendId: file.name, fetchedAt: new Date().toISOString() } };
      save();
    }
    if (file.type === 'image/svg+xml') {
      file.text().then(function (raw) {
        var svg = new DOMParser().parseFromString(raw, 'image/svg+xml');
        svg.querySelectorAll('script,foreignObject').forEach(function (node) { node.remove(); });
        svg.querySelectorAll('*').forEach(function (node) {
          Array.from(node.attributes).forEach(function (attribute) {
            if (/^on/i.test(attribute.name) || /^(?:https?:|javascript:)/i.test(attribute.value)) node.removeAttribute(attribute.name);
          });
        });
        keepLogo('data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(svg.documentElement)))));
      });
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      keepLogo(reader.result);
    };
    reader.readAsDataURL(file);
  });

  previous.addEventListener('click', function () { if (step > 1) { step--; showStep(); } });
  next.addEventListener('click', function () { if (step < 12) { step++; showStep(); } });
  document.getElementById('clear-data').addEventListener('click', function () {
    if (!window.confirm('Effacer toutes les réponses enregistrées dans ce navigateur?')) return;
    try { localStorage.removeItem(storageKey); } catch (_) {}
    state = Object.assign({}, initial);
    step = 1;
    fillFields(); updatePreview(); showStep();
  });

  function yaml(value) {
    return JSON.stringify(String(value == null ? '' : value));
  }

  function generateFiles() {
    var repo = repoParts();
    var sections = parseSections();
    var users = parseUsers();
    var contact = users[0] && users[0].email ? users[0].email : 'redaction@journal-exemple.invalid';
    var recovery = users.filter(function (user) { return user.email; }).slice(0, 2).map(function (user) { return user.email; });
    while (recovery.length < 2) recovery.push('releve-' + (recovery.length + 1) + '@journal-exemple.invalid');
    var deployBase = state.deployment === 'github-pages' ? '/' + repo.repo : '';
    var cms = String(state.authBaseUrl || '').trim();

    var config = [
      "import type { KiosqueConfig } from './packages/pipeline/src/config.ts';",
      '',
      'const config: Partial<KiosqueConfig> = {',
      "  source: { adapter: 'markdown', options: { root: new URL('.', import.meta.url).pathname } },",
      "  editorial: { mode: 'git-sveltia' },",
      '  deploy: {',
      '    basePath: ' + JSON.stringify(deployBase) + ',',
      state.deployment === 'custom-domain' && state.cname ? '    cname: ' + JSON.stringify(state.cname) + ',' : '',
      '  },',
      cms ? '  cms: { authBaseUrl: ' + JSON.stringify(cms) + ', branch: \'main\' },' : '',
      '  demoContent: ' + Boolean(state.demoContent) + ',',
      '  feedLimit: 30,',
      '};',
      '',
      'export default config;',
      '',
    ].filter(function (line) { return line !== ''; }).join('\n').replace('};\nexport', '};\n\nexport');

    var publicationYaml = [
      '# Valeurs générées localement par le configurateur KIOSQUE.',
      'slug: ' + yaml(slugify(state.slug || state.name)),
      'name: ' + yaml(state.name),
      'tagline: ' + yaml(state.tagline),
      'institution: ' + yaml(state.institution),
      'institutionType: ' + yaml(state.institutionType),
      'region: ' + yaml(state.region),
      'lang: fr-CA',
      'siteUrl: ' + yaml(state.siteUrl),
      'timeZone: ' + yaml(state.timeZone || 'America/Toronto'),
      'theme:',
      '  accent: ' + yaml(normalizeHex(state.accent, '#6c2163')),
      '  accentDark: ' + yaml(normalizeHex(state.accentDark, '#cf7ec1')),
      '  typography: ' + yaml(state.typography || 'modern-accessible'),
      'masthead:',
      '  backgrounds:',
      '    enabled: ' + Boolean(state.backgroundsEnabled),
      '    images: []',
      '  weather:',
      '    enabled: ' + Boolean(state.weatherEnabled),
      '    localities: [' + String(state.weatherLocalities || '').split(',').map(function (value) { return yaml(value.trim()); }).filter(function (value) { return value !== '\"\"'; }).slice(0, 4).join(', ') + ']',
      '  tools:',
      '    pomodoro: ' + Boolean(state.pomodoro),
      '    solitaire: ' + Boolean(state.solitaire),
      'radio:',
      '  enabled: ' + Boolean(state.radioEnabled),
      '  station: ' + yaml(state.station),
      '  theme: dark',
      '  position: top',
      'founded: ' + yaml(state.founded),
      'license: CC-BY-SA-4.0',
      'governance:',
      '  owner: ' + yaml(repo.owner),
      '  stewardEntity: ' + yaml(state.institution),
      '  contact: ' + yaml(contact),
      '  repo: ' + yaml('https://github.com/' + repo.owner + '/' + repo.repo),
      '  recoveryContacts:',
      '    - ' + yaml(recovery[0]),
      '    - ' + yaml(recovery[1]),
      '',
    ].join('\n');

    var categoryLines = (prefill.categories || []).map(function (item) {
      return '  - name: ' + yaml(item.name) + '\n    slug: ' + yaml(item.slug);
    });
    var tagLines = (prefill.tags || []).map(function (item) {
      return '  - name: ' + yaml(item.name) + '\n    slug: ' + yaml(item.slug);
    });
    var taxonomies = ['categories:'].concat(categoryLines.length ? categoryLines : ['  []'], ['tags:'], tagLines.length ? tagLines : ['  []'], ['']).join('\n');

    var tokens = [
      '/* Seul fichier visuel à personnaliser. */',
      ':root {',
      '  --bg: #ffffff; --bg-soft: #f6f6f4;',
      '  --ink: #16181c; --ink-soft: #44474d; --muted: #80858c;',
      '  --rule: #e7e7e3; --rule-strong: #14161a;',
      '  --accent: ' + normalizeHex(state.accent, '#6c2163') + ';',
      '  --accent-dark: ' + normalizeHex(state.accentDark, '#cf7ec1') + ';',
      '  --live: #c8102e; --live-dark: #9c0c24;',
      '  --radio: #003da5; --radio-bright: #5d9be0;',
      '  --serif: ' + (state.typography === 'institutional' ? 'Arial, Helvetica, sans-serif' : 'Georgia, "Times New Roman", serif') + ';',
      '  --sans: system-ui, -apple-system, "Segoe UI", sans-serif;',
      '  --maxw: 800px; --pad: 24px;',
      '  --wordmark-size: clamp(2.05rem, 6.8vw + .3rem, 4.25rem);',
      '  --lead-title-size: clamp(1.55rem, 4.1vw + .15rem, 2.55rem);',
      '}',
      ':root[data-theme="dark"] {',
      '  --bg: #0e0f12; --bg-soft: #181a1e;',
      '  --ink: #f1f2f4; --ink-soft: #c2c6cd; --muted: #888d96;',
      '  --rule: #26282d; --rule-strong: #f1f2f4;',
      '  --accent: ' + normalizeHex(state.accentDark, '#cf7ec1') + ';',
      '}',
      '',
    ].join('\n');

    var files = [
      { path: 'kiosque.config.ts', content: config },
      { path: 'content/publication.yml', content: publicationYaml },
      { path: 'content/taxonomies.yml', content: taxonomies },
      { path: 'theme/tokens.css', content: tokens },
    ];
    sections.forEach(function (section) {
      files.push({
        path: 'content/sections/' + section.slug + '.yml',
        content: [
          'slug: ' + yaml(section.slug),
          'name: ' + yaml(section.name),
          'description: ' + yaml(section.description),
          'order: ' + section.order,
          '',
        ].join('\n'),
      });
    });
    return files;
  }

  function copyText(text, button) {
    var promise = navigator.clipboard && navigator.clipboard.writeText
      ? navigator.clipboard.writeText(text)
      : Promise.reject(new Error('Presse-papiers indisponible'));
    promise.then(function () {
      var old = button.textContent;
      button.textContent = 'Copié';
      window.setTimeout(function () { button.textContent = old; }, 1300);
    }).catch(function () { window.prompt('Copiez ce texte :', text); });
  }

  function download(name, content, type) {
    var link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type: type || 'text/plain;charset=utf-8' }));
    link.download = name;
    link.click();
    window.setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function renderGenerated() {
    generated = generateFiles();
    var container = document.getElementById('generated-files');
    container.innerHTML = generated.map(function (file, index) {
      return '<article class="file-card"><header><code>' + escapeHtml(file.path) + '</code><div>' +
        '<button type="button" data-copy-file="' + index + '">Copier</button>' +
        '<button type="button" data-download-file="' + index + '">Télécharger</button>' +
        '</div></header><pre><code>' + escapeHtml(file.content) + '</code></pre></article>';
    }).join('');
    container.querySelectorAll('[data-copy-file]').forEach(function (button) {
      button.addEventListener('click', function () { copyText(generated[Number(button.dataset.copyFile)].content, button); });
    });
    container.querySelectorAll('[data-download-file]').forEach(function (button) {
      button.addEventListener('click', function () {
        var file = generated[Number(button.dataset.downloadFile)];
        download(file.path.split('/').pop(), file.content);
      });
    });
    var repo = repoParts();
    var repoSlug = repo.owner + '/' + repo.repo;
    var githubDev = 'https://github.dev/' + repoSlug;
    var addFile = 'https://github.com/' + repoSlug + '/new/main';
    var instructions = [
      '1. Créez votre dépôt avec « Use this template » depuis https://github.com/azdak919/le-kiosque.',
      '2. Ouvrez https://github.dev/' + repoSlug + ' et remplacez les fichiers aux chemins indiqués.',
      '3. Enregistrez les changements dans une nouvelle branche ou directement dans main selon vos règles.',
      '4. Dans Settings → Pages, choisissez GitHub Actions. Activez aussi les Actions si vous avez fait un fork.',
      '5. Attendez la fin du workflow « Publier le journal », puis vérifiez le site et /admin/.',
    ].join('\n');
    document.getElementById('exact-instructions').innerHTML = '<strong>Instructions exactes</strong><ol>' +
      instructions.split('\n').map(function (line) { return '<li>' + escapeHtml(line.replace(/^\d+\.\s*/, '')) + '</li>'; }).join('') +
      '</ol><p><a href="' + escapeHtml(githubDev) + '">Ouvrir dans github.dev</a> · <a href="' + escapeHtml(addFile) + '">Ajouter un fichier sur GitHub</a></p>';
    document.getElementById('copy-all').onclick = function () { copyText(instructions, this); };
    document.getElementById('download-zip').onclick = function () { downloadZip(generated); };
  }

  function crc32(bytes) {
    var crc = -1;
    for (var i = 0; i < bytes.length; i++) {
      crc ^= bytes[i];
      for (var bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ -1) >>> 0;
  }
  function word(value) { return [value & 255, (value >>> 8) & 255]; }
  function dword(value) { return word(value).concat(word(value >>> 16)); }
  function joinBytes(parts) {
    var length = parts.reduce(function (sum, part) { return sum + part.length; }, 0);
    var output = new Uint8Array(length);
    var offset = 0;
    parts.forEach(function (part) { output.set(part, offset); offset += part.length; });
    return output;
  }
  function zipStore(files) {
    var encoder = new TextEncoder();
    var local = [], central = [], offset = 0;
    files.forEach(function (file) {
      var name = encoder.encode(file.path), data = encoder.encode(file.content), sum = crc32(data);
      var header = new Uint8Array([80, 75, 3, 4].concat(word(20), word(0x800), word(0), word(0), word(0),
        dword(sum), dword(data.length), dword(data.length), word(name.length), word(0)));
      local.push(header, name, data);
      central.push(new Uint8Array([80, 75, 1, 2].concat(word(20), word(20), word(0x800), word(0), word(0), word(0),
        dword(sum), dword(data.length), dword(data.length), word(name.length), word(0), word(0), word(0), word(0),
        dword(0), dword(offset))), name);
      offset += header.length + name.length + data.length;
    });
    var localBytes = joinBytes(local), centralBytes = joinBytes(central);
    var end = new Uint8Array([80, 75, 5, 6].concat(word(0), word(0), word(files.length), word(files.length),
      dword(centralBytes.length), dword(localBytes.length), word(0)));
    return joinBytes([localBytes, centralBytes, end]);
  }
  function downloadZip(files) {
    download(slugify(state.slug || state.name) + '-configuration.zip', zipStore(files), 'application/zip');
  }

  function renderFinish() {
    var site = String(state.siteUrl || '').replace(/\/+$/, '');
    var front = /^https?:\/\//.test(site) ? site + '/' : '#';
    var repo = repoParts();
    persistDemoBootstrap();
    var cards = [
      '<article><strong>Administration locale</strong><span>Créez et publiez maintenant, sans compte ni jeton. Les données restent dans ce navigateur.</span><a href="' + escapeHtml(prefill.adminPath || (basePath + '/admin/')) + '">Ouvrir /admin/</a></article>',
      '<article><strong>Front end</strong><span>Votre futur site public.</span><a href="' + escapeHtml(front) + '">Adresse configurée</a></article>',
      '<article><strong>Fichiers</strong><span>Modifiez-les sans terminal.</span><a href="https://github.dev/' + escapeHtml(repo.owner + '/' + repo.repo) + '">Ouvrir github.dev</a></article>',
    ];
    if (state.authBaseUrl) {
      cards.push('<article><strong>Administration</strong><span>Le service d’authentification est déclaré.</span><a href="' + escapeHtml(site + '/admin/') + '">Ouvrir /admin/</a></article>');
    } else {
      cards.push('<article><strong>Administration</strong><span>Étape restante : déployer sveltia-cms-auth, puis ajouter son URL dans <code>cms.authBaseUrl</code>. Aucun lien de connexion n’est actif pour le moment.</span></article>');
    }
    document.getElementById('finish-links').innerHTML = cards.join('');
  }

  function persistDemoBootstrap() {
    var bootstrap = Object.assign({}, state, {
      sections: parseSections(),
      users: parseUsers(),
      demoContent: state.startEmpty ? false : state.demoContent,
    });
    var request = indexedDB.open('kiosque-configurateur', 1);
    request.onupgradeneeded = function () { request.result.createObjectStore('bootstraps'); };
    request.onsuccess = function () {
      var tx = request.result.transaction('bootstraps', 'readwrite');
      tx.objectStore('bootstraps').put(bootstrap, prefill.databaseKey || ('kiosque-' + (basePath || 'root') + '-le-quorum'));
      tx.oncomplete = function () { request.result.close(); };
    };
  }

  fillFields();
  updatePreview();
  showStep();
})();
