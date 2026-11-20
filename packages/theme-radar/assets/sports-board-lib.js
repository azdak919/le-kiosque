/**
 * LE KIOSQUE — sélection et vague du bandeau sports (parité LE-RADAR
 * radar-sports-cta.js : sportsBoardCount, sportsSplitVisible, scheduleSportsWave).
 * Sans CTA « Au tableau ». Utilisable dans le navigateur (global) et en tests (export).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  root.KiosqueSportsBoard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SPORTS_CASCADE_STEP_MS = 440;
  var SPORTS_BOARD_HOLD_MIN_MS = 9000;
  var SPORTS_BOARD_HOLD_MAX_MS = 12000;
  var SPORTS_MIN_SLOT_PX = 240;
  var SPORTS_GAP_PX = 6;

  function sportsBoardCountFromWidth(avail, options) {
    options = options || {};
    if (options.desktop === false) return 1;
    var minSlot = options.minSlot || SPORTS_MIN_SLOT_PX;
    var gap = options.gap == null ? SPORTS_GAP_PX : options.gap;
    var width = Math.max(0, avail | 0);
    var maxN = 4;
    if (width >= 1700) maxN = 7;
    else if (width >= 1400) maxN = 6;
    else if (width >= 1100) maxN = 5;
    else if (width >= 720) maxN = 4;
    else return 1;
    if (options.maxN) maxN = Math.min(maxN, options.maxN);
    var n = 1;
    for (var tryN = maxN; tryN >= 2; tryN -= 1) {
      if (width >= tryN * minSlot + gap * (tryN - 1)) {
        n = tryN;
        break;
      }
    }
    return Math.max(1, n);
  }

  function isLive(item) {
    return !!(item && (item.live || item.mode === 'live'));
  }
  function isResult(item) {
    return !!(item && item.mode === 'result' && !isLive(item));
  }
  function isNext(item) {
    return !!(item && !isResult(item) && !isLive(item));
  }

  function takeUnused(list, count, used) {
    var out = [];
    if (!list || count <= 0) return out;
    for (var i = 0; i < list.length && out.length < count; i += 1) {
      var item = list[i];
      var key = item && (item.key || item.id);
      if (!item || (key && used.has(key))) continue;
      if (key) used.add(key);
      out.push(item);
    }
    return out;
  }

  /**
   * n cartes parmi le bassin : directs prioritaires mais non exclusifs
   * (au moins une autre rencontre s’il en existe), pas de case vide,
   * tout le bassin reste joignable au fil des rotations.
   */
  function sportsSplitVisible(items, n, now) {
    void now;
    var pool = Array.isArray(items) ? items.filter(Boolean) : [];
    var count = Math.max(1, n | 0);
    if (!pool.length) return [];
    if (count < 2) return pool.slice(0, 1);
    count = Math.min(count, pool.length);
    var used = new Set();
    var lives = pool.filter(isLive);
    var results = pool.filter(isResult);
    var nexts = pool.filter(isNext);
    var hasOthers = results.length + nexts.length > 0;
    var liveQuota = hasOthers && count > 1 ? count - 1 : count;
    var livePicked = takeUnused(lives, liveQuota, used);
    var remaining = count - livePicked.length;
    var nPast = 0;
    var nFuture = 0;
    if (!results.length) nFuture = remaining;
    else if (!nexts.length) nPast = remaining;
    else if (remaining % 2 === 0) {
      nPast = remaining / 2;
      nFuture = remaining / 2;
    } else {
      nPast = Math.ceil(remaining / 2);
      nFuture = remaining - nPast;
    }
    var left = takeUnused(results, nPast, used);
    var right = takeUnused(nexts, nFuture, used);
    if (nPast - left.length > 0) right = right.concat(takeUnused(nexts, nPast - left.length, used));
    if (nFuture - right.length > 0) left = left.concat(takeUnused(results, nFuture - right.length, used));
    var out = left.concat(livePicked, right);
    if (out.length < count) out = out.concat(takeUnused(pool, count - out.length, used));
    return out.slice(0, count);
  }

  /**
   * Prochaine carte pour un slot : première du bassin non affichée,
   * en évitant le sport des voisines si possible. Parcourt tout le bassin.
   */
  function sportsNextForSlot(pool, visible, slot, cursor) {
    var n = visible.length;
    var used = new Set();
    for (var i = 0; i < n; i += 1) {
      if (i === slot) continue;
      if (visible[i] && visible[i].key) used.add(visible[i].key);
    }
    var usedSports = new Set();
    for (i = 0; i < n; i += 1) {
      if (i === slot) continue;
      var sport = visible[i] && visible[i].sport;
      if (sport) usedSports.add(String(sport).toLowerCase());
    }
    var start = ((cursor | 0) % Math.max(1, pool.length) + pool.length) % Math.max(1, pool.length);
    var ordered = pool.slice(start).concat(pool.slice(0, start));
    var prefer = null;
    var fallback = null;
    for (i = 0; i < ordered.length; i += 1) {
      var item = ordered[i];
      if (!item || used.has(item.key)) continue;
      if (!fallback) fallback = item;
      var key = String(item.sport || '').toLowerCase();
      if (!key || !usedSports.has(key)) { prefer = item; break; }
    }
    return prefer || fallback || visible[slot] || null;
  }

  function sportsWaveSchedule(n, options) {
    options = options || {};
    var stepMs = options.stepMs == null ? SPORTS_CASCADE_STEP_MS : options.stepMs;
    var holdMs = options.holdMs == null ? SPORTS_BOARD_HOLD_MIN_MS : options.holdMs;
    var firstWait = options.firstWait !== false;
    var fromSlot = options.fromSlot | 0;
    var count = Math.max(0, n | 0);
    var events = [];
    var t = firstWait ? holdMs : 0;
    for (var i = 0; i < count; i += 1) {
      events.push({ slot: (fromSlot + i) % count, at: t });
      t += stepMs;
    }
    return events;
  }

  function sportsWaveStaggered(events) {
    if (!events || events.length < 2) return true;
    for (var i = 1; i < events.length; i += 1) {
      if (events[i].at <= events[i - 1].at) return false;
    }
    return true;
  }

  return {
    SPORTS_CASCADE_STEP_MS: SPORTS_CASCADE_STEP_MS,
    SPORTS_BOARD_HOLD_MIN_MS: SPORTS_BOARD_HOLD_MIN_MS,
    SPORTS_BOARD_HOLD_MAX_MS: SPORTS_BOARD_HOLD_MAX_MS,
    SPORTS_MIN_SLOT_PX: SPORTS_MIN_SLOT_PX,
    SPORTS_GAP_PX: SPORTS_GAP_PX,
    sportsBoardCountFromWidth: sportsBoardCountFromWidth,
    sportsSplitVisible: sportsSplitVisible,
    sportsNextForSlot: sportsNextForSlot,
    sportsWaveSchedule: sportsWaveSchedule,
    sportsWaveStaggered: sportsWaveStaggered,
  };
});
