/**
 * Barre radio du journal — un seul appel au module de LE-RADAR.
 *
 * La radio est un produit de LE-RADAR : ses stations, son code et son style
 * vivent là-bas (https://le-radar.ca/radio-barre.js). Le Kiosque n'en garde
 * aucune copie, pour que chaque changement arrive aux journaux sans mise à
 * jour du Kiosque. Ce fichier ne fait que poser la ligne d'appel.
 *
 * - Radio désactivée, ou sans station : aucune barre, aucune requête vers
 *   le-radar.ca (le module n'est même pas chargé).
 * - Pendant le chargement, la place de la barre est réservée (pas de saut de
 *   la page quand elle apparaît).
 * - Si LE-RADAR ne répond pas, le module ne pose rien et marque l'emplacement
 *   `data-radar-radio="off"` : il se replie. Si le module lui-même ne se
 *   charge pas, l'erreur du <script> fait de même.
 *
 * Partagé par le build statique (templates.ts) et la démo (render.js).
 */

export const RADAR_ORIGIN = 'https://le-radar.ca';
export const RADAR_MODULE = `${RADAR_ORIGIN}/radio-barre.js`;

/** Identifiant de station (celui de radios.json), ou null sans barre. */
export function radioStation(radio) {
  if (!radio || radio.enabled === false) return null;
  const id = String(radio.station || '').trim().toLowerCase();
  return /^[a-z0-9-]{2,40}$/.test(id) ? id : null;
}

/** HTML de l'emplacement : vide si la radio est éteinte. */
export function radioBarHtml(radio) {
  const station = radioStation(radio);
  if (!station) return '';
  // La place de la barre est réservée dès le départ (theme.css) ; si le module
  // ne se charge pas, l'emplacement se replie aussitôt (« off »).
  return `<div class="radar-radio-slot" data-station="${station}"><script src="${RADAR_MODULE}" data-station="${station}" async onerror="this.parentNode.dataset.radarRadio='off'"></script></div>`;
}

/**
 * Même emplacement, construit dans le DOM (la démo re-rend sans recharger) :
 * un <script> posé par innerHTML ne s'exécuterait pas.
 */
export function radioSlotElement(radio, doc = document) {
  const station = radioStation(radio);
  if (!station) return null;
  const slot = doc.createElement('div');
  slot.className = 'radar-radio-slot';
  slot.dataset.station = station;
  const script = doc.createElement('script');
  script.src = RADAR_MODULE;
  script.async = true;
  script.dataset.station = station;
  script.addEventListener('error', () => { slot.dataset.radarRadio = 'off'; });
  slot.append(script);
  return slot;
}
