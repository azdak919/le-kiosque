/**
 * Fraîcheur scores (focus-group B) — miroir de src/sports-freshness.ts pour la démo navigateur.
 */

function parseGameDay(gameOrDate) {
  const raw = typeof gameOrDate === 'string' ? gameOrDate : gameOrDate?.date || '';
  const day = String(raw).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const t = Date.parse(`${day}T12:00:00`);
  return Number.isFinite(t) ? new Date(t) : null;
}

function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentUniversitySessionStart(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  if (month >= 8) return new Date(year, 8, 1);
  if (month >= 4) return new Date(year, 4, 1);
  return new Date(year, 0, 1);
}

function getPriorUniversitySessionStart(sessionStart) {
  const year = sessionStart.getFullYear();
  const month = sessionStart.getMonth();
  if (month === 8) return new Date(year, 4, 1);
  if (month === 4) return new Date(year, 0, 1);
  return new Date(year - 1, 8, 1);
}

function getNextUniversitySessionStart(sessionStart) {
  const year = sessionStart.getFullYear();
  const month = sessionStart.getMonth();
  if (month === 0) return new Date(year, 4, 1);
  if (month === 4) return new Date(year, 8, 1);
  return new Date(year + 1, 0, 1);
}

function freshnessMaxSessionsBack(referenceDate = new Date()) {
  return referenceDate.getMonth() === 8 ? 3 : 2;
}

function getUniversitySessionStart(referenceDate = new Date(), sessionsBack = 0) {
  let start = getCurrentUniversitySessionStart(referenceDate);
  for (let i = 0; i < sessionsBack; i += 1) start = getPriorUniversitySessionStart(start);
  return start;
}

function getUniversitySessionBand(referenceDate = new Date(), sessionsBack = 0) {
  const start = getUniversitySessionStart(referenceDate, sessionsBack);
  const end = sessionsBack === 0
    ? referenceDate
    : new Date(getUniversitySessionStart(referenceDate, sessionsBack - 1).getTime() - 1);
  return { start, end };
}

export function isWithinFreshnessWindow(item, referenceDate = new Date()) {
  const published = parseGameDay(item);
  if (!published) return false;
  if (published.getTime() > referenceDate.getTime()) return false;
  const maxBack = freshnessMaxSessionsBack(referenceDate);
  const t = published.getTime();
  for (let band = 0; band <= maxBack; band += 1) {
    const { start, end } = getUniversitySessionBand(referenceDate, band);
    if (t >= start.getTime() && t <= end.getTime()) return true;
  }
  return false;
}

export function nextGameHorizonEnd(referenceDate = new Date()) {
  const currentStart = getCurrentUniversitySessionStart(referenceDate);
  const nextStart = getNextUniversitySessionStart(currentStart);
  const afterNext = getNextUniversitySessionStart(nextStart);
  return new Date(afterNext.getTime() - 1);
}

function isPastGameKeepable(game, referenceDate) {
  const d = parseGameDay(game);
  if (!d) return false;
  return d.getTime() <= referenceDate.getTime();
}

export function isNextGameInHorizon(game, referenceDate = new Date()) {
  const d = parseGameDay(game);
  if (!d) return false;
  if (dayKey(d) < dayKey(referenceDate)) return false;
  return d.getTime() <= nextGameHorizonEnd(referenceDate).getTime();
}

export function prunePastGames(games = [], referenceDate = new Date()) {
  const list = (Array.isArray(games) ? games : [])
    .filter((g) => isPastGameKeepable(g, referenceDate))
    .slice()
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const fresh = list.filter((g) => isWithinFreshnessWindow(g, referenceDate));
  if (fresh.length) {
    return { games: fresh.map((g) => ({ ...g, priorSeason: false })), priorSeason: false };
  }
  if (list.length) {
    return { games: [{ ...list[0], priorSeason: true }], priorSeason: true };
  }
  return { games: [], priorSeason: false };
}

export function pruneNextGame(game, referenceDate = new Date()) {
  if (!game) return null;
  if (game.live === true) {
    const d = parseGameDay(game);
    if (!d) return null;
    const refKey = dayKey(referenceDate);
    const gameKey = dayKey(d);
    // Un direct peut avoir commencé la veille (chargement juste après minuit).
    if (gameKey === refKey || gameKey === shiftIsoDate(refKey, -1)) return { ...game };
    return null;
  }
  return isNextGameInHorizon(game, referenceDate) ? { ...game } : null;
}

