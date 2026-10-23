/**
 * Integration tests for ltijs's cache on our node-redis client: prefixed keys, the TTL ltijs passes, misses.
 *
 * Spec: LTI-001, LTI-002
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { connectRedis, type Redis } from '../../../src/infra/redisClient.js';
import { LTI_CACHE_PREFIX, LtiCacheManager } from '../../../src/lti/storage/LtiCacheManager.js';
import { describeWithServices, serviceEnv, uniqueName } from '../../support/services.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
/** What ltijs caches: a platform's public JWKS (`oidc:jwks:<url>`) or the tool's keyset (`keyset:default`). */
const JWKS = [{ kty: 'RSA', kid: 'canvas-2026', n: 'AQAB-modulus', e: 'AQAB', alg: 'RS256', use: 'sig' }];

describeWithServices('[LTI-001] LtiCacheManager on Redis', () => {
  let redis: Redis;
  let cache: LtiCacheManager;
  const keys: string[] = [];
  const uniqueKey = () => keys[keys.push(`oidc:jwks:https://${uniqueName('jwks')}.example.test/jwks`) - 1]!;

  beforeAll(async () => {
    redis = await connectRedis(serviceEnv().REDIS_URL);
    cache = new LtiCacheManager(redis);
  });

  afterAll(async () => {
    if (keys.length > 0) await redis.del(keys.map((key) => LTI_CACHE_PREFIX + key));
    await redis.quit();
  });

  it('[LTI-001] stores the value as JSON under the hvli:lti:cache: prefix with the TTL ltijs passes', async () => {
    // Arrange
    const key = uniqueKey();
    // Act
    await cache.set(key, JWKS, 5 * 60 * 1000);
    // Assert
    expect(await cache.get(key)).toEqual(JWKS);
    expect(JSON.parse((await redis.get(LTI_CACHE_PREFIX + key)) ?? 'null')).toEqual(JWKS);
    expect(await redis.exists(key)).toBe(0);
    const ttl = await redis.pTTL(LTI_CACHE_PREFIX + key);
    expect(ttl).toBeGreaterThan(5 * 60 * 1000 - 5000);
    expect(ttl).toBeLessThanOrEqual(5 * 60 * 1000);
  });

  it('[LTI-001] a value is gone once its TTL has passed', async () => {
    // Arrange
    const key = uniqueKey();
    // WHY: 400 ms leaves the first read time to finish on a busy machine; the sleep then outlasts the TTL.
    await cache.set(key, JWKS, 400);
    // Act
    const before = await cache.get(key);
    await sleep(600);
    const after = await cache.get(key);
    // Assert
    expect(before).toEqual(JWKS);
    expect(after).toBeUndefined();
  });

  it('[LTI-001] never stores a value without a positive, finite TTL, nor an undefined value', async () => {
    // Arrange
    const key = uniqueKey();
    // Act
    for (const ttl of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) await cache.set(key, JWKS, ttl);
    await cache.set(key, undefined, 1000);
    // Assert
    expect(await redis.exists(LTI_CACHE_PREFIX + key)).toBe(0);
  });

  it('[LTI-001] delete removes a value; a missing or non-JSON value is a miss', async () => {
    // Arrange
    const [stored, foreign] = [uniqueKey(), uniqueKey()];
    await cache.set(stored, { keys: JWKS }, 60_000);
    await redis.set(LTI_CACHE_PREFIX + foreign, 'not json {', { PX: 60_000 });
    // Act
    await cache.delete(stored);
    // Assert
    expect(await cache.get(stored)).toBeUndefined();
    expect(await cache.get(foreign)).toBeUndefined();
    expect(await cache.get(uniqueKey())).toBeUndefined();
  });

  it('[LTI-001] listen and close leave the shared Redis client connected', async () => {
    // Act
    await cache.listen();
    await cache.close();
    // Assert
    expect(redis.isOpen).toBe(true);
    expect(await redis.ping()).toBe('PONG');
  });
});
