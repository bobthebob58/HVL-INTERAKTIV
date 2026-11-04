/**
 * Integration test of the insight services as the app builds them (`insightApi`) on PostgreSQL and Redis: *k* comes
 * from `MIN_GROUP_SIZE`, a Canvas course's completion base is the NRPS count stored in Redis, and every request is
 * counted by the Redis request limit.
 *
 * Spec: INS-001, INS-006, INS-007, LTI-008
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { S3ContentFileStore } from '../../../src/h5p/storage/S3ContentFileStore.js';
import { PrismaContentStorage } from '../../../src/h5p/storage/PrismaContentStorage.js';
import { insightApi } from '../../../src/insight/http/insightApi.js';
import { INSIGHT_REQUEST_KEY_PREFIX } from '../../../src/insight/http/InsightRateLimit.js';
import { connectRedis, type Redis } from '../../../src/infra/redisClient.js';
import { NRPS_COUNT_KEY_PREFIX, NrpsLearnerCountStore } from '../../../src/lti/nrps/NrpsLearnerCountStore.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';
import { canvasPrincipal, openInsightHttpBench, type InsightHttpBench } from './support/insightHttpBench.js';

describeWithServices('[INS-007] the insight services the app builds', () => {
  let bench: InsightHttpBench;
  let redis: Redis;

  beforeAll(async () => {
    redis = await connectRedis(serviceEnv().REDIS_URL);
    bench = await openInsightHttpBench();
  }, 60_000);
  afterAll(async () => {
    await redis.del([
      `${INSIGHT_REQUEST_KEY_PREFIX}${bench.colleagueId}`,
      `${NRPS_COUNT_KEY_PREFIX}${bench.fx.courseA}`,
    ]);
    await bench.close();
    await redis.quit();
  });

  it('[LTI-008] k is MIN_GROUP_SIZE, the course base is the stored NRPS count, and the request is counted', async () => {
    // Arrange
    await new NrpsLearnerCountStore(redis).save(bench.fx.courseA, 40, new Date());
    const services = insightApi({
      db: bench.db,
      redis,
      // WHY: only the parameters and metadata are read; the S3 file store is never touched here.
      content: new PrismaContentStorage(bench.db, {} as S3ContentFileStore),
      minGroupSize: 7,
    });
    const teacher = canvasPrincipal(bench.colleagueId, {
      platformId: bench.platformId,
      contextId: 'A',
      contentId: bench.contentId,
    });
    // Act
    const res = await request(bench.appAs(teacher, { services })).get(
      `/api/content/${bench.contentId}/insight`,
    );
    // Assert
    expect(res.status).toBe(200);
    expect(res.body.scope).toMatchObject({ k: 7, context: { key: bench.fx.courseA, label: 'PED101' } });
    expect(res.body.participation).toMatchObject({
      completionBase: 'course',
      courseLearners: { suppressed: false, value: 40 },
    });
    expect(await redis.get(`${INSIGHT_REQUEST_KEY_PREFIX}${bench.colleagueId}`)).toBe('1');
  });
});
