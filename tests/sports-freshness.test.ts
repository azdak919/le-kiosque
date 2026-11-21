import assert from 'node:assert/strict';
import test from 'node:test';
import {
  alignDemoSportsToToday,
  genderMark,
  isNextGameInHorizon,
  isWithinFreshnessWindow,
  officialSportsUrl,
  parseSportsTimeMinutes,
  prunePastGames,
  pruneSportsPayload,
  pruneSportsTeam,
  resolveSportsReferenceDate,
  shiftIsoDate,
  shiftSportsPayloadDates,
  sportsRelativeDayLabel,
  sportsSexLabel,
} from '../packages/theme-radar/src/sports-freshness.js';

const REF = new Date('2026-07-30T15:00:00');

test('fenêtre sessions : été 2026 inclut hiver et automne 2025', () => {
  assert.equal(isWithinFreshnessWindow({ date: '2026-06-01' }, REF), true);
  assert.equal(isWithinFreshnessWindow({ date: '2026-04-25' }, REF), true);
  assert.equal(isWithinFreshnessWindow({ date: '2025-10-01' }, REF), true);
  assert.equal(isWithinFreshnessWindow({ date: '2024-10-01' }, REF), false);
});

test('hors fenêtre : au plus 1 lastGame priorSeason', () => {
  const { games, priorSeason } = prunePastGames(
    [
      { date: '2024-10-01', result: 'W' },
      { date: '2023-01-01', result: 'L' },
    ],
    REF,
  );
  assert.equal(priorSeason, true);
  assert.equal(games.length, 1);
  assert.equal(games[0].date, '2024-10-01');
  assert.equal(games[0].priorSeason, true);
});

test('nextGame : session + 1 suivante, pas le passé', () => {
  assert.equal(isNextGameInHorizon({ date: '2026-08-20' }, REF), true);
  assert.equal(isNextGameInHorizon({ date: '2026-11-15' }, REF), true);
  assert.equal(isNextGameInHorizon({ date: '2027-02-01' }, REF), false);
  assert.equal(isNextGameInHorizon({ date: '2026-07-01' }, REF), false);
});

test('demoAsOf ancre le prune (fixtures sept visibles en build juillet)', () => {
  const payload = {
    demoAsOf: '2026-09-20',
    teams: [
      {
        id: 't1',
        results: [
          { date: '2026-09-18', result: 'W', scoreFor: 3, scoreAgainst: 1, opponent: 'X' },
          { date: '2026-09-11', result: 'L', scoreFor: 1, scoreAgainst: 3, opponent: 'Y' },
        ],
        nextGame: { date: '2026-10-02', opponent: 'Z' },
      },
    ],
  };
  // sans demoAsOf, réf. = juillet : results futurs (sept) hors « passés »
  const noDemo = pruneSportsPayload(
    { ...payload, demoAsOf: undefined },
    { referenceDate: REF },
  );
  assert.equal((noDemo.teams?.[0].results || []).length, 0, 'sans demoAsOf, fixtures futures hors past');

  const withDemo = pruneSportsPayload(payload, { demoAsOf: '2026-09-20' });
  assert.equal((withDemo.teams?.[0].results || []).length, 2);
  assert.ok(withDemo.teams?.[0].nextGame);
  assert.equal(withDemo.teams?.[0].nextGame?.date, '2026-10-02');
});

test('resolveSportsReferenceDate préfère demoAsOf', () => {
  const d = resolveSportsReferenceDate({ demoAsOf: '2026-09-20' });
  assert.equal(d.toISOString().slice(0, 10), '2026-09-20');
});

test('shiftIsoDate décale le calendaire', () => {
  assert.equal(shiftIsoDate('2026-09-20', 0), '2026-09-20');
  assert.equal(shiftIsoDate('2026-09-20', 10), '2026-09-30');
  assert.equal(shiftIsoDate('2026-09-20', -5), '2026-09-15');
});

