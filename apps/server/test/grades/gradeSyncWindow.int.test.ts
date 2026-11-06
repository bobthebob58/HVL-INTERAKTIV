/**
 * Integration tests for the grade worker's limits over time, travelling with the worker's clock (LTI-012, D-104): at
 * most 8 attempts on the backoff schedule, no attempt later than 24 hours after the job was created, one attempt for
 * a job found after its 24 hours, a new result after the job stopped gives it 24 hours of its own and the new
 * launch's `sub` (also after the old one was cleared), and a job that takes in a result while its score is in flight
 * is sent again at the next run, or after its backoff when Canvas was down (D-104's amendment of 2026-11-04).
 *
 * Spec: LTI-012
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { runGradeSync } from '../../src/grades/gradeSyncRun.js';
import { describeWithServices } from '../support/services.js';
import {
  at,
  BENCH_EPOCH,
  openGradeBench,
  type BenchPlacement,
  type GradeBench,
} from './support/gradeBench.js';

const DAY = 24 * 60;

describeWithServices('[LTI-012] grade worker limits over time', () => {
  let bench: GradeBench;
  beforeAll(async () => {
    bench = await openGradeBench();
  }, 60_000);
  afterAll(() => bench.close());

  const canvas = () => bench.bed.mock.canvas;
  const minuteOf = (moment: Date): number => (moment.getTime() - BENCH_EPOCH) / 60_000;
  async function queued(minute = 0): Promise<BenchPlacement> {
    const { placement, learners } = await bench.placement();
    await bench.result(placement, learners[0]!, 1, 0.6, minute);
    return placement;
  }

  it('[LTI-012] makes 8 attempts on the backoff schedule within 24 hours, then fails the job', async () => {
    // Arrange
    const placement = await queued();
    canvas().ags.failNextScores({ count: 9, status: 503 });
    const attemptMinutes: number[] = [];
    // Act: run each time the job is next due
    let minute = 1;
    for (let i = 0; i < 9; i += 1) {
      const counts = await bench.run(minute, placement);
      if (counts.claimed > 0) attemptMinutes.push(minute);
      const [job] = await bench.jobs(placement);
      if (job?.nextAttemptAt) minute = minuteOf(job.nextAttemptAt);
    }
    canvas().clearFaults();
    // Assert
    expect(attemptMinutes).toEqual([1, 2, 5, 14, 41, 122, 365, 1094]);
    expect((await bench.jobs(placement))[0]).toMatchObject({
      status: 'failed',
      attempts: 8,
      lastError: 'http-503',
      terminalAt: at(1094),
      nextAttemptAt: null,
    });
    expect(attemptMinutes.at(-1)).toBeLessThan(DAY);
  });

  it('[LTI-012] keeps every attempt within 24 hours of the job’s creation (the boundary)', async () => {
    // Arrange: the worker was down; it first runs at 23 h 58 min
    const placement = await queued();
    canvas().ags.failNextScores({ count: 2, status: 503 });
    // Act
    await bench.run(DAY - 2, placement);
    const [inside] = await bench.jobs(placement);
    await bench.run(DAY - 1, placement);
    const [outside] = await bench.jobs(placement);
    // Assert: 1 minute later is 23 h 59 min, inside; 3 minutes after that is past 24 h, so the job fails
    expect(inside).toMatchObject({ status: 'pending', attempts: 1, nextAttemptAt: at(DAY - 1) });
    expect(outside).toMatchObject({ status: 'failed', attempts: 2, terminalAt: at(DAY - 1) });
  });

  it('[LTI-012] still makes one attempt for a job found after its 24 hours', async () => {
    // Arrange: two jobs from a day the worker never ran
    const ok = await queued();
    const down = await queued();
    // Act
    const sent = await bench.run(2 * DAY, ok);
    canvas().ags.failNextScores({ count: 1, status: 502 });
    const failed = await bench.run(2 * DAY, down);
    // Assert
    expect(sent).toMatchObject({ sent: 1, succeeded: 1 });
    expect(failed).toMatchObject({ failed: 1 });
    expect((await bench.jobs(down))[0]).toMatchObject({
      status: 'failed',
      attempts: 1,
      lastError: 'http-502',
    });
  });

  it('[LTI-012] gives a job that a new result reopens after it stopped 24 hours of its own', async () => {
    // Arrange: a score sent on day 0; two days later the learner plays again while Canvas is down
    const { placement, learners } = await bench.placement({ policy: 'latest' });
    await bench.result(placement, learners[0]!, 1, 0.6, 0);
    await bench.run(1, placement);
    await bench.result(placement, learners[0]!, 2, 0.8, 2 * DAY);
    canvas().ags.failNextScores({ count: 1, status: 503 });
    // Act
    const down = await bench.run(2 * DAY + 1, placement);
    const [waiting] = await bench.jobs(placement);
    const back = await bench.run(2 * DAY + 2, placement);
    // Assert: retried on the backoff, not failed as one past its first 24 hours
    expect(down).toMatchObject({ retried: 1, failed: 0 });
    expect(waiting).toMatchObject({ status: 'pending', attempts: 1, createdAt: at(2 * DAY) });
    expect(back).toMatchObject({ sent: 1, succeeded: 1 });
    const sent = canvas().ags.scores.filter((s) => s.lineItemUrl === placement.lineItemUrl);
    expect(sent.map((s) => s.score.scoreGiven)).toEqual([60, 80]);
  });

  it('[LTI-012] sends again, at the next run, a job that took in a result while its send was in flight', async () => {
    // Arrange: a repeated result of the same attempt (LTI-013's forged case) is stored during the send
    const { placement, learners } = await bench.placement({ policy: 'latest' });
    await bench.result(placement, learners[0]!, 1, 0.6, 0);
    const sender = bench.runDeps.sender;
    const racing = {
      postScore: async (request: Parameters<typeof sender.postScore>[0]) => {
        await bench.result(placement, learners[0]!, 1, 0.9, 1);
        return sender.postScore(request);
      },
    };
    // Act
    const first = await runGradeSync(
      { ...bench.runDeps, sender: racing, placementIds: [placement.id] },
      at(1),
    );
    const [changed] = await bench.jobs(placement);
    const next = await bench.run(2, placement);
    // Assert: the stale send is not settled over; the job is due at once, not after the claim's 30 minutes
    expect(first).toMatchObject({ sent: 1, changed: 1, succeeded: 0 });
    expect(changed).toMatchObject({ status: 'pending', scoreGiven: 90, attempts: 0, nextAttemptAt: at(1) });
    expect(next).toMatchObject({ claimed: 1, sent: 1, succeeded: 1 });
    const sent = canvas().ags.scores.filter((s) => s.lineItemUrl === placement.lineItemUrl);
    expect(sent.map((s) => s.score.scoreGiven)).toEqual([60, 90]);
  });

  it('[LTI-012] keeps the backoff and counts the send of a job that took in a result while Canvas was down', async () => {
    // Arrange: Canvas answers 503 while the learner stores a new result during the send
    const { placement, learners } = await bench.placement({ policy: 'latest' });
    await bench.result(placement, learners[0]!, 1, 0.6, 0);
    canvas().ags.failNextScores({ count: 1, status: 503 });
    const sender = bench.runDeps.sender;
    const racing = {
      postScore: async (request: Parameters<typeof sender.postScore>[0]) => {
        await bench.result(placement, learners[0]!, 2, 0.9, 1);
        return sender.postScore(request);
      },
    };
    // Act
    const first = await runGradeSync(
      { ...bench.runDeps, sender: racing, placementIds: [placement.id] },
      at(1),
    );
    const [changed] = await bench.jobs(placement);
    const early = await bench.run(1.5, placement);
    const due = await bench.run(2, placement);
    // Assert: a learner who keeps posting cannot make the worker skip the backoff or the 8-attempt limit
    expect(first).toMatchObject({ changed: 1, retried: 0 });
    expect(changed).toMatchObject({
      status: 'pending',
      attempts: 1,
      nextAttemptAt: at(2),
      lastError: 'http-503',
    });
    expect([early.claimed, due.succeeded]).toEqual([0, 1]);
    const sent = canvas().ags.scores.filter((s) => s.lineItemUrl === placement.lineItemUrl);
    expect(sent.map((s) => s.score.scoreGiven)).toEqual([90]);
  });

  it('[LTI-012] sends a returning learner’s score with the new launch’s sub after the old one was cleared', async () => {
    // Arrange: a score sent on day 0; 30 days after the job stopped its sub was cleared (DATA-002)
    const { placement, learners } = await bench.placement();
    await bench.result(placement, learners[0]!, 1, 0.6, 0);
    await bench.run(1, placement);
    await bench.bed.db.gradeSyncJob.updateMany({
      where: { placementId: placement.id },
      data: { ltiSubEncrypted: null },
    });
    await bench.result(placement, learners[0]!, 2, 0.8, 40 * DAY);
    // Act
    const counts = await bench.run(40 * DAY + 1, placement);
    // Assert: the reopened job took in the new request's sub, so the score reaches the learner's row
    expect(counts).toMatchObject({ sent: 1, succeeded: 1 });
    const sent = canvas().ags.scores.filter((s) => s.lineItemUrl === placement.lineItemUrl);
    expect(sent.map((s) => [s.score.userId, s.score.scoreGiven])).toEqual([
      [learners[0]!.sub, 60],
      [learners[0]!.sub, 80],
    ]);
  });
});
