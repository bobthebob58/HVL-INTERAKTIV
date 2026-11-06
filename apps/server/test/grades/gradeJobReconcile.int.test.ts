/**
 * Integration tests for reconciling grade jobs (the step-3 security review, finding 4; D-104's amendment of
 * 2026-11-04): a result stored without its job write reopens the learner's stopped job and reaches Canvas in the same
 * run, once; results inside the first minute or older than 15 minutes, a pending job, a job without its `sub`, a
 * result in another course and rows that are not gradable results are left alone; and a learner with no job gets the
 * lost result with their next one.
 *
 * Spec: LTI-012
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { platformContextKey } from '../../src/xapi/platformContextKey.js';
import { describeWithServices } from '../support/services.js';
import { at, openGradeBench, type BenchPlacement, type GradeBench } from './support/gradeBench.js';

describeWithServices('[LTI-012] reconciling grade jobs with the stored results', () => {
  let bench: GradeBench;
  beforeAll(async () => {
    bench = await openGradeBench();
  }, 60_000);
  afterAll(() => bench.close());

  const sentTo = (placement: BenchPlacement) =>
    bench.bed.mock.canvas.ags.scores
      .filter((score) => score.lineItemUrl === placement.lineItemUrl)
      .map((score) => score.score.scoreGiven);
  /** A placement whose one learner's score of 0.6 was sent at minute 1. */
  async function sent() {
    const { placement, learners } = await bench.placement();
    await bench.result(placement, learners[0]!, 1, 0.6, 0);
    await bench.run(1, placement);
    return { placement, learner: learners[0]! };
  }

  it('[LTI-012] reopens a stopped job that missed a stored result and sends it in the same run, once', async () => {
    // Arrange: a later result was stored, but its job write failed
    const { placement, learner } = await sent();
    await bench.store(placement, learner, 2, 0.9, 2);
    // Act
    const counts = await bench.run(3, placement);
    const again = await bench.run(4, placement);
    // Assert
    expect(counts).toMatchObject({ reconciled: 1, claimed: 1, sent: 1, succeeded: 1 });
    expect(sentTo(placement)).toEqual([60, 90]);
    expect((await bench.jobs(placement))[0]).toMatchObject({
      status: 'succeeded',
      attempts: 1,
      resultAt: at(2),
      scoreGiven: 90,
      createdAt: at(3),
    });
    expect(again).toMatchObject({ reconciled: 0, claimed: 0 });
  });

  it('[LTI-012] leaves a result to the ingestion for a minute, and one older than 15 minutes alone', async () => {
    // Arrange
    const { placement, learner } = await sent();
    await bench.store(placement, learner, 2, 0.9, 10);
    // Act
    const tooSoon = await bench.run(10.5, placement);
    const tooLate = await bench.run(26, placement);
    // Assert
    expect([tooSoon.reconciled, tooLate.reconciled]).toEqual([0, 0]);
    expect(sentTo(placement)).toEqual([60]);
  });

  it('[LTI-012] reopens no pending job, no job without its sub, and nothing for a result in another course', async () => {
    // Arrange
    const pending = await bench.placement();
    await bench.result(pending.placement, pending.learners[0]!, 1, 0.6, 0);
    await bench.store(pending.placement, pending.learners[0]!, 2, 0.9, 1);
    const noSub = await sent();
    await bench.bed.db.gradeSyncJob.updateMany({
      where: { placementId: noSub.placement.id },
      data: { ltiSubEncrypted: null },
    });
    await bench.store(noSub.placement, noSub.learner, 2, 0.9, 2);
    const course = await sent();
    const elsewhere = await bench.placement();
    await bench.store(elsewhere.placement, course.learner, 2, 0.9, 2);
    // Act
    const counts = await bench.run(
      3,
      pending.placement,
      noSub.placement,
      course.placement,
      elsewhere.placement,
    );
    // Assert: the pending job is sent as it is, reading both its stored results
    expect(counts.reconciled).toBe(0);
    expect((await bench.jobs(pending.placement))[0]).toMatchObject({ status: 'succeeded', resultAt: at(0) });
    expect(sentTo(pending.placement)).toEqual([90]);
    expect((await bench.jobs(noSub.placement))[0]).toMatchObject({ status: 'succeeded', resultAt: at(0) });
    expect((await bench.jobs(course.placement))[0]).toMatchObject({ status: 'succeeded', resultAt: at(0) });
    expect(await bench.jobs(elsewhere.placement)).toEqual([]);
  });

  it('[LTI-012] reopens nothing for a newer row that is not a gradable result (D-115)', async () => {
    // Arrange: a sub-content answer, a root `attempted` and a root result with maximum 0, each scored and newer
    const { placement, learner } = await sent();
    const row = {
      contentId: bench.contentId,
      contentVersion: 1,
      contextId: platformContextKey(bench.bed.platformId, placement.contextId),
      learnerKey: learner.principal.learnerKey,
      attemptId: `${randomUUID()}:1`,
      scaled: 1,
      timestamp: at(2),
      academicYear: 2098,
    };
    await bench.bed.db.xapiStatement.createMany({
      data: [
        { ...row, id: randomUUID(), verb: 'answered', subContentId: 'q1', scoreMax: 1 },
        { ...row, id: randomUUID(), verb: 'attempted', scoreMax: 4 },
        { ...row, id: randomUUID(), verb: 'completed', scoreMax: 0 },
      ],
    });
    // Act
    const counts = await bench.run(3, placement);
    // Assert
    expect(counts).toMatchObject({ reconciled: 0, claimed: 0 });
    expect(sentTo(placement)).toEqual([60]);
  });

  it('[LTI-012] sends a lost first result with the learner’s next one, whose send reads every stored result', async () => {
    // Arrange: the first result's job write failed, so there is no job and no sub; the next one writes the job
    const { placement, learners } = await bench.placement();
    await bench.store(placement, learners[0]!, 1, 0.9, 0);
    await bench.result(placement, learners[0]!, 2, 0.3, 5);
    // Act
    const counts = await bench.run(6, placement);
    // Assert: `best` over both stored results
    expect(counts).toMatchObject({ reconciled: 0, sent: 1 });
    expect(sentTo(placement)).toEqual([90]);
  });
});
