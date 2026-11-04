/**
 * Integration tests for the NRPS learner count against the mock Canvas, through ltijs's real launch context: a launch
 * from the mock Canvas, its context resumed from the ltik, and the counter reading the roster over HTTP with ltijs's
 * own token and paging. Covers paging, the Learner role filter, one count per hour, the page limit, what is kept and
 * logged, and the app's builder. Failures are in ./NrpsLearnerCounterFaults.int.test.ts.
 *
 * Spec: LTI-008, INS-001
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { LTI_SCOPE } from '../../../../../tools/mock-platform/mockPlatform.mjs';
import {
  NRPS_COUNT_KEY_PREFIX,
  NRPS_FRESH_KEY_PREFIX,
  NRPS_FRESH_SECONDS,
} from '../../../src/lti/nrps/NrpsLearnerCountStore.js';
import { createNrpsServices } from '../../../src/lti/nrps/nrpsServices.js';
import { NRPS_SCOPE } from '../../../src/lti/nrps/nrpsTokenCache.js';
import { describeWithServices } from '../../support/services.js';
import { ACTIVE_LEARNERS, openNrpsBench, type NrpsBench } from './support/nrpsBench.js';

describeWithServices('[LTI-008] the NRPS learner count against the mock Canvas', () => {
  let bench: NrpsBench;
  const freshTtl = () => bench.tb.redis.ttl(`${NRPS_FRESH_KEY_PREFIX}${bench.contextKey}`);

  beforeAll(async () => {
    bench = await openNrpsBench();
  }, 60_000);
  afterAll(() => bench?.close());

  it('[LTI-008] reads every page with the full Learner role URI and stores the active learners under D-103’s key', async () => {
    // Arrange
    const { launch, store, contextKey, tb, courseId } = bench;
    await bench.staleWith(3);
    // Act
    const outcome = await bench.counter().refresh(launch, bench.course());
    // Assert: 120, not 0 (the short name `Learner` matches nobody) and not 50 (one page)
    expect(launch.namesAndRoles.isAvailable()).toBe(true);
    expect(outcome).toBe('counted');
    expect((await store.read(contextKey))?.count).toBe(ACTIVE_LEARNERS);
    expect(contextKey).toBe(`${tb.platformId}:${courseId}`);
  });

  it('[LTI-008] a fresh count is not read again within the hour, whichever counter asks', async () => {
    // Arrange
    const { launch, store, contextKey, tb, courseId, roster } = bench;
    await bench.staleWith(3);
    await bench.counter().refresh(launch, bench.course());
    tb.mock.canvas.nrps.setMembers(courseId, roster.slice(10));
    // Act
    const outcome = await bench.counter().refresh(launch, bench.course());
    // Assert
    expect(outcome).toBe('fresh');
    expect((await store.read(contextKey))?.count).toBe(ACTIVE_LEARNERS);
    expect(await freshTtl()).toBeGreaterThan(NRPS_FRESH_SECONDS - 10);
    tb.mock.canvas.nrps.setMembers(courseId, roster);
  });

  it('[LTI-008] a course with more pages than NRPS_MAX_PAGES keeps its old count and the full hour', async () => {
    // Arrange
    await bench.staleWith(7);
    // Act: two pages of 50 cannot hold 120 learners
    const outcome = await bench.counter({ maxPages: 2 }).refresh(bench.launch, bench.course());
    // Assert
    expect(outcome).toBe('too-large');
    expect((await bench.store.read(bench.contextKey))?.count).toBe(7);
    expect(await freshTtl()).toBeGreaterThan(NRPS_FRESH_SECONDS - 10);
  });

  it('[LTI-008] only the number is kept or logged: no member ID reaches Redis or the log', async () => {
    // Arrange
    const { tb, captured, contextKey, roster } = bench;
    await bench.staleWith(3);
    captured.lines.length = 0;
    // Act
    await bench.counter().refresh(bench.launch, bench.course());
    // Assert
    const stored = await tb.redis.get(`${NRPS_COUNT_KEY_PREFIX}${contextKey}`);
    expect(Object.keys(JSON.parse(stored ?? '{}') as object).sort()).toEqual(['count', 'countedAt']);
    const written = [...captured.lines, ...tb.logs].join('\n');
    expect(captured.lines.join('\n')).toContain('nrps.counted');
    for (const { user_id: userId } of roster) expect(written).not.toContain(userId);
  });

  it('[INS-001] the app’s builder shares one store: the counter writes what insight’s reader reads', async () => {
    // Arrange
    const { tb, captured } = bench;
    await bench.staleWith(3);
    const nrps = createNrpsServices({ db: tb.db, redis: tb.redis, logger: captured.logger, maxPages: 100 });
    // Act
    const outcome = await nrps.counter.refresh(bench.launch, bench.course());
    // Assert
    expect(outcome).toBe('counted');
    expect((await nrps.counts.read(bench.contextKey))?.count).toBe(ACTIVE_LEARNERS);
    expect(NRPS_SCOPE).toBe(LTI_SCOPE.contextMembershipReadonly);
  });
});