export function pruneSportsTeam(team, referenceDate = new Date()) {
  const out = { ...team };
  if (Array.isArray(team.results)) {
    out.results = prunePastGames(team.results, referenceDate).games;
  }
  if (team.lastGame) {
    const pruned = prunePastGames([team.lastGame], referenceDate);
    out.lastGame = pruned.games[0] || null;
    if (out.lastGame) out.lastGamePriorSeason = !!out.lastGame.priorSeason;
    else delete out.lastGamePriorSeason;
  }
  if (team.nextGame) out.nextGame = pruneNextGame(team.nextGame, referenceDate);
  if (Array.isArray(team.nextGames)) {
    out.nextGames = team.nextGames
      .filter((g) => isNextGameInHorizon(g, referenceDate))
      .slice()
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  }
  return out;
}

export function resolveSportsReferenceDate(opts = {}) {
  if (opts.demoAsOf) {
    const d = parseGameDay(opts.demoAsOf) || new Date(opts.demoAsOf);
    if (d && Number.isFinite(d.getTime())) return d;
  }
  if (opts.referenceDate instanceof Date && Number.isFinite(opts.referenceDate.getTime())) {
    return opts.referenceDate;
  }
  if (opts.referenceDate) {
    const d = new Date(opts.referenceDate);
    if (Number.isFinite(d.getTime())) return d;
  }
  return new Date();
}

/** Décale une date ISO AAAA-MM-JJ de `deltaDays` (calendaire, midi local). */
export function shiftIsoDate(iso, deltaDays) {
  const d = parseGameDay(iso);
  if (!d || !Number.isFinite(deltaDays) || deltaDays === 0) {
    const raw = typeof iso === 'string' ? iso.slice(0, 10) : '';
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : iso;
  }
  d.setDate(d.getDate() + deltaDays);
  return dayKey(d);
}

function shiftGameDates(game, deltaDays) {
  if (!game || typeof game !== 'object') return game;
  if (!game.date) return { ...game };
  return { ...game, date: shiftIsoDate(game.date, deltaDays) };
}

/**
 * Décale toutes les dates de matchs d’un payload (équipes + listes globales).
 * Les écarts relatifs (résultats ↔ prochains) restent identiques.
 */
export function shiftSportsPayloadDates(payload, deltaDays) {
  if (!payload || !Number.isFinite(deltaDays) || deltaDays === 0) return payload;
  const out = { ...payload };
  if (Array.isArray(payload.teams)) {
    out.teams = payload.teams.map((team) => {
      if (!team || typeof team !== 'object') return team;
      const t = { ...team };
      if (Array.isArray(team.results)) {
        t.results = team.results.map((g) => shiftGameDates(g, deltaDays));
      }
      if (team.lastGame) t.lastGame = shiftGameDates(team.lastGame, deltaDays);
      if (team.nextGame) t.nextGame = shiftGameDates(team.nextGame, deltaDays);
      if (Array.isArray(team.nextGames)) {
        t.nextGames = team.nextGames.map((g) => shiftGameDates(g, deltaDays));
      }
      return t;
    });
  }
  if (Array.isArray(payload.results)) {
    out.results = payload.results.map((g) => shiftGameDates(g, deltaDays));
  }
  if (payload.lastGame) out.lastGame = shiftGameDates(payload.lastGame, deltaDays);
  if (payload.nextGame) out.nextGame = shiftGameDates(payload.nextGame, deltaDays);
  if (Array.isArray(payload.nextGames)) {
    out.nextGames = payload.nextGames.map((g) => shiftGameDates(g, deltaDays));
  }
  if (payload.demoAsOf) out.demoAsOf = shiftIsoDate(payload.demoAsOf, deltaDays);
  return out;
}

/** Minutes locales depuis minuit — même horloge que le mât (fuseau du navigateur). */
function localClockMinutes(now) {
  return now.getHours() * 60 + now.getMinutes();
}

