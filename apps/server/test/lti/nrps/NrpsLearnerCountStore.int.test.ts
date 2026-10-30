/**
 * Integration tests for the NRPS learner-count store in Redis: one refresh claim per course and hour, a shorter mark
 * after a failure, the count as a number and a time only under D-103's platform-scoped key, and stored values that
 * are not a count reading as none.
 *
 * Spec: LTI-008, INS-001
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { connectRedis, type Redis } from '../../../src/infra/redisClient.js';
import {
  NRPS_COUNT_KEY_PREFIX,
  NRPS_COUNT_RETENTION_SECONDS,
  NRPS_FRESH_KEY_PREFIX,
  NRPS_FRESH_SECONDS,
  NRPS_RETRY_SECONDS,
  NrpsLearnerCountStore,
} from '../../../src/lti/nrps/NrpsLearnerCountStore.js';
import { platformContextKey } from '../../../src/xapi/platformContextKey.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';

describeWithServices('[LTI-008] the NRPS learner-count store', () => {
  let redis: Redis;
  let store: NrpsLearnerCountStore;
  const used: string[] = [];
  /** A fresh course key on a random platform, so parallel runs never meet. */
  const course = (contextId = 'course:with:colons') => {
    const key = platformContextKey(randomUUID(), contextId);
    used.push(`${NRPS_COUNT_KEY_PREFIX}${key}`, `${NRPS_FRESH_KEY_PREFIX}${key}`);
    return key;
  };

  beforeAll(async () => {
    redis = await connectRedis(serviceEnv().REDIS_URL);
    store = new NrpsLearnerCountStore(redis);
  });
  afterAll(async () => {
    if (used.length > 0) await redis?.del(used);
    await redis?.quit();
  });

  it('[LTI-008] only the first claim in an hour wins, so a course is read once per hour across nodes', async () => {
    // Arrange
    const key = course();
    // Act
    const claims = await Promise.all([1, 2, 3, 4, 5].map(() => store.claimRefresh(key)));
    // Assert
    expect(claims.filter(Boolean)).toHaveLength(1);
    const ttl = await redis.ttl(`${NRPS_FRESH_KEY_PREFIX}${key}`);
    expect(ttl).toBeGreaterThan(NRPS_FRESH_SECONDS - 5);
    expect(ttl).toBeLessThanOrEqual(NRPS_FRESH_SECONDS);
  });

  it('[LTI-008] after a failed read the mark lasts five minutes, and an expired mark can be claimed again', async () => {
    // Arrange
    const key = course();
    await store.claimRefresh(key);
    // Act
    await store.retrySoon(key);
    const ttl = await redis.ttl(`${NRPS_FRESH_KEY_PREFIX}${key}`);
    await redis.del(`${NRPS_FRESH_KEY_PREFIX}${key}`); // what Redis does when the mark expires
    // Assert
    expect(ttl).toBeGreaterThan(NRPS_RETRY_SECONDS - 5);
    expect(ttl).toBeLessThanOrEqual(NRPS_RETRY_SECONDS);
    expect(await store.claimRefresh(key)).toBe(true);
  });

  it('[LTI-008] a count is stored as a number and a time only, under the platform-scoped key, for 30 days', async () => {
    // Arrange
    const key = course();
    const countedAt = new Date('2026-10-30T12:00:00.000Z');
    // Act
    await store.save(key, 27, countedAt);
    // Assert
    const raw = await redis.get(`${NRPS_COUNT_KEY_PREFIX}${key}`);
    expect(JSON.parse(raw ?? '{}')).toEqual({ count: 27, countedAt: '2026-10-30T12:00:00.000Z' });
    expect(await store.read(key)).toEqual({ count: 27, countedAt });
    expect(await redis.ttl(`${NRPS_COUNT_KEY_PREFIX}${key}`)).toBeGreaterThan(
      NRPS_COUNT_RETENTION_SECONDS - 5,
    );
  });

  it('[INS-001] a course without a count, or with a stored value that is not one, reads as none', async () => {
    // Arrange
    const [missing, broken, negative, badDate] = [course(), course(), course(), course()];
    await redis.set(`${NRPS_COUNT_KEY_PREFIX}${broken}`, 'not json');
    await redis.set(
      `${NRPS_COUNT_KEY_PREFIX}${negative}`,
      JSON.stringify({ count: -1, countedAt: '2026-10-30' }),
    );
    await redis.set(`${NRPS_COUNT_KEY_PREFIX}${badDate}`, JSON.stringify({ count: 3, countedAt: 'never' }));
    // Act / Assert
    for (const key of [missing, broken, negative, badDate]) expect(await store.read(key)).toBeUndefined();
  });

  it('[LTI-008] two platforms with the same course ID never share a count (D-103)', async () => {
    // Arrange
    const first = course('same-course');
    const second = course('same-course');
    // Act
    await store.save(first, 12, new Date());
    // Assert
    expect(await store.read(second)).toBeUndefined();
    expect(await store.claimRefresh(first)).toBe(true);
    expect(await store.claimRefresh(second)).toBe(true);
  });
});
