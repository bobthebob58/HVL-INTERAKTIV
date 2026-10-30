/**
 * Integration tests of the per-person copy limit (D-092 amendment 2026-10-29, S5 review) on the real content types:
 * an allowed copy counts once in Redis, an unknown source does not count, and past the limit both a duplicate and
 * «Lagre som ny versjon» are refused with 429 `hvl:rate-limited` (the route with `Retry-After`) and copy nothing.
 *
 * Spec: PROD-007, PROD-013
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { HvlH5pActor } from '../../../src/h5p/HvlH5pUser.js';
import { connectRedis, type Redis } from '../../../src/infra/redisClient.js';
import {
  COPY_KEY_PREFIX,
  COPY_LIMIT,
  COPY_WINDOW_SECONDS,
} from '../../../src/learningDesign/collaboration/CopyRateLimit.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';
import { storedActivity } from './duplicateFilesPasteSource.js';
import { openDuplicateRouteBench, type DuplicateRouteBench } from './duplicateRouteBench.js';

describeWithServices('[PROD-007] copies are limited per person', () => {
  describeWithRealPackages('[PROD-007] real content types', () => {
    let bench: DuplicateRouteBench;
    let redis: Redis;
    let sourceId: string;
    let counter: string;

    beforeAll(async () => {
      bench = await openDuplicateRouteBench();
      redis = await connectRedis(serviceEnv().REDIS_URL);
      sourceId = await bench.importExample('H5P.ImageHotspots', true);
      counter = COPY_KEY_PREFIX + bench.copier.actor.accountId;
    }, 180_000);
    afterAll(async () => {
      await redis?.del(counter);
      await redis?.quit();
      await bench?.close();
    });

    const duplicate = (actor: HvlH5pActor, id: string) =>
      request(bench.api)
        .post(`/api/content/${id}/duplicate`)
        .set(...bench.as(actor));

    it('[PROD-007] an allowed copy counts once in a ten-minute window; an unknown source does not count', async () => {
      // Arrange
      await redis.del(counter);
      // Act
      const copied = await duplicate(bench.copier.actor, sourceId);
      const unknown = await duplicate(bench.copier.actor, randomUUID());
      // Assert
      expect([copied.status, unknown.status]).toEqual([201, 404]);
      expect(await redis.get(counter)).toBe('1');
      expect(await redis.ttl(counter)).toBeGreaterThan(COPY_WINDOW_SECONDS - 60);
    }, 60_000);

    it('[PROD-007] past the limit a duplicate is 429 with Retry-After and «Lagre som ny versjon» is 429, copying nothing', async () => {
      // Arrange: the copier has used up the window, which ends in two minutes
      await redis.set(counter, String(COPY_LIMIT), { EX: 120 });
      const { params, metadata } = await storedActivity(bench.tb.db, sourceId);
      const before = await bench.copierActivityIds();
      // Act
      const res = await duplicate(bench.copier.actor, sourceId);
      const saved = await bench.duplicator
        .saveAsCopy(sourceId, params, metadata, bench.copier.actor)
        .catch((error: unknown) => error);
      // Assert
      expect([res.status, res.body.errorCode]).toEqual([429, 'hvl:rate-limited']);
      const retryAfter = Number(res.headers['retry-after']);
      expect(retryAfter >= 1 && retryAfter <= 120).toBe(true);
      expect(saved).toMatchObject({ status: 429, errorCode: 'hvl:rate-limited' });
      expect(await bench.copierActivityIds()).toEqual(before);
    }, 60_000);
  });
});
