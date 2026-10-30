/**
 * Integration tests for the grade worker's limits over time, travelling with the worker's clock (LTI-012, D-104): at
 * most 8 attempts on the backoff schedule, no attempt later than 24 hours after the job was created, one attempt for
 * a job found after its 24 hours, and a job that changes while its score is in flight is sent again with the change.
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

  it('[LTI-012] sends again a job whose score changed while its send was in flight', async () => {
    // Arrange: a repeated result of the same attempt (LTI-013's forged case) arrives during the send
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
    const beforeLease = await bench.run(20, placement);
    const afterLease = await bench.run(31, placement);
    // Assert: the stale send is not settled; the claim's lease (30 minutes) passes and the new score goes
    expect(first).toMatchObject({ sent: 1, changed: 1, succeeded: 0 });
    expect(changed).toMatchObject({ status: 'pending', scoreGiven: 90, attempts: 0 });
    expect(beforeLease.claimed).toBe(0);
    expect(afterLease).toMatchObject({ sent: 1, succeeded: 1 });
    const sent = canvas().ags.scores.filter((s) => s.lineItemUrl === placement.lineItemUrl);
    expect(sent.map((s) => s.score.scoreGiven)).toEqual([60, 90]);
  });
});
