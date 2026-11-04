/**
 * Integration test of the insight request limit on the test Redis: one window per person shared by the insight
 * routes, a 429 with `Retry-After` past it, and a counter that names the account only.
 *
 * Spec: INS-007, DATA-002
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import {
  INSIGHT_REQUEST_KEY_PREFIX,
  INSIGHT_REQUEST_LIMIT,
  InsightRateLimit,
} from '../../../src/insight/http/InsightRateLimit.js';
import { connectRedis, type Redis } from '../../../src/infra/redisClient.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';
import { openInsightHttpBench, portalPrincipal, type InsightHttpBench } from './support/insightHttpBench.js';

describeWithServices('[INS-007] the insight request limit', () => {
  let bench: InsightHttpBench;
  let redis: Redis;

  beforeAll(async () => {
    redis = await connectRedis(serviceEnv().REDIS_URL);
    bench = await openInsightHttpBench();
  }, 60_000);
  afterAll(async () => {
    await redis.del(`${INSIGHT_REQUEST_KEY_PREFIX}${bench.ownerId}`);
    await bench.close();
    await redis.quit();
  });

  it('[INS-007] the routes share one window per person; past it the answer is 429 with Retry-After', async () => {
    // Arrange
    const app = bench.appAs(portalPrincipal(bench.ownerId), { limit: new InsightRateLimit(redis, 2, 60) });
    const base = `/api/content/${bench.contentId}/insight`;
    // Act
    const contexts = await request(app).get(`${base}/contexts`);
    const view = await request(app).get(base);
    const third = await request(app).get(`${base}/export`);
    // Assert
    expect([contexts.status, view.status, third.status]).toEqual([200, 200, 429]);
    expect(Number(third.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(third.body.errorCode).toBe('hvl:rate-limited');
    expect(await redis.get(`${INSIGHT_REQUEST_KEY_PREFIX}${bench.ownerId}`)).toBe('3');
    expect(INSIGHT_REQUEST_LIMIT).toBe(60);
  });
});
