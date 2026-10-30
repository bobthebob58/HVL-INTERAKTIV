/**
 * Integration tests for the grade worker against the mock Canvas (LTI-012, D-104): a stored result reaches the
 * gradebook with LTI-012's score body, the job settles, the worker runs on its lease, a result sent twice is one job
 * and one score, and a learner's due jobs coalesce into one current policy score, ordered by result time.
 *
 * Spec: LTI-012
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { GRADE_SYNC_LEASE_KEY, GradeSyncWorker } from '../../src/grades/GradeSyncWorker.js';
import { describeWithServices } from '../support/services.js';
import { at, openGradeBench, type GradeBench } from './support/gradeBench.js';

describeWithServices('[LTI-012] grade worker against the mock Canvas', () => {
  let bench: GradeBench;
  beforeAll(async () => {
    bench = await openGradeBench();
  }, 60_000);
  afterAll(() => bench.close());

  const acceptedFor = (lineItemUrl: string) =>
    bench.bed.mock.canvas.ags.scores.filter((score) => score.lineItemUrl === lineItemUrl).map((s) => s.score);

  it('[LTI-012] sends a stored result to the gradebook on its lease, with the score body of LTI-012', async () => {
    // Arrange
    const { placement, learners } = await bench.placement();
    const [learner] = learners;
    await bench.result(placement, learner!, 1, 0.75, 0);
    const worker = new GradeSyncWorker({
      ...bench.runDeps,
      redis: bench.bed.redis,
      placementIds: [placement.id],
      clock: () => at(1),
    });
    await bench.bed.redis.del(GRADE_SYNC_LEASE_KEY);
    // Act
    const outcome = await worker.runOnce();
    const again = await bench.run(2, placement);
    // Assert
    expect(outcome).toBe('ran');
    expect(acceptedFor(placement.lineItemUrl)).toEqual([
      {
        userId: learner!.sub,
        scoreGiven: 75,
        scoreMaximum: 100,
        activityProgress: 'Completed',
        gradingProgress: 'FullyGraded',
        timestamp: at(1).toISOString(),
      },
    ]);
    const [job] = await bench.jobs(placement);
    expect(job).toMatchObject({
      status: 'succeeded',
      attempts: 1,
      succeededAt: at(1),
      terminalAt: at(1),
      nextAttemptAt: null,
      lastError: null,
    });
    expect(again).toMatchObject({ claimed: 0, sent: 0 });
  });

  it('[LTI-012] keeps a result sent twice as one job and one score (idempotency)', async () => {
    // Arrange: the bridge's pagehide flush repeats a batch the server had stored
    const { placement, learners } = await bench.placement();
    await bench.result(placement, learners[0]!, 1, 0.5, 0);
    await bench.result(placement, learners[0]!, 1, 0.5, 0);
    // Act
    const counts = await bench.run(1, placement);
    // Assert
    expect(await bench.jobs(placement)).toHaveLength(1);
    expect(counts).toMatchObject({ claimed: 1, sent: 1, succeeded: 1 });
    expect(acceptedFor(placement.lineItemUrl).map((s) => s.scoreGiven)).toEqual([50]);
  });

  it('[LTI-012] coalesces a learner’s due jobs into one score, the latest by result time, not by creation', async () => {
    // Arrange: attempt 3's result came first in time but its job was written last
    const { placement, learners } = await bench.placement({ policy: 'latest', learners: 2 });
    const [kari, ola] = learners;
    await bench.result(placement, kari!, 1, 0.4, 1);
    await bench.result(placement, kari!, 2, 0.9, 3);
    await bench.result(placement, kari!, 3, 0.2, 0);
    await bench.result(placement, ola!, 1, 0.6, 2);
    // Act
    const counts = await bench.run(5, placement);
    // Assert
    expect(counts).toMatchObject({ claimed: 4, sent: 2, succeeded: 4 });
    const sent = acceptedFor(placement.lineItemUrl);
    expect(sent.map((s) => [s.userId, s.scoreGiven])).toEqual(
      expect.arrayContaining([
        [kari!.sub, 90],
        [ola!.sub, 60],
      ]),
    );
    expect(sent).toHaveLength(2);
  });

  it.each([
    ['best', undefined, [80, 80]],
    ['latest', undefined, [80, 30]],
    ['mastery', 0.8, [100, 100]],
    ['mastery', 0.9, [80, 30]],
  ] as const)(
    '[LTI-012] applies %s (threshold %s) over the attempts already sent: %j',
    async (policy, threshold, expected) => {
      // Arrange: an earlier attempt was sent; a later, lower one is queued
      const { placement, learners } = await bench.placement({ policy, ...(threshold ? { threshold } : {}) });
      await bench.result(placement, learners[0]!, 1, 0.8, 0);
      await bench.run(1, placement);
      await bench.result(placement, learners[0]!, 2, 0.3, 10);
      // Act
      await bench.run(11, placement);
      // Assert
      expect(acceptedFor(placement.lineItemUrl).map((s) => s.scoreGiven)).toEqual(expected);
      expect((await bench.jobs(placement)).map((job) => job.status)).toEqual(['succeeded', 'succeeded']);
    },
  );
});