function minutesToHm(total) {
  const mins = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Coup d’envoi d’un match en cours : quart d’heure précédent, moins 30 min.
 * Toujours commencé, toujours depuis moins de 90 minutes, quelle que soit l’heure.
 */
function demoLiveKickoff(now) {
  const nowMin = localClockMinutes(now);
  const quarter = Math.floor(nowMin / 15) * 15;
  let minutes = quarter - 30;
  let date = dayKey(now);
  if (minutes < 0) {
    minutes += 1440;
    date = shiftIsoDate(date, -1);
  }
  return { date, minutes, time: minutesToHm(minutes) };
}

/** Match déjà joué : l’heure reste plausible et la partie est finie avant le direct. */
function asFinishedBefore(game, kick) {
  const day = String(game.date || '').slice(0, 10);
  const mins = parseSportsTimeMinutes(game.time);
  let date = day || kick.date;
  let minutes = Number.isFinite(mins) ? mins : kick.minutes - 120;
  const sameOrLiveDay = date === kick.date;
  if (sameOrLiveDay && kick.minutes - minutes < 90) {
    minutes = kick.minutes - 120;
    if (minutes < 0) {
      minutes += 1440;
      date = shiftIsoDate(kick.date, -1);
    }
  }
  const kept = date === day && Number.isFinite(mins) && minutes === mins;
  const finished = { ...game, date, time: kept ? String(game.time) : minutesToHm(minutes) };
  delete finished.live;
  if (!finished.result) {
    finished.result = 'D';
    finished.scoreFor = finished.scoreFor ?? 1;
    finished.scoreAgainst = finished.scoreAgainst ?? 1;
  }
  return finished;
}

/** Plus tard que le direct : reste à venir, et après l’heure affichée. */
function asUpcomingAfter(game, kick, now) {
  const nowMin = localClockMinutes(now);
  const today = dayKey(now);
  let date = String(game.date || '').slice(0, 10) || today;
  let minutes = parseSportsTimeMinutes(game.time);
  if (!Number.isFinite(minutes)) minutes = nowMin + 60;
  const stillAhead = date > today || (date === today && minutes > nowMin);
  if (!stillAhead) {
    let future = Math.ceil((nowMin + 1) / 15) * 15;
    date = today;
    if (future >= 1440) {
      future -= 1440;
      date = shiftIsoDate(today, 1);
    }
    minutes = future;
  }
  const upcoming = { ...game, date, time: stillAhead ? String(game.time) : minutesToHm(minutes) };
  delete upcoming.live;
  return upcoming;
}

/**
 * Le direct de la démo a commencé récemment. Les autres rencontres du même
 * jour ne le repoussent pas : plus tôt, elles sont terminées avant ; plus
 * tard, elles restent à venir après.
 */
function scheduleDemoLiveKickoffs(payload, now) {
  if (!payload) return payload;
  const kick = demoLiveKickoff(now);
  const place = (game) => {
    if (!game || typeof game !== 'object') return { role: 'keep', game };
    if (game.live === true) {
      return { role: 'live', game: { ...game, date: kick.date, time: kick.time } };
    }
    const day = String(game.date || '').slice(0, 10);
    if (day !== kick.date && day !== dayKey(now)) return { role: 'keep', game };
    const mins = parseSportsTimeMinutes(game.time);
    const earlier = !Number.isFinite(mins)
      || (day === kick.date && mins <= kick.minutes)
      || day < kick.date;
    return earlier
      ? { role: 'finished', game: asFinishedBefore(game, kick) }
      : { role: 'upcoming', game: asUpcomingAfter(game, kick, now) };
  };
  const out = { ...payload };
  if (Array.isArray(payload.teams)) {
    out.teams = payload.teams.map((team) => {
      if (!team || typeof team !== 'object') return team;
      const t = { ...team };
      const results = Array.isArray(t.results) ? t.results.slice() : [];
      if (t.nextGame) {
        const placed = place(t.nextGame);
        if (placed.role === 'finished') {
          results.unshift(placed.game);
          t.nextGame = null;
        } else t.nextGame = placed.game;
      }
      if (Array.isArray(t.nextGames)) {
        const upcoming = [];
        for (const game of t.nextGames) {
          const placed = place(game);
          if (placed.role === 'finished') results.unshift(placed.game);
          else upcoming.push(placed.game);
        }
        t.nextGames = upcoming;
      }
      t.results = results;
      return t;
    });
  }
  if (out.nextGame) {
    const placed = place(out.nextGame);
    out.nextGame = placed.role === 'finished' ? null : placed.game;
  }
  if (Array.isArray(out.nextGames)) {
    out.nextGames = out.nextGames.flatMap((game) => {
      const placed = place(game);
      return placed.role === 'finished' ? [] : [placed.game];
    });
  }
  return out;
}

/**
 * Démo « live » : ancre `demoAsOf` (fixtures inventées) → jour courant.
 * Ex. fixtures rédigées autour du 2026-09-20 restent « aujourd’hui / hier /
 * demain » quel que soit le jour de consultation. L’heure d’un match en
 * cours est recalculée à ce moment-là, pas figée dans le YAML.
 */
export function alignDemoSportsToToday(payload, now = new Date()) {
  if (!payload || payload.demoLive !== true) return payload;
  const instant = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();
  const anchor = parseGameDay(payload.demoAsOf);
  if (!anchor) return payload;
  const todayKey = dayKey(instant);
  const anchorKey = dayKey(anchor);
  let aligned;
  if (anchorKey === todayKey) {
    aligned = { ...payload, demoAsOf: todayKey };
  } else {
    const anchorNoon = parseGameDay(anchorKey);
    const todayNoon = parseGameDay(todayKey);
    if (!anchorNoon || !todayNoon) return payload;
    const deltaDays = Math.round((todayNoon.getTime() - anchorNoon.getTime()) / 86_400_000);
    aligned = { ...shiftSportsPayloadDates(payload, deltaDays), demoAsOf: todayKey, demoLive: true };
  }
  return scheduleDemoLiveKickoffs(aligned, instant);
}

export function pruneSportsPayload(payload, opts = {}) {
  const live = opts.demoLive ?? payload?.demoLive;
  const nowForLive = opts.referenceDate instanceof Date && Number.isFinite(opts.referenceDate.getTime())
    ? opts.referenceDate
    : (opts.referenceDate ? new Date(opts.referenceDate) : new Date());
  const aligned = live === true
    ? alignDemoSportsToToday(payload, nowForLive)
    : payload;
  // demoLive : après alignement, demoAsOf = jour cible (ne pas réinjecter l’ancre YAML).
  // Sinon : demoAsOf figé (snapshot) ou referenceDate / now.
  const ref = resolveSportsReferenceDate({
    demoAsOf: live === true ? aligned.demoAsOf : (opts.demoAsOf ?? aligned?.demoAsOf),
    referenceDate: live === true ? undefined : opts.referenceDate,
  });
  const out = { ...aligned };
  if (Array.isArray(aligned.teams)) {
    out.teams = aligned.teams.map((t) => pruneSportsTeam(t, ref));
  }
  if (Array.isArray(aligned.results)) {
    out.results = prunePastGames(aligned.results, ref).games;
  }
  if (aligned.nextGame) out.nextGame = pruneNextGame(aligned.nextGame, ref);
  if (Array.isArray(aligned.nextGames)) {
    out.nextGames = aligned.nextGames.filter((g) => isNextGameInHorizon(g, ref));
  }
  if (aligned.demoAsOf) out.demoAsOf = aligned.demoAsOf;
  if (aligned.demoLive != null) out.demoLive = aligned.demoLive;
  return out;
}

/**
 * Libellés de genre, repris de LE-RADAR (`genderMark` dans
 * scripts/magazine-front-page-lib.js) : « (F) » / « (H) » d’après la donnée ;
 * inconnu ou mixte : rien. Jamais deviné.
 */
export function sportsSexKey(sex) {
  const s = String(sex || '').trim().toLowerCase();
  if (['f', 'w', 'women', 'woman', 'femmes', 'féminin', 'feminin', 'female'].includes(s)) return 'F';
  if (['m', 'h', 'men', 'man', 'hommes', 'masculin', 'male'].includes(s)) return 'M';
  if (['x', 'mixte', 'mixed', 'coed', 'co-ed', 'open', 'ouvert'].includes(s)) return 'X';
  return '';
}

export function genderMark(sex) {
  const key = sportsSexKey(sex);
  if (key === 'F') return '(F)';
  if (key === 'M') return '(H)';
  return '';
}

/** Libellés écrits au long pour la page « Au tableau ». */
export function sportsSexLabel(sex) {
  const key = sportsSexKey(sex);
  if (key === 'F') return 'Féminin';
  if (key === 'M') return 'Masculin';
  if (key === 'X') return 'Ouvert / mixte';
  return '';
}

/** Minutes depuis minuit pour un tri numérique (9:00 avant 19:00). */
export function parseSportsTimeMinutes(time) {
  const raw = String(time || '').trim();
  const m = raw.match(/^(\d{1,2})\s*[:hH.]\s*(\d{2})/);
  if (!m) return Number.POSITIVE_INFINITY;
  const hours = Number(m[1]);
  const mins = Number(m[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(mins) || hours > 23 || mins > 59) {
    return Number.POSITIVE_INFINITY;
  }
  return hours * 60 + mins;
}

export function officialSportsUrl(url) {
  const raw = String(url || '').trim();
  if (!/^https?:\/\//i.test(raw)) return '';
  try { return new URL(raw).href; } catch { return ''; }
}

/**
 * « Aujourd’hui », « Demain », « Hier », sinon vide (le format long reste
 * à l’appelant). `iso` = AAAA-MM-JJ, `timeZone` IANA.
 */
export function sportsRelativeDayLabel(iso, timeZone, now = new Date()) {
  const day = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    const todayKey = y && m && d ? `${y}-${m}-${d}` : '';
    if (!todayKey) return '';
    if (day === todayKey) return 'Aujourd’hui';
    const shift = (delta) => {
      const noon = new Date(`${todayKey}T12:00:00`);
      noon.setDate(noon.getDate() + delta);
      const yy = noon.getFullYear();
      const mm = String(noon.getMonth() + 1).padStart(2, '0');
      const dd = String(noon.getDate()).padStart(2, '0');
      return `${yy}-${mm}-${dd}`;
    };
    if (day === shift(1)) return 'Demain';
    if (day === shift(-1)) return 'Hier';
    return '';
  } catch {
    return '';
  }
}