test('demoLive aligne les fixtures sur le jour courant', () => {
  const payload = {
    demoAsOf: '2026-09-20',
    demoLive: true,
    teams: [
      {
        id: 't1',
        results: [
          { date: '2026-09-18', result: 'W', scoreFor: 3, scoreAgainst: 1, opponent: 'X' },
          { date: '2026-09-20', result: 'W', scoreFor: 2, scoreAgainst: 0, opponent: 'Y' },
        ],
        nextGame: { date: '2026-09-20', time: '19:00', opponent: 'Z' },
      },
      {
        id: 't2',
        results: [{ date: '2026-09-11', result: 'L', scoreFor: 0, scoreAgainst: 1, opponent: 'A' }],
        nextGame: { date: '2026-10-05', opponent: 'B' },
      },
    ],
  };
  const now = new Date('2026-07-30T15:00:00');
  const aligned = alignDemoSportsToToday(payload, now);
  assert.equal(aligned.demoAsOf, '2026-07-30');
  assert.equal(aligned.teams[0].nextGame.date, '2026-07-30', 'match du jour');
  assert.equal(aligned.teams[0].results[1].date, '2026-07-30', 'score du jour');
  assert.equal(aligned.teams[0].results[0].date, '2026-07-28', 'écart relatif conservé');
  assert.equal(aligned.teams[1].nextGame.date, '2026-08-14');

  const pruned = pruneSportsPayload(payload, { demoLive: true, referenceDate: now });
  assert.equal(pruned.demoAsOf, '2026-07-30');
  assert.ok(pruned.teams[0].nextGame, 'nextGame du jour conservé');
  assert.equal(pruned.teams[0].nextGame.date, '2026-07-30');
  assert.equal(pruned.teams[0].results.length, 2, 'scores passés (dont jour J) visibles');
  assert.ok(pruned.teams[1].nextGame, 'prochain futur dans l’horizon');
});

test('démo : un match en cours a commencé depuis moins de 90 minutes', () => {
  const payload = () => ({
    demoAsOf: '2026-09-20',
    demoLive: true,
    teams: [
      { id: 'hockey', results: [], nextGame: { date: '2026-09-20', time: '20:00', live: true, opponent: 'Géants' } },
      { id: 'soccer', results: [], nextGame: { date: '2026-09-20', time: '9:00', opponent: 'Barons' } },
      { id: 'volley', results: [], nextGame: { date: '2026-09-20', time: '19:00', opponent: 'Géants' } },
    ],
  });
  const ago = (game, now) => {
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const kick = parseSportsTimeMinutes(game?.time);
    if (game?.date === today) return nowMin - kick;
    if (game?.date === yesterday) return nowMin + 1440 - kick;
    return Number.POSITIVE_INFINITY;
  };
  const checkLive = (now) => {
    const aligned = alignDemoSportsToToday(payload(), now);
    const live = aligned.teams?.[0].nextGame;
    assert.equal(live?.live, true);
    const started = ago(live, now);
    assert.ok(started > 0 && started < 90, `${now.toTimeString().slice(0, 5)} : commencé depuis ${started} min`);
    return aligned;
  };

  const afternoon = checkLive(new Date('2026-11-21T16:57:00'));
  assert.equal(afternoon.teams?.[0].nextGame?.time, '16:15');
  assert.equal(afternoon.teams?.[1].nextGame, null, 'le soccer de 9 h est terminé');
  assert.equal(afternoon.teams?.[1].results?.[0]?.time, '9:00');
  assert.ok(parseSportsTimeMinutes(afternoon.teams?.[1].results?.[0]?.time) < parseSportsTimeMinutes('16:15'));
  assert.equal(afternoon.teams?.[2].nextGame?.time, '19:00', '19 h reste à venir');

  const morning = checkLive(new Date('2026-11-21T06:10:00'));
  assert.equal(morning.teams?.[0].nextGame?.time, '05:30');
  assert.equal(morning.teams?.[1].nextGame?.time, '9:00', '9 h est encore à venir le matin');
  assert.equal(morning.teams?.[2].nextGame?.time, '19:00');

  const late = checkLive(new Date('2026-11-21T23:50:00'));
  assert.equal(late.teams?.[0].nextGame?.time, '23:15');
  assert.equal(late.teams?.[1].nextGame, null);
  assert.equal(late.teams?.[2].nextGame, null, '19 h est passé : terminé avant le direct');

  const afterMidnight = checkLive(new Date('2026-11-22T00:10:00'));
  assert.equal(afterMidnight.teams?.[0].nextGame?.time, '23:30');
  assert.notEqual(afterMidnight.teams?.[0].nextGame?.date, '2026-11-22');
  assert.equal(afterMidnight.teams?.[1].nextGame?.time, '9:00', 'le lendemain matin, 9 h est à venir');
  assert.equal(afterMidnight.teams?.[2].nextGame?.time, '19:00');
  const kept = pruneSportsPayload(payload(), { demoLive: true, referenceDate: new Date('2026-11-22T00:10:00') });
  assert.equal(kept.teams?.[0].nextGame?.live, true, 'le direct de la veille n’est pas élagué');
  assert.equal(kept.teams?.[0].nextGame?.time, '23:30');
});

