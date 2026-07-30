import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isNextGameInHorizon,
  isWithinFreshnessWindow,
  prunePastGames,
  pruneSportsPayload,
  pruneSportsTeam,
  resolveSportsReferenceDate,
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
