/**
 * Barre radio native du Kiosque — noyau partagé par le build statique
 * (templates.ts) et la démo PGlite (assets/editorial/render.js).
 *
 * Avant : une iframe de le-radar.ca. Elle peignait sa propre barre dans une
 * boîte de hauteur fixe, se coupait sur mobile, et le journal dépendait d’un
 * autre site pour un simple flux audio. Maintenant, le journal sert son propre
 * lecteur : un <audio> natif (lisible sans JavaScript), habillé par kiosque.js.
 *
 * Le répertoire des radios étudiantes vient de LE-RADAR (radios.json, relevé
 * du 17 novembre 2026). Une station absente se décrit dans publication.yml
 * (radio.stream, radio.name, radio.frequency, radio.website). Au lancement,
 * le navigateur peut demander à LE-RADAR l’émission en cours et une adresse de
 * flux plus récente : c’est un plus, jamais une condition pour écouter.
 */

export const RADAR_ORIGIN = 'https://le-radar.ca';

export const STATIONS = {
  chyz: { name: 'CHYZ 94,3 FM', frequency: '94,3 FM', institution: 'Université Laval', city: 'Québec', website: 'https://chyz.ca/', stream: 'https://ecoutez.chyz.ca/proxy/chyz/stream' },
  cism: { name: 'CISM 89,3 FM', frequency: '89,3 FM', institution: 'Université de Montréal', city: 'Montréal', website: 'https://cism893.ca/', stream: 'https://stream.cism893.ca/' },
  ckut: { name: 'CKUT 90,3 FM', frequency: '90,3 FM', institution: 'Université McGill', city: 'Montréal', website: 'https://ckut.ca/', stream: 'https://ckut.out.airtime.pro/ckut_a' },
  cjlo: { name: 'CJLO 1690 AM', frequency: '1690 AM', institution: 'Université Concordia', city: 'Montréal', website: 'https://www.cjlo.com/', stream: 'https://cjlo.radioca.st/stream' },
  cfak: { name: 'CFAK 88,3 FM', frequency: '88,3 FM', institution: 'Université de Sherbrooke', city: 'Sherbrooke', website: 'https://www.cfak.ca/', stream: 'https://streams.radiomast.io/a372c74f-6c78-48b9-9933-81a8fc50b54a' },
  choq: { name: 'CHOQ', frequency: 'Web', institution: 'Université du Québec à Montréal', city: 'Montréal', website: 'https://www.choq.ca/', stream: 'https://playerservices.streamtheworld.com/api/livestream-redirect/SP_R4799664_SC' },
};

function httpsOnly(value) {
  const text = String(value || '').trim();
  return /^https:\/\//i.test(text) ? text : '';
}

/** Station résolue, ou null si la barre ne doit pas paraître. */
export function resolveStation(radio) {
  if (!radio || radio.enabled === false) return null;
  const id = String(radio.station || '').trim().toLowerCase();
  const known = STATIONS[id] || null;
  const stream = httpsOnly(radio.stream) || known?.stream || '';
  // Sans flux https, pas de lecteur : un journal servi en https ne peut pas
  // lire un flux http (contenu mixte), et un bouton muet trompe le lecteur.
  if (!stream) return null;
  return {
    id: known ? id : (id || 'station'),
    known: Boolean(known),
    name: String(radio.name || known?.name || id.toUpperCase() || 'Radio étudiante'),
    frequency: String(radio.frequency || known?.frequency || ''),
    institution: String(known?.institution || ''),
    website: httpsOnly(radio.website) || known?.website || '',
    stream,
  };
}

function escape(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const ICON_PLAY = '<svg class="kiosque-radio__icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
const ICON_PAUSE = '<svg class="kiosque-radio__icon-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>';
const ICON_VOLUME = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z" fill="currentColor" stroke="none"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>';

/**
 * HTML de la barre. Sans JavaScript, le lecteur natif du navigateur
 * (<audio controls>) reste utilisable ; kiosque.js le remplace par les
 * commandes du thème et ajoute la classe is-enhanced.
 */
export function radioBarHtml(radio) {
  const station = resolveStation(radio);
  if (!station) return '';
  const label = station.frequency && !station.name.includes(station.frequency)
    ? `${station.name} · ${station.frequency}`
    : station.name;
  const nowplaying = station.known ? ` data-nowplaying="${RADAR_ORIGIN}/radio-nowplaying.json" data-directory="${RADAR_ORIGIN}/radios.json"` : '';
  return `<section class="kiosque-radio" aria-label="Radio étudiante" data-station="${escape(station.id)}" data-stream="${escape(station.stream)}"${nowplaying} data-state="idle">
  <div class="kiosque-radio__inner">
    <button type="button" class="kiosque-radio__play" aria-pressed="false" aria-label="Écouter ${escape(label)}" hidden>${ICON_PLAY}${ICON_PAUSE}</button>
    <div class="kiosque-radio__id">
      <p class="kiosque-radio__status"><span class="kiosque-radio__dot" aria-hidden="true"></span><span data-radio-status>Radio étudiante</span></p>
      <p class="kiosque-radio__name"><strong>${escape(station.name)}</strong>${station.institution ? `<span class="kiosque-radio__inst">${escape(station.institution)}</span>` : ''}</p>
    </div>
    <p class="kiosque-radio__show" data-radio-show aria-live="polite"></p>
    <audio class="kiosque-radio__audio" controls preload="none" src="${escape(station.stream)}">
      <a href="${escape(station.stream)}">Écouter ${escape(station.name)}</a>
    </audio>
    <label class="kiosque-radio__volume" hidden>${ICON_VOLUME}<span class="kiosque-radio__sr">Volume</span><input type="range" min="0" max="100" step="5" value="80" data-radio-volume></label>
    ${station.website ? `<a class="kiosque-radio__site" href="${escape(station.website)}" rel="noopener" target="_blank">Site de la station<span aria-hidden="true"> ↗</span></a>` : ''}
  </div>
</section>`;
}