test('sans demoLive, les dates YAML restent figées', () => {
  const payload = {
    demoAsOf: '2026-09-20',
    teams: [{ id: 't1', nextGame: { date: '2026-10-02', opponent: 'Z' } }],
  };
  const shifted = shiftSportsPayloadDates(payload, 5);
  assert.equal(shifted.teams[0].nextGame.date, '2026-10-07');
  const frozen = pruneSportsPayload(payload, { demoAsOf: '2026-09-20' });
  assert.equal(frozen.teams[0].nextGame.date, '2026-10-02');
});

test('genderMark : (F) / (H), rien si mixte ou vide', () => {
  assert.equal(genderMark('F'), '(F)');
  assert.equal(genderMark('féminin'), '(F)');
  assert.equal(genderMark('M'), '(H)');
  assert.equal(genderMark('masculin'), '(H)');
  assert.equal(genderMark('mixte'), '');
  assert.equal(genderMark('X'), '');
  assert.equal(genderMark(''), '');
});

test('sportsSexLabel : libellés longs pour Au tableau', () => {
  assert.equal(sportsSexLabel('F'), 'Féminin');
  assert.equal(sportsSexLabel('H'), 'Masculin');
  assert.equal(sportsSexLabel('mixte'), 'Ouvert / mixte');
  assert.equal(sportsSexLabel(''), '');
});

test('parseSportsTimeMinutes trie 9:00 avant 19:00', () => {
  assert.ok(parseSportsTimeMinutes('9:00') < parseSportsTimeMinutes('19:00'));
  assert.ok(parseSportsTimeMinutes('09:00') < parseSportsTimeMinutes('19:00'));
  assert.equal(parseSportsTimeMinutes('9:00'), parseSportsTimeMinutes('09h00'));
  assert.equal(parseSportsTimeMinutes(''), Number.POSITIVE_INFINITY);
});

test('officialSportsUrl n’accepte que http(s)', () => {
  assert.equal(officialSportsUrl('https://rseq.ca/'), 'https://rseq.ca/');
  assert.equal(officialSportsUrl('http://example.org/scores'), 'http://example.org/scores');
  assert.equal(officialSportsUrl('javascript:alert(1)'), '');
  assert.equal(officialSportsUrl('/relatif'), '');
  assert.equal(officialSportsUrl(''), '');
});

test('sportsRelativeDayLabel : Aujourd’hui / Demain / Hier', () => {
  const now = new Date('2026-09-20T15:00:00-04:00');
  const tz = 'America/Toronto';
  assert.equal(sportsRelativeDayLabel('2026-09-20', tz, now), 'Aujourd’hui');
  assert.equal(sportsRelativeDayLabel('2026-09-21', tz, now), 'Demain');
  assert.equal(sportsRelativeDayLabel('2026-09-19', tz, now), 'Hier');
  assert.equal(sportsRelativeDayLabel('2026-09-10', tz, now), '');
});

test('prune et décalage conservent officialUrl et live', () => {
  const payload = {
    demoAsOf: '2026-09-20',
    teams: [
      {
        id: 't1',
        officialUrl: 'https://rseq.ca/',
        results: [{ date: '2026-09-18', result: 'W', scoreFor: 3, scoreAgainst: 1, opponent: 'X' }],
        nextGame: { date: '2026-09-20', time: '20:00', live: true, opponent: 'Z' },
      },
    ],
  };
  const pruned = pruneSportsPayload(payload, { demoAsOf: '2026-09-20' });
  assert.equal(pruned.teams?.[0].officialUrl, 'https://rseq.ca/');
  assert.equal(pruned.teams?.[0].nextGame?.live, true);
  const shifted = shiftSportsPayloadDates(pruned, 2);
  assert.equal(shifted.teams?.[0].officialUrl, 'https://rseq.ca/');
  assert.equal(shifted.teams?.[0].nextGame?.live, true);
  assert.equal(shifted.teams?.[0].nextGame?.date, '2026-09-22');
});
