/**
 * Integration tests for `GET /api/content/:contentId/grade-sync`: each placement's jobs counted by state, oldest
 * first; every placement for the owner and co-authors, the launch's course only in Canvas; refusals for learners,
 * admins, colleagues and strangers; and nothing about a learner in the answer.
 *
 * Spec: LTI-012, LTI-006, LTI-007
 */
import { gradeSyncStatusResponseSchema } from '@hvl-interaktiv/api-contract';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Principal } from '../../../src/auth/Principal.js';
import { createPrismaClient } from '../../../src/infra/prismaClient.js';
import { describeWithServices, serviceEnv } from '../../support/services.js';
import { canvasPrincipal, gradeSyncAppAs, portalPrincipal } from './support/gradeSyncApp.js';
import { createGradeSyncFixture, createJobs, type GradeSyncFixture } from './support/gradeSyncFixture.js';

describeWithServices('[LTI-012] the grade-sync status', () => {
  const db = createPrismaClient(serviceEnv().DATABASE_URL);
  let fx: GradeSyncFixture;
  const status = (principal: Principal | undefined, contentId = fx.contentId) =>
    request(gradeSyncAppAs(db, principal)).get(`/api/content/${contentId}/grade-sync`);

  beforeAll(async () => {
    fx = await createGradeSyncFixture(db);
    await createJobs(db, fx.placements.a110, {
      succeeded: 3,
      pending: 2,
      failed: 1,
      failedWithoutSub: 1,
      orphaned: 1,
    });
    await createJobs(db, fx.placements.b200, { succeeded: 1 });
    await createJobs(db, fx.otherPlacement, { failed: 4 });
  });
  afterAll(async () => {
    await fx.close();
    await db.$disconnect();
  });

  it('[LTI-012] the owner sees every placement, oldest first, with its jobs counted by state', async () => {
    // Act
    const res = await status(portalPrincipal(fx.ownerId));
    // Assert
    expect(res.status).toBe(200);
    const body = gradeSyncStatusResponseSchema.parse(res.body);
    expect(body.contentId).toBe(fx.contentId);
    expect(body.placements).toEqual([
      {
        placementId: fx.placements.a110,
        platformName: 'HVL Canvas',
        contextLabel: 'SYK110',
        graded: true,
        attemptPolicy: 'best',
        masteryThreshold: null,
        counts: { sent: 3, pending: 2, failed: 2, orphaned: 1 },
      },
      expect.objectContaining({
        placementId: fx.placements.b200,
        platformName: 'HVL Canvas test',
        counts: { sent: 1, pending: 0, failed: 0, orphaned: 0 },
      }),
      {
        placementId: fx.placements.b110Ungraded,
        platformName: 'HVL Canvas test',
        contextLabel: 'SYK110',
        graded: false,
        attemptPolicy: 'mastery',
        masteryThreshold: 0.8,
        counts: { sent: 0, pending: 0, failed: 0, orphaned: 0 },
      },
    ]);
  });

  it('[LTI-012] a co-author sees the same placements; the path’s letter case does not matter', async () => {
    // Act
    const res = await status(portalPrincipal(fx.coAuthorId), fx.contentId.toUpperCase());
    // Assert
    expect(res.status).toBe(200);
    expect(res.body.contentId).toBe(fx.contentId);
    expect(res.body.placements).toHaveLength(3);
  });

  it('[LTI-012] PRIVACY: the answer names no learner, Canvas user, score or error', async () => {
    // Act
    const text = JSON.stringify((await status(portalPrincipal(fx.ownerId))).body);
    const jobs = await db.gradeSyncJob.findMany({ where: { placementId: fx.placements.a110 } });
    // Assert
    for (const job of jobs) {
      expect(text).not.toContain(job.learnerKey);
      expect(text).not.toContain(job.attemptId);
    }
    expect(text).not.toMatch(/learnerKey|ltiSub|scoreGiven|lastError|http-503/);
  });

  describe('[LTI-007] in Canvas', () => {
    it('[LTI-007] a teacher who does not own the activity sees only the launch’s course on its platform', async () => {
      // Act: a course copy's teacher launched the activity from SYK110 on platform B
      const teacher = canvasPrincipal(fx.colleagueId, {
        platformId: fx.platformB,
        contextId: 'SYK110',
        contentId: fx.contentId,
      });
      const res = await status(teacher);
      // Assert: SYK110 on platform A is another Canvas, though the course ID is the same (D-103)
      expect(res.status).toBe(200);
      expect(res.body.placements.map((p: { placementId: string }) => p.placementId)).toEqual([
        fx.placements.b110Ungraded,
      ]);
    });

    it('[LTI-012] the owner launching from Canvas sees that course only, not the portal’s full list', async () => {
      // Act
      const res = await status(
        canvasPrincipal(fx.ownerId, { platformId: fx.platformA, contextId: 'SYK110' }),
      );
      // Assert
      expect(res.status).toBe(200);
      expect(res.body.placements).toHaveLength(1);
      expect(res.body.placements[0]).toMatchObject({ placementId: fx.placements.a110 });
    });

    it('[LTI-012] the owner launched from a course the activity is not placed in, and a Canvas learner, get 403', async () => {
      // Act
      const otherCourse = await status(
        canvasPrincipal(fx.ownerId, { platformId: fx.platformA, contextId: 'ANNA300' }),
      );
      const learner = await status(
        canvasPrincipal(
          fx.colleagueId,
          { platformId: fx.platformA, contextId: 'SYK110', contentId: fx.contentId },
          ['learner'],
        ),
      );
      // Assert
      for (const res of [otherCourse, learner]) {
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ errorCode: 'error.forbidden' });
      }
    });

    it('[LTI-012] a teacher whose launch opened another activity cannot view this one: 404, as if unknown', async () => {
      // Act
      const res = await status(
        canvasPrincipal(fx.colleagueId, {
          platformId: fx.platformA,
          contextId: 'SYK110',
          contentId: fx.otherContentId,
        }),
      );
      // Assert
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ errorCode: 'hvl:activity-unavailable' });
    });
  });

  it('[LTI-012] a colleague who may only view, an admin who does not author it and a portal learner get 403', async () => {
    // Act
    const answers = await Promise.all([
      status(portalPrincipal(fx.colleagueId)),
      status(portalPrincipal(fx.colleagueId, ['author', 'admin'])),
      status(portalPrincipal(fx.ownerId, ['learner'])),
    ]);
    // Assert
    expect(answers.map((res) => res.status)).toEqual([403, 403, 403]);
  });

  it('[LTI-012] an unknown or malformed activity, or one the person may not view, is 404; nobody signed in 401', async () => {
    // Arrange
    await db.h5PContent.update({ where: { id: fx.otherContentId }, data: { visibility: 'private' } });
    // Act
    const unknown = await status(portalPrincipal(fx.ownerId), crypto.randomUUID());
    const malformed = await status(portalPrincipal(fx.ownerId), 'not-a-uuid');
    const hidden = await status(portalPrincipal(fx.colleagueId), fx.otherContentId);
    const anonymous = await status(undefined);
    // Assert
    for (const res of [unknown, malformed, hidden]) {
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ errorCode: 'hvl:activity-unavailable' });
    }
    expect(anonymous.status).toBe(401);
  });

  it('[LTI-012] an activity without placements answers an empty list to its owner', async () => {
    // Arrange
    const lone = await db.h5PContent.create({
      data: { mainLibrary: 'H5P.Blanks', title: 'L', params: {}, metadata: {}, ownerUserId: fx.ownerId },
    });
    try {
      // Act
      const res = await status(portalPrincipal(fx.ownerId), lone.id);
      // Assert
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ contentId: lone.id, placements: [] });
    } finally {
      await db.h5PContent.delete({ where: { id: lone.id } });
    }
  });
});
