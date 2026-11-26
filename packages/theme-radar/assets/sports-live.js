/**
 * Expose le recalcul du direct de démo avant kiosque.js.
 * Le HTML fige l’heure au build ; ce module laisse le navigateur
 * la refaire avec l’horloge du visiteur.
 */
import { alignDemoSportsToToday } from './editorial/sports-freshness.js';

globalThis.KiosqueAlignDemoSports = alignDemoSportsToToday;
