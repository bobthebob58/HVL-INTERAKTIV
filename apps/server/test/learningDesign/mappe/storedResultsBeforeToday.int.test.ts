/**
 * Integration test on PostgreSQL that the pedagogisk mappe's results source reads nothing of today: its groups end at
 * the latest midnight in Oslo, as insight's views do, so two exports on one day are the same and an export minus
 * insight's `semester` view never gives the learners who played today (D-106's amendment of 2026-11-05).
 *
 * Spec: MAPPE-003, INS-006
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { activityAggregates } from '../../../src/learningDesign/mappe/activityResults.js';
import { StoredActivityResults } from '../../../src/learningDesign/mappe/storedActivityResults.js';
import { minimumGroupSize } from '../../../src/privacy/minimumGroupSize.js';
import { openApiTestbed, type TestPrincipal } from '../../support/apiTestbed.js';
import { studioContentWithMappe } from '../../support/mappeFixture.js';
import { describeWithServices } from '../../support/services.js';
import { storeRows } from './storedResultsFixture.js';

const k5 = minimumGroupSize(5);

describeWithServices('[MAPPE-003] the mappe’s results end at the latest midnight in Oslo', () => {
  const tb = openApiTestbed({ studioContent: studioContentWithMappe() });
  const run = randomUUID().slice(0, 8);
  let author: TestPrincipal;

  beforeAll(async () => {
    author = await tb.principal('author');
  });
  afterAll(() => tb.close());

  it('[MAPPE-003] a learner who played today is in no group until the next day, as in insight (D-106)', async () => {
    // Arrange: four portal learners yesterday and a fifth today (Oslo), on 12 November 2026
    const sameDay = await tb.content(author.principal.userId, { title: 'Same dag' });
    const done = (learner: string, at: string) =>
      ({ learner, verb: 'completed', course: null, score: 5, at: new Date(at) }) as const;
    await storeRows(tb.db, run, sameDay, [
      ...['D1', 'D2', 'D3', 'D4'].map((learner) => done(learner, '2026-11-11T12:00:00.000Z')),
      // 00:30 in Oslo on 12 November (UTC+1), so today, not yesterday
      done('D5', '2026-11-11T23:30:00.000Z'),
    ]);
    const at = (moment: string) => new StoredActivityResults(tb.db, () => new Date(moment));
    // Act
    const morning = await at('2026-11-12T08:00:00.000Z').learnerSummaries([sameDay], k5);
    const evening = await at('2026-11-12T22:00:00.000Z').learnerSummaries([sameDay], k5);
    const tomorrow = await at('2026-11-12T23:30:00.000Z').learnerSummaries([sameDay], k5);
    // Assert: four learners before today's midnight stay below k all day; the fifth counts from the next midnight
    expect(morning.has(sameDay)).toBe(false);
    expect(evening.has(sameDay)).toBe(false);
    expect(activityAggregates(k5, tomorrow.get(sameDay))).toMatchObject({ participants: 5 });
  });

  it('[MAPPE-003] a shown group does not change during the day when one more learner plays', async () => {
    // Arrange: five learners completed yesterday (a shown group); a sixth starts without completing today
    const shown = await tb.content(author.principal.userId, { title: 'Ein til i dag' });
    const row = (learner: string, verb: 'completed' | 'attempted', at: string) =>
      ({
        learner,
        verb,
        course: null,
        at: new Date(at),
        ...(verb === 'completed' ? { score: 6 } : {}),
      }) as const;
    await storeRows(tb.db, run, shown, [
      ...['S1', 'S2', 'S3', 'S4', 'S5'].map((learner) =>
        row(learner, 'completed', '2026-11-11T12:00:00.000Z'),
      ),
      row('S6', 'attempted', '2026-11-12T09:00:00.000Z'),
    ]);
    const figures = async (moment: string) =>
      activityAggregates(
        k5,
        (await new StoredActivityResults(tb.db, () => new Date(moment)).learnerSummaries([shown], k5)).get(
          shown,
        ),
      );
    // Act
    const early = await figures('2026-11-12T08:00:00.000Z');
    const late = await figures('2026-11-12T15:00:00.000Z');
    const next = await figures('2026-11-13T08:00:00.000Z');
    // Assert: the same figures all day, so an export minus yesterday's never shows what the sixth learner did
    expect(late).toEqual(early);
    expect(early).toMatchObject({ participants: 5 });
    expect(next).toMatchObject({ participants: 6 });
  });
});
