/**
 * Integration tests for reading a placement's policy score from the stored results (D-104's amendment of 2026-11-04):
 * the best result and all those with the latest timestamp give every policy the same score as all the learner's
 * results, and only the learner's gradable root results of the placement's activity and course count.
 *
 * Spec: LTI-012
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { policyScore, type AttemptPolicySetting } from '../../src/grades/attemptPolicyScore.js';
import { policyResultScores, scoreGivenOf } from '../../src/grades/storedResultScores.js';
import { platformContextKey } from '../../src/xapi/platformContextKey.js';
import { describeWithServices, uniqueName } from '../support/services.js';
import { openGradeDbFixture, VIEW_ID, type GradeDbFixture } from './support/gradeDbFixture.js';
import { storeGradableResult } from './support/storedResult.js';

const SETTINGS: readonly AttemptPolicySetting[] = [
  { attemptPolicy: 'best', masteryThreshold: null },
  { attemptPolicy: 'latest', masteryThreshold: null },
  { attemptPolicy: 'mastery', masteryThreshold: null },
  { attemptPolicy: 'mastery', masteryThreshold: 0.95 },
];

/** A seeded generator of numbers in [0, 1), so a failure can be replayed. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

describeWithServices('[LTI-012] the policy score from the stored results', () => {
  let fx: GradeDbFixture;
  beforeAll(async () => {
    fx = await openGradeDbFixture();
  });
  afterAll(() => fx.close());

  it('[LTI-012] reads the best and the latest results, which give every policy the score of all results', async () => {
    // Arrange: 42 results of one learner, three to a timestamp (the latest too), in a random order of scores
    const placement = await fx.placement();
    const learnerKey = uniqueName('learner');
    const random = seeded(20261104);
    const all = [];
    for (let i = 0; i < 42; i += 1) {
      const scaled = Math.round(random() * 10_000) / 10_000;
      const timestamp = new Date(Date.UTC(2099, 0, 1, 10, Math.floor(i / 3)));
      const facts = { attemptId: `${VIEW_ID}:${i + 1}`, scaled, timestamp };
      await storeGradableResult(fx.db, { ...placement, learnerKey }, facts);
      all.push({ attemptId: facts.attemptId, scoreGiven: scoreGivenOf(scaled), resultAt: timestamp });
    }
    // Act
    const read = await policyResultScores(fx.db, placement, learnerKey);
    // Assert: every result at the latest timestamp is read, as D-115's order then goes by attempt number
    expect(read.length).toBeLessThanOrEqual(4);
    expect(read).toEqual(expect.arrayContaining(all.slice(-3)));
    for (const setting of SETTINGS) expect(policyScore(setting, read)).toBe(policyScore(setting, all));
  });

  it('[LTI-012] counts only the learner’s gradable root results of the placement’s activity and course', async () => {
    // Arrange: one gradable result, and rows that must not count
    const placement = await fx.placement();
    const other = await fx.placement();
    const learnerKey = uniqueName('learner');
    const at = new Date(Date.UTC(2099, 0, 1, 12));
    await storeGradableResult(
      fx.db,
      { ...placement, learnerKey },
      { attemptId: `${VIEW_ID}:1`, scaled: 0.5, timestamp: at },
    );
    await storeGradableResult(
      fx.db,
      { ...other, learnerKey },
      { attemptId: `${VIEW_ID}:2`, scaled: 1, timestamp: at },
    );
    await storeGradableResult(
      fx.db,
      { ...placement, learnerKey: uniqueName('learner') },
      { attemptId: `${VIEW_ID}:3`, scaled: 1, timestamp: at },
    );
    const row = {
      contentId: fx.contentId,
      contentVersion: 1,
      contextId: platformContextKey(placement.platformId, placement.contextId),
      learnerKey,
      attemptId: `${VIEW_ID}:4`,
      timestamp: new Date(at.getTime() + 60_000),
      academicYear: 2098,
    };
    await fx.db.xapiStatement.createMany({
      data: [
        { ...row, id: randomUUID(), verb: 'answered', subContentId: 'q1', scoreMax: 1, scaled: 1 },
        { ...row, id: randomUUID(), verb: 'attempted' },
        { ...row, id: randomUUID(), verb: 'completed', scoreMax: 0, scaled: 1 },
      ],
    });
    // Act
    const read = await policyResultScores(fx.db, placement, learnerKey);
    // Assert
    expect(read).toEqual([{ attemptId: `${VIEW_ID}:1`, scoreGiven: 50, resultAt: at }]);
    expect(await policyResultScores(fx.db, placement, uniqueName('learner'))).toEqual([]);
  });
});
