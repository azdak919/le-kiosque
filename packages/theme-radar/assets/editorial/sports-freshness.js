/**
 * Fraîcheur scores (focus-group B) — miroir de src/sports-freshness.ts pour la démo PGlite.
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

export function pruneSportsPayload(payload, opts = {}) {
  const ref = resolveSportsReferenceDate({
    demoAsOf: opts.demoAsOf ?? payload.demoAsOf,
    referenceDate: opts.referenceDate,
  });
  const out = { ...payload };
  if (Array.isArray(payload.teams)) {
    out.teams = payload.teams.map((t) => pruneSportsTeam(t, ref));
  }
  if (Array.isArray(payload.results)) {
    out.results = prunePastGames(payload.results, ref).games;
  }
  if (payload.nextGame) out.nextGame = pruneNextGame(payload.nextGame, ref);
  if (Array.isArray(payload.nextGames)) {
    out.nextGames = payload.nextGames.filter((g) => isNextGameInHorizon(g, ref));
  }
  return out;
}
