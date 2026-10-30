/**
 * Integration tests for `POST /api/content/:contentId/grade-sync/retry`: a placement's failed jobs become pending and
 * due now, except those whose encrypted Canvas user ID is gone; orphaned and sent jobs stay; each retry is audited
 * with its counts; another activity's or another course's placement is "not available"; and the per-person limit
 * answers 429 with `Retry-After` on the test Redis.
 *
 * Spec: LTI-012, DATA-007, DATA-002
 */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import {
  GRADE_SYNC_RETRY_KEY_PREFIX,
  GradeSyncRetryRateLimit,
} from '../../../src/grades/status/GradeSyncRetryRateLimit.js';
import { GRADE_SYNC_RETRY_ACTION } from '../../../src/grades/status/gradeSyncRetry.js';
import type { Principal } from '../../../src/auth/Principal.js';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { connectRedis, type Redis } from '../../../src/infra/redisClient.js';
import type { PersonLimit } from '../../../src/learningDesign/collaboration/PersonRateLimit.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';
import { canvasPrincipal, gradeSyncAppAs, portalPrincipal } from './support/gradeSyncApp.js';
import { createGradeSyncFixture, createJobs, type GradeSyncFixture } from './support/gradeSyncFixture.js';

describeWithServices('[LTI-012] retrying failed grade-sync jobs', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  const NOW = new Date('2026-11-02T09:00:00.000Z');
  let redis: Redis;
  let fx: GradeSyncFixture;
  const retry = (principal: Principal, body: unknown, retryLimit?: PersonLimit, contentId = fx.contentId) =>
    request(gradeSyncAppAs(db, principal, { clock: () => NOW, ...(retryLimit ? { retryLimit } : {}) }))
      .post(`/api/content/${contentId}/grade-sync/retry`)
      .send(body as object);
  const jobsOf = (placementId: string) =>
    db.gradeSyncJob.findMany({ where: { placementId }, orderBy: { createdAt: 'asc' } });

  beforeAll(async () => {
    redis = await connectRedis(serviceEnv().REDIS_URL);
    fx = await createGradeSyncFixture(db);
  });
  beforeEach(async () => {
    await db.gradeSyncJob.deleteMany({
      where: { placement: { contentId: { in: [fx.contentId, fx.otherContentId] } } },
    });
    await createJobs(db, fx.placements.a110, { succeeded: 2, failed: 2, failedWithoutSub: 1, orphaned: 1 });
    await createJobs(db, fx.otherPlacement, { failed: 1 });
  });
  afterAll(async () => {
    await fx.close();
    await db.$disconnect();
    await redis.quit();
  });

  it('[LTI-012] the owner requeues the failed jobs that can be sent; the rest stay as they were', async () => {
    // Act
    const res = await retry(portalPrincipal(fx.ownerId), { placementId: fx.placements.a110 });
    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ requeued: 2, stillFailed: 1 });
    const jobs = await jobsOf(fx.placements.a110);
    const pending = jobs.filter((job) => job.status === 'pending');
    expect(pending).toHaveLength(2);
    for (const job of pending) {
      expect(job).toMatchObject({ attempts: 0, lastError: null, terminalAt: null, nextAttemptAt: NOW });
      expect(job.ltiSubEncrypted).not.toBeNull();
    }
    expect(jobs.filter((job) => job.status === 'failed').map((job) => job.ltiSubEncrypted)).toEqual([null]);
    expect(jobs.filter((job) => job.status === 'orphaned')).toHaveLength(1);
    expect(jobs.filter((job) => job.status === 'succeeded')).toHaveLength(2);
    // Assert: the other activity's placement is untouched
    expect((await jobsOf(fx.otherPlacement)).map((job) => job.status)).toEqual(['failed']);
  });

  it('[DATA-007] each retry is audited with the placement, the counts and the mode, and nothing about a learner', async () => {
    // Act
    await retry(portalPrincipal(fx.coAuthorId), { placementId: fx.placements.a110.toUpperCase() });
    // Assert
    const audit = await db.auditEvent.findFirstOrThrow({
      where: { actorUserId: fx.coAuthorId, action: GRADE_SYNC_RETRY_ACTION },
      orderBy: { at: 'desc' },
    });
    expect(audit).toMatchObject({
      targetType: 'LtiPlacement',
      targetId: fx.placements.a110,
      details: { requeued: 2, stillFailed: 1, mode: 'portal' },
    });
  });

  it('[LTI-012] a placement of another activity, or of another course in Canvas, is not available: 404', async () => {
    // Act
    const otherActivity = await retry(portalPrincipal(fx.ownerId), { placementId: fx.otherPlacement });
    const otherCourse = await retry(
      canvasPrincipal(fx.ownerId, { platformId: fx.platformB, contextId: 'NAT200' }),
      { placementId: fx.placements.a110 },
    );
    const unknown = await retry(portalPrincipal(fx.ownerId), { placementId: crypto.randomUUID() });
    // Assert
    for (const res of [otherActivity, otherCourse, unknown]) {
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ errorCode: 'hvl:activity-unavailable' });
    }
    expect((await jobsOf(fx.placements.a110)).filter((job) => job.status === 'pending')).toHaveLength(0);
  });

  it('[LTI-012] a Canvas teacher retries the launch’s own course', async () => {
    // Act
    const teacher = canvasPrincipal(fx.colleagueId, {
      platformId: fx.platformA,
      contextId: 'SYK110',
      contentId: fx.contentId,
    });
    const res = await retry(teacher, { placementId: fx.placements.a110 });
    // Assert
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ requeued: 2, stillFailed: 1 });
  });

  it('[LTI-012] learners and colleagues are refused, a malformed body is 400, and nothing changes', async () => {
    // Act
    const learner = await retry(portalPrincipal(fx.ownerId, ['learner']), {
      placementId: fx.placements.a110,
    });
    const colleague = await retry(portalPrincipal(fx.colleagueId), { placementId: fx.placements.a110 });
    const malformed = await retry(portalPrincipal(fx.ownerId), { placementId: 'nope' });
    const extra = await retry(portalPrincipal(fx.ownerId), { placementId: fx.placements.a110, all: true });
    // Assert
    expect([learner.status, colleague.status, malformed.status, extra.status]).toEqual([403, 403, 400, 400]);
    expect((await jobsOf(fx.placements.a110)).filter((job) => job.status === 'pending')).toHaveLength(0);
  });

  it('[LTI-012] past the per-person limit the retry is 429 with Retry-After, changes nothing and is not audited', async () => {
    // Arrange: a limit of one retry per minute on the test Redis
    const limit = new GradeSyncRetryRateLimit(redis, 1, 60);
    await redis.del(GRADE_SYNC_RETRY_KEY_PREFIX + fx.ownerId);
    const owner = portalPrincipal(fx.ownerId);
    await retry(owner, { placementId: fx.placements.a110 }, limit);
    await db.gradeSyncJob.updateMany({
      where: { placementId: fx.placements.a110, status: 'pending' },
      data: { status: 'failed' },
    });
    const audits = () =>
      db.auditEvent.count({ where: { actorUserId: fx.ownerId, action: GRADE_SYNC_RETRY_ACTION } });
    const before = await audits();
    // Act
    const res = await retry(owner, { placementId: fx.placements.a110 }, limit);
    // Assert
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ errorCode: 'hvl:rate-limited' });
    expect(Number(res.headers['retry-after'])).toBeGreaterThanOrEqual(1);
    expect(await audits()).toBe(before);
    expect((await jobsOf(fx.placements.a110)).filter((job) => job.status === 'pending')).toHaveLength(0);
    // PRIVACY: the counter is keyed by the account only and holds a number
    expect(await redis.get(GRADE_SYNC_RETRY_KEY_PREFIX + fx.ownerId)).toBe('2');
    await redis.del(GRADE_SYNC_RETRY_KEY_PREFIX + fx.ownerId);
  });
});
