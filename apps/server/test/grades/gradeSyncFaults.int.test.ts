/**
 * Integration tests for how the grade worker meets Canvas's faults (LTI-012, D-104), injected into the mock Canvas:
 * a 5xx is retried after the backoff, a 429's `Retry-After` is honoured, a 401 fetches one new token and a second
 * 401 fails the job, a deleted line item makes the job `orphaned` and it is never retried, and any other 4xx, from
 * the score service or the token endpoint, fails the job at once.
 *
 * Spec: LTI-012
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithServices } from '../support/services.js';
import { at, openGradeBench, type BenchPlacement, type GradeBench } from './support/gradeBench.js';

describeWithServices('[LTI-012] grade worker against Canvas faults', () => {
  let bench: GradeBench;
  beforeAll(async () => {
    bench = await openGradeBench();
  }, 60_000);
  afterAll(() => bench.close());

  const canvas = () => bench.bed.mock.canvas;
  const sentTo = (placement: BenchPlacement) =>
    canvas()
      .ags.scores.filter((s) => s.lineItemUrl === placement.lineItemUrl)
      .map((s) => s.score.scoreGiven);
  /** A placement with one queued result of 0.6 at minute 0. */
  async function queued(): Promise<BenchPlacement> {
    const { placement, learners } = await bench.placement();
    await bench.result(placement, learners[0]!, 1, 0.6, 0);
    return placement;
  }

  it('[LTI-012] retries a 5xx after the backoff, then succeeds', async () => {
    // Arrange
    const placement = await queued();
    canvas().ags.failNextScores({ count: 1, status: 503 });
    // Act
    const first = await bench.run(1, placement);
    const [afterFailure] = await bench.jobs(placement);
    const early = await bench.run(1.5, placement);
    const second = await bench.run(2, placement);
    // Assert
    expect(first).toMatchObject({ claimed: 1, sent: 0, retried: 1 });
    expect(afterFailure).toMatchObject({
      status: 'pending',
      attempts: 1,
      lastError: 'http-503',
      nextAttemptAt: at(2),
    });
    expect(early).toMatchObject({ claimed: 0 });
    expect(second).toMatchObject({ claimed: 1, sent: 1, succeeded: 1 });
    expect(sentTo(placement)).toEqual([60]);
    expect((await bench.jobs(placement))[0]).toMatchObject({
      status: 'succeeded',
      attempts: 2,
      lastError: null,
    });
  });

  it('[LTI-012] waits as long as a 429’s Retry-After asks, longer than the backoff', async () => {
    // Arrange
    const placement = await queued();
    canvas().ags.failNextScores({ count: 1, status: 429, retryAfter: 600 });
    // Act
    await bench.run(1, placement);
    const [waiting] = await bench.jobs(placement);
    const tooEarly = await bench.run(5, placement);
    const onTime = await bench.run(11, placement);
    // Assert
    expect(waiting).toMatchObject({ status: 'pending', lastError: 'http-429', nextAttemptAt: at(11) });
    expect(tooEarly.claimed).toBe(0);
    expect(onTime).toMatchObject({ sent: 1, succeeded: 1 });
  });

  it('[LTI-012] fetches one new token after a 401 (a revoked token) and sends with it', async () => {
    // Arrange: a token is cached from an earlier send, then Canvas forgets it
    await bench.run(1, await queued());
    const placement = await queued();
    canvas().tokens.revokeAll();
    const tokenRequests = canvas().tokens.requests.length;
    // Act
    const counts = await bench.run(1, placement);
    // Assert
    expect(counts).toMatchObject({ sent: 1, succeeded: 1 });
    expect(canvas().tokens.requests.length - tokenRequests).toBe(1);
    expect(sentTo(placement)).toEqual([60]);
  });

  it('[LTI-012] fails the job after a second 401, as for a missing scope', async () => {
    // Arrange
    const placement = await queued();
    canvas().ags.failNextScores({ count: 2, status: 401 });
    // Act
    const counts = await bench.run(1, placement);
    const later = await bench.run(60, placement);
    // Assert
    expect(counts).toMatchObject({ failed: 1, sent: 0 });
    expect((await bench.jobs(placement))[0]).toMatchObject({
      status: 'failed',
      attempts: 1,
      lastError: 'http-401',
      terminalAt: at(1),
      nextAttemptAt: null,
    });
    expect(later.claimed).toBe(0);
  });

  it('[LTI-012] marks the job orphaned when the line item is gone, and never retries it', async () => {
    // Arrange: the teacher deleted the assignment
    const placement = await queued();
    canvas().ags.deleteLineItem(placement.lineItemUrl);
    // Act
    const counts = await bench.run(1, placement);
    const later = await bench.run(24 * 60, placement);
    // Assert
    expect(counts).toMatchObject({ orphaned: 1, sent: 0 });
    expect((await bench.jobs(placement))[0]).toMatchObject({
      status: 'orphaned',
      attempts: 1,
      terminalAt: at(1),
      lastError: 'line-item-gone',
    });
    expect(later.claimed).toBe(0);
  });

  it('[LTI-012] fails at once on another 4xx: a learner who is not in the course (422)', async () => {
    // Arrange
    const { placement, learners } = await bench.placement();
    canvas().nrps.setMembers(placement.contextId, []);
    await bench.result(placement, learners[0]!, 1, 0.6, 0);
    // Act
    const counts = await bench.run(1, placement);
    // Assert
    expect(counts).toMatchObject({ failed: 1 });
    expect((await bench.jobs(placement))[0]).toMatchObject({ status: 'failed', lastError: 'http-422' });
  });

  it('[LTI-012] fails at once when the token endpoint refuses the request, and retries when it is down', async () => {
    // Arrange: Canvas forgets any cached token, so the next send asks the token endpoint again
    const refused = await queued();
    const down = await queued();
    canvas().tokens.revokeAll();
    // Act
    canvas().tokens.failNext({ status: 400, error: 'invalid_grant' });
    const refusedCounts = await bench.run(1, refused);
    canvas().tokens.failNext({ status: 503 });
    const downCounts = await bench.run(1, down);
    // Assert
    expect(refusedCounts).toMatchObject({ failed: 1 });
    expect((await bench.jobs(refused))[0]).toMatchObject({ status: 'failed', lastError: 'token-http-400' });
    expect(downCounts).toMatchObject({ retried: 1 });
    expect((await bench.jobs(down))[0]).toMatchObject({ status: 'pending', lastError: 'token-http-503' });
  });
});
