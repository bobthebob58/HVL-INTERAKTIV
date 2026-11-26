/**
 * Integration tests of the day's limit on xAPI statements per person and activity (D-121), on Redis: it is counted
 * beside the minute's limit, refuses a batch whole, and counts only what the minute allowed.
 *
 * Spec: LTI-011
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { connectRedis, type Redis } from '../../src/infra/redisClient.js';
import {
  XAPI_DAY_KEY_PREFIX,
  XAPI_RATE_KEY_PREFIX,
  XAPI_STATEMENTS_PER_DAY,
  XapiRateLimit,
} from '../../src/xapi/XapiRateLimit.js';
import { describeWithServices, serviceEnv } from '../support/services.js';

describeWithServices('[LTI-011] the day’s limit on statements', () => {
  let redis: Redis;
  beforeAll(async () => {
    redis = await connectRedis(serviceEnv().REDIS_URL);
  });
  /** The people of these tests; their counters are removed afterwards. */
  const people: string[] = [];
  const person = (): string => people[people.push(randomUUID()) - 1] as string;
  afterAll(async () => {
    const patterns = people.flatMap((id) => [
      `${XAPI_RATE_KEY_PREFIX}${id}:*`,
      `${XAPI_DAY_KEY_PREFIX}${id}:*`,
    ]);
    const keys = (await Promise.all(patterns.map((pattern) => redis.keys(pattern)))).flat();
    if (keys.length > 0) await redis.del(keys);
    await redis.quit();
  });

  it('[LTI-011] a batch that takes a person past the day’s limit for an activity is refused, with the time to wait', async () => {
    // Arrange: 120 a minute as in production, but 100 a day
    const limit = new XapiRateLimit(redis, 120, 60, 100);
    const [learner, neighbour, activity, other] = [person(), person(), randomUUID(), randomUUID()];
    // Act
    const allowed = [await limit.take(learner, activity, 50), await limit.take(learner, activity, 50)];
    const past = await limit.take(learner, activity, 1);
    const elsewhere = [await limit.take(learner, other, 50), await limit.take(neighbour, activity, 50)];
    // Assert
    expect(allowed).toEqual([{ allowed: true }, { allowed: true }]);
    expect(past.allowed).toBe(false);
    const wait = past.allowed ? 0 : past.retryAfterSeconds;
    expect(wait).toBeGreaterThan(60);
    expect(wait).toBeLessThanOrEqual(24 * 60 * 60);
    expect(elsewhere).toEqual([{ allowed: true }, { allowed: true }]);
  });

  it('[LTI-011] only what the minute’s limit allowed counts toward the day', async () => {
    // Arrange: 10 a minute, 100 a day
    const limit = new XapiRateLimit(redis, 10, 60, 100);
    const [learner, activity] = [person(), randomUUID()];
    // Act: one allowed batch, then batches the minute refuses
    const first = await limit.take(learner, activity, 10);
    const refused = [await limit.take(learner, activity, 50), await limit.take(learner, activity, 50)];
    // Assert
    expect(first).toEqual({ allowed: true });
    expect(refused.map((decision) => decision.allowed)).toEqual([false, false]);
    expect(await redis.get(`${XAPI_DAY_KEY_PREFIX}${learner}:${activity}`)).toBe('10');
    expect(XAPI_STATEMENTS_PER_DAY).toBe(3000);
  });
});
