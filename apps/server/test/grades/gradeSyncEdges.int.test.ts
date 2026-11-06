/**
 * Integration tests for the grade worker's edges against the mock Canvas (LTI-012, D-104): a job whose learner's
 * `sub` is gone or unreadable, or whose placement lost its line item, fails without a send; an unexpected error while
 * sending is a bounded retry whose log names no learner; a worker that died mid-send leaves its jobs to a later run
 * once its claim ends; a run that outlived its claim does not settle a job that another run has claimed since; a
 * score's timestamp is the time of sending, never earlier than the run's moment; and a retry's delay counts from the
 * moment Canvas answered, not from the run's start.
 *
 * Spec: LTI-012, DATA-002
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { AgsSendOutcome } from '../../src/grades/agsSendOutcome.js';
import { claimDueGradeJobs } from '../../src/grades/gradeJobClaims.js';
import { GRADE_SYNC_CLAIM_LEASE_MS, runGradeSync } from '../../src/grades/gradeSyncRun.js';
import { capturedLogger } from '../support/capturedLogger.js';
import { describeWithServices } from '../support/services.js';
import { at, openGradeBench, type BenchPlacement, type GradeBench } from './support/gradeBench.js';

describeWithServices('[LTI-012] grade worker edges', () => {
  let bench: GradeBench;
  beforeAll(async () => {
    bench = await openGradeBench();
  }, 60_000);
  afterAll(() => bench.close());

  const canvas = () => bench.bed.mock.canvas;
  const postsTo = (placement: BenchPlacement) =>
    canvas().ags.scorePosts.filter((post) => post.lineItemUrl === placement.lineItemUrl);
  const acceptedTo = (placement: BenchPlacement) =>
    canvas()
      .ags.scores.filter((score) => score.lineItemUrl === placement.lineItemUrl)
      .map((s) => s.score);
  /** A placement with one queued result of 0.6 at minute 0, and its learner. */
  async function queued() {
    const { placement, learners } = await bench.placement();
    await bench.result(placement, learners[0]!, 1, 0.6, 0);
    return { placement, learner: learners[0]! };
  }

  it('[DATA-002] fails a job without a send when its learner’s sub is gone or cannot be read', async () => {
    // Arrange: one job requeued after the 30-day cleanup (D-104), one whose sub no key in the ring can read
    const gone = (await queued()).placement;
    const unreadable = (await queued()).placement;
    const jobsOf = (placement: BenchPlacement) => ({ where: { placementId: placement.id } });
    await bench.bed.db.gradeSyncJob.updateMany({ ...jobsOf(gone), data: { ltiSubEncrypted: null } });
    await bench.bed.db.gradeSyncJob.updateMany({
      ...jobsOf(unreadable),
      data: { ltiSubEncrypted: new Uint8Array(40).fill(7) },
    });
    // Act
    const counts = await bench.run(1, gone, unreadable);
    // Assert
    expect(counts).toMatchObject({ claimed: 2, sent: 0, failed: 2 });
    expect((await bench.jobs(gone))[0]).toMatchObject({
      status: 'failed',
      lastError: 'no-subject',
      attempts: 1,
      terminalAt: at(1),
    });
    expect((await bench.jobs(unreadable))[0]).toMatchObject({
      status: 'failed',
      lastError: 'subject-unreadable',
    });
    expect([...postsTo(gone), ...postsTo(unreadable)]).toHaveLength(0);
  });

  it('[LTI-012] fails a job without a send when its placement no longer has a line item', async () => {
    // Arrange: a later launch recorded the link without a line item
    const { placement } = await queued();
    await bench.bed.db.ltiPlacement.update({ where: { id: placement.id }, data: { lineItemUrl: null } });
    // Act
    const counts = await bench.run(1, placement);
    // Assert
    expect(counts).toMatchObject({ failed: 1, sent: 0 });
    expect((await bench.jobs(placement))[0]).toMatchObject({ status: 'failed', lastError: 'no-line-item' });
    expect(postsTo(placement)).toHaveLength(0);
  });

  it('[LTI-012] retries after an unexpected error while sending, and logs no learner, sub or message', async () => {
    // Arrange
    const { placement, learner } = await queued();
    const { logger, lines } = capturedLogger('debug');
    const throwing = {
      postScore: () => Promise.reject(new Error(`no route for ${learner.sub}`)),
    };
    // Act
    const counts = await runGradeSync(
      { ...bench.runDeps, logger, sender: throwing, placementIds: [placement.id] },
      at(1),
    );
    // Assert
    expect(counts).toMatchObject({ claimed: 1, retried: 1, failed: 0 });
    expect((await bench.jobs(placement))[0]).toMatchObject({
      status: 'pending',
      attempts: 1,
      lastError: 'internal',
      nextAttemptAt: at(2),
    });
    const logged = lines.join('\n');
    expect(logged).toContain('grade.sync.error');
    for (const secret of [learner.sub, learner.principal.learnerKey, 'no route']) {
      expect(logged).not.toContain(secret);
    }
  });

  it('[LTI-012] leaves the jobs of a worker that died mid-send to a later run once its claim ends', async () => {
    // Arrange: a run claimed the job at minute 1 and never settled it
    const { placement } = await queued();
    await claimDueGradeJobs(bench.bed.db, at(1), {
      limit: 50,
      leaseMs: GRADE_SYNC_CLAIM_LEASE_MS,
      placementIds: [placement.id],
    });
    // Act
    const duringClaim = await bench.run(20, placement);
    const afterClaim = await bench.run(31, placement);
    // Assert
    expect(duringClaim.claimed).toBe(0);
    expect(afterClaim).toMatchObject({ claimed: 1, sent: 1, succeeded: 1 });
    expect((await bench.jobs(placement))[0]).toMatchObject({ status: 'succeeded', attempts: 1 });
    expect(acceptedTo(placement).map((score) => score.scoreGiven)).toEqual([60]);
  });

  it('[LTI-012] does not settle a job that another run claimed after this run outlived its claim', async () => {
    // Arrange: while this run (minute 1) sends, another node's run at minute 32 claims the job again and meets a 503
    const { placement } = await queued();
    canvas().ags.failNextScores({ count: 1, status: 503 });
    const sender = bench.runDeps.sender;
    const outlived = {
      postScore: async (request: Parameters<typeof sender.postScore>[0]) => {
        await bench.run(32, placement);
        return sender.postScore(request);
      },
    };
    // Act
    const counts = await runGradeSync(
      { ...bench.runDeps, sender: outlived, placementIds: [placement.id] },
      at(1),
    );
    // Assert: the later claim's outcome stands; this run's success is not written over it
    expect(counts).toMatchObject({ sent: 1, succeeded: 0, changed: 1 });
    expect((await bench.jobs(placement))[0]).toMatchObject({
      status: 'pending',
      attempts: 1,
      lastError: 'http-503',
      nextAttemptAt: at(33),
    });
  });

  it('[LTI-012] stamps a score with the time of sending, never earlier than the run’s moment', async () => {
    // Arrange: one run whose send happens 4 s after its moment; one whose moment is ahead of the wall clock
    const late = await queued();
    const ahead = await queued();
    const run = (placement: BenchPlacement, wallClock: () => number) =>
      runGradeSync({ ...bench.runDeps, wallClock, placementIds: [placement.id] }, at(1));
    // Act
    await run(late.placement, () => at(1).getTime() + 4_000);
    await run(ahead.placement, () => at(1).getTime() - 60_000);
    // Assert
    expect(acceptedTo(late.placement).map((score) => score.timestamp)).toEqual([
      new Date(at(1).getTime() + 4_000).toISOString(),
    ]);
    expect(acceptedTo(ahead.placement).map((score) => score.timestamp)).toEqual([at(1).toISOString()]);
  });

  it('[LTI-012] counts a retry’s delay from Canvas’s answer, not the run’s start', async () => {
    // Arrange: a degraded Canvas answers 5 minutes after the run's moment (minute 1)
    const waited = (await queued()).placement;
    const timedOut = (await queued()).placement;
    let wall = 0;
    const slowCanvas = (outcome: AgsSendOutcome) => ({
      postScore: () => {
        wall = at(6).getTime();
        return Promise.resolve(outcome);
      },
    });
    const run = (placement: BenchPlacement, outcome: AgsSendOutcome) => {
      wall = at(1).getTime();
      const deps = { ...bench.runDeps, sender: slowCanvas(outcome), wallClock: () => wall };
      return runGradeSync({ ...deps, placementIds: [placement.id] }, at(1));
    };
    const next = async (placement: BenchPlacement) => (await bench.jobs(placement))[0]?.nextAttemptAt;
    // Act: a 503 with Retry-After: 2 minutes, and a network failure (1 minute's backoff); a run 15 s after the answer
    await run(waited, { kind: 'retry', reason: 'http-503', retryAfterMs: 120_000 });
    await run(timedOut, { kind: 'retry', reason: 'network' });
    const due = [await next(waited), await next(timedOut)];
    const early = await bench.run(6.25, waited, timedOut);
    // Assert: neither is sent again inside the time Canvas asked for, or its backoff, counted from the answer
    expect([...due, early.claimed]).toEqual([at(8), at(7), 0]);
  });
});
