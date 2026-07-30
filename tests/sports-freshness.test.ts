import assert from 'node:assert/strict';
import test from 'node:test';
import {
  alignDemoSportsToToday,
  isNextGameInHorizon,
  isWithinFreshnessWindow,
  prunePastGames,
  pruneSportsPayload,
  pruneSportsTeam,
  resolveSportsReferenceDate,
  shiftIsoDate,
  shiftSportsPayloadDates,
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
