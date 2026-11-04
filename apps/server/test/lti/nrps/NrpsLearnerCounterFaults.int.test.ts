/**
 * Integration tests for the NRPS learner count when the mock Canvas fails, through ltijs's real launch context: an
 * NRPS error, a failed token request, a token Canvas refused (replaced once) and a second 401. Every failure leaves
 * the old count as it was and lets a later launch try again in five minutes.
 *
 * Spec: LTI-008
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { NRPS_FRESH_KEY_PREFIX, NRPS_RETRY_SECONDS } from '../../../src/lti/nrps/NrpsLearnerCountStore.js';
import { forgetNrpsToken, NRPS_SCOPE } from '../../../src/lti/nrps/nrpsTokenCache.js';
import { describeWithServices } from '../../support/services.js';
import { ACTIVE_LEARNERS, EARLIER, openNrpsBench, type NrpsBench } from './support/nrpsBench.js';

describeWithServices('[LTI-008] the NRPS learner count when Canvas fails', () => {
  let bench: NrpsBench;
  const countNow = async () => (await bench.store.read(bench.contextKey))?.count;
  const tokenRequests = () => bench.tb.mock.canvas.tokens.requests.length;

  beforeAll(async () => {
    bench = await openNrpsBench();
  }, 60_000);
  afterAll(() => bench?.close());

  it.each([503, 500, 429, 403, 404])(
    '[LTI-008] an NRPS answer %i leaves the old count and lets a launch try again in five minutes',
    async (status) => {
      // Arrange
      const { tb, captured, store, contextKey } = bench;
      await bench.staleWith(7);
      tb.mock.canvas.nrps.failNext({ status });
      captured.lines.length = 0;
      // Act
      const outcome = await bench.counter().refresh(bench.launch, bench.course());
      // Assert
      expect(outcome).toBe('failed');
      expect(await store.read(contextKey)).toEqual({ count: 7, countedAt: EARLIER });
      const ttl = await tb.redis.ttl(`${NRPS_FRESH_KEY_PREFIX}${contextKey}`);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(NRPS_RETRY_SECONDS);
      const logged = captured.lines.map((line) => JSON.parse(line) as Record<string, unknown>);
      expect(logged).toContainEqual(expect.objectContaining({ event: 'nrps.count-failed', status }));
    },
  );

  it('[LTI-008] a failed token request also leaves the old count', async () => {
    // Arrange: no cached token, and the token endpoint refuses the next request
    await bench.staleWith(7);
    await forgetNrpsToken(bench.tb.db)(bench.launch.platform);
    bench.tb.mock.canvas.tokens.failNext({ status: 400, error: 'invalid_grant' });
    // Act
    const outcome = await bench.counter().refresh(bench.launch, bench.course());
    // Assert
    expect(outcome).toBe('failed');
    expect(await countNow()).toBe(7);
  });

  it('[LTI-008] a token Canvas refused (401) is replaced once, and the count goes through', async () => {
    // Arrange: ltijs holds a cached token, which the mock Canvas then forgets
    await bench.staleWith(7);
    await bench.counter().refresh(bench.launch, bench.course());
    await bench.staleWith(7);
    bench.tb.mock.canvas.tokens.revokeAll();
    const before = tokenRequests();
    // Act
    const outcome = await bench.counter().refresh(bench.launch, bench.course());
    // Assert
    expect(outcome).toBe('counted');
    expect(await countNow()).toBe(ACTIVE_LEARNERS);
    expect(tokenRequests()).toBe(before + 1);
  });

  it('[LTI-008] a second 401 fails the read: a missing scope is not mended by a new token', async () => {
    // Arrange
    await bench.staleWith(7);
    bench.tb.mock.canvas.nrps.failNext({ status: 401, count: 2 });
    const before = tokenRequests();
    // Act
    const outcome = await bench.counter().refresh(bench.launch, bench.course());
    // Assert: one new token, no third read, the old count
    expect(outcome).toBe('failed');
    expect(await countNow()).toBe(7);
    expect(tokenRequests()).toBe(before + 1);
    const cached = await bench.tb.db.ltiAccessToken.count({
      where: { platformUrl: bench.launch.platform.url, scopes: NRPS_SCOPE },
    });
    expect(cached).toBe(1);
  });
});
