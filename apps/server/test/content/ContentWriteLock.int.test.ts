/**
 * Integration tests for the activities' write lock on the test Redis: one holder per activity at a time (whatever
 * the ID's letter case), the wait limit, the lease that ends by itself, and the process-wide lock used without Redis.
 *
 * Spec: PROD-003
 */
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  InProcessContentWriteLock,
  RedisContentWriteLock,
  WRITE_LOCK_PREFIX,
  writeLockKey,
  type ContentWriteLock,
} from '../../src/content/ContentWriteLock.js';
import { isAuthError } from '../../src/http/authErrors.js';
import { connectRedis, type Redis } from '../../src/infra/redisClient.js';
import { describeWithServices, serviceEnv } from '../support/services.js';

const TIMING = { leaseMs: 400, waitMs: 150, pollMs: 10 };

/** Runs two holders of one activity that overlap if the lock lets them, and records the order of their steps. */
async function overlapOf(lock: ContentWriteLock, firstId: string, secondId: string): Promise<string[]> {
  const steps: string[] = [];
  const holder = (name: string) => async () => {
    steps.push(`${name} in`);
    await delay(150);
    steps.push(`${name} out`);
  };
  await Promise.all([lock.hold(firstId, holder('a')), lock.hold(secondId, holder('b'))]);
  return steps;
}

describeWithServices('[PROD-003] the activities’ write lock', () => {
  let redis: Redis;
  const keys: string[] = [];
  const activity = () => {
    const id = randomUUID();
    keys.push(WRITE_LOCK_PREFIX + id);
    return id;
  };

  beforeAll(async () => {
    redis = await connectRedis(serviceEnv().REDIS_URL);
  });
  afterAll(async () => {
    if (keys.length > 0) await redis.del(keys);
    await redis.quit();
  });

  it('[PROD-003] holders of one activity run one after the other; another activity runs alongside', async () => {
    // Arrange
    const lock = new RedisContentWriteLock(redis, { ...TIMING, waitMs: 2000 });
    const id = activity();
    // Act
    const same = await overlapOf(lock, id, id);
    const different = await overlapOf(lock, activity(), activity());
    // Assert
    expect(same).toEqual(['a in', 'a out', 'b in', 'b out']);
    expect(different.slice(0, 2).sort()).toEqual(['a in', 'b in']);
    expect(await redis.exists(WRITE_LOCK_PREFIX + id)).toBe(0);
  });

  it('[PROD-003] one activity is one lock whatever letter case its ID is spelt in, in Redis and in process', async () => {
    // Arrange
    const redisLock = new RedisContentWriteLock(redis, { ...TIMING, waitMs: 2000 });
    const id = activity();
    // Act
    const inRedis = await overlapOf(redisLock, id.toUpperCase(), id);
    const inProcess = await overlapOf(new InProcessContentWriteLock(), id, id.toUpperCase());
    // Assert
    expect(inRedis).toEqual(['a in', 'a out', 'b in', 'b out']);
    expect(inProcess).toEqual(['a in', 'a out', 'b in', 'b out']);
    expect(writeLockKey(id.toUpperCase())).toBe(WRITE_LOCK_PREFIX + id);
  });

  it('[PROD-003] a caller that waits longer than the wait gets 409 hvl:content-changed and never runs', async () => {
    // Arrange
    const lock = new RedisContentWriteLock(redis, TIMING);
    const id = activity();
    let ran = false;
    // Act
    const holding = lock.hold(id, () => delay(300));
    const waiting = await lock
      .hold(id, async () => {
        ran = true;
      })
      .catch((error: unknown) => error);
    await holding;
    // Assert
    expect(isAuthError(waiting, 'hvl:content-changed')).toBe(true);
    expect(ran).toBe(false);
  });

  it('[PROD-003] a lease ends by itself, and a late holder never frees the lock of the one after it', async () => {
    // Arrange
    const shortLease = new RedisContentWriteLock(redis, { ...TIMING, leaseMs: 60 });
    const longLease = new RedisContentWriteLock(redis, { ...TIMING, leaseMs: 2000, waitMs: 1000 });
    const id = activity();
    let releaseSecond = (): void => undefined;
    const secondHolds = new Promise<void>((resolve) => (releaseSecond = resolve));
    // Act
    const slow = shortLease.hold(id, () => delay(200));
    await delay(20);
    const second = longLease.hold(id, () => secondHolds);
    await slow;
    await delay(20);
    const stillHeld = await redis.exists(WRITE_LOCK_PREFIX + id);
    releaseSecond();
    await second;
    // Assert
    expect(stillHeld).toBe(1);
    expect(await redis.exists(WRITE_LOCK_PREFIX + id)).toBe(0);
  });

  it('[PROD-003] work that fails frees the lock and rethrows; the in-process lock serialises the same way', async () => {
    // Arrange
    const redisLock = new RedisContentWriteLock(redis, TIMING);
    const local = new InProcessContentWriteLock();
    const id = activity();
    const failing = () => Promise.reject(new Error('save failed'));
    // Act
    const redisFailure = await redisLock.hold(id, failing).catch((error: unknown) => error);
    const localFailure = await local.hold(id, failing).catch((error: unknown) => error);
    const afterFailure = await redisLock.hold(id, async () => 'saved');
    const localSteps = await overlapOf(local, id, id);
    // Assert
    expect([redisFailure, localFailure].map((e) => (e as Error).message)).toEqual([
      'save failed',
      'save failed',
    ]);
    expect(afterFailure).toBe('saved');
    expect(localSteps).toEqual(['a in', 'a out', 'b in', 'b out']);
  });
});
