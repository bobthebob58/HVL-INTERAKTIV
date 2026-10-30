/**
 * Integration tests of the grade-sync routes through the whole app (`createApp`): a Canvas teacher's launch records the
 * placement, and the teacher reads and retries its grade sync with the Bearer ltik; a Canvas learner is refused; the
 * owner's portal session reads every placement and needs the CSRF token to retry.
 *
 * Spec: LTI-012, LTI-006, LTI-003, AUTH-003
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../../../tools/mock-platform/mockPlatform.mjs';
import { CSRF_HEADER } from '../../../src/auth/session/csrfToken.js';
import { openAppTestbed, type AppTestbed } from '../../support/appTestbed.js';
import { loginWithFeide } from '../../support/feideTestbed.js';
import { launchFromCanvas } from '../../support/ltiLaunchDriver.js';
import { describeWithServices } from '../../support/services.js';
import { createJobs } from './support/gradeSyncFixture.js';

describeWithServices('[LTI-012] the grade-sync routes in the app', () => {
  let tb: AppTestbed;
  let contentId: string;
  let cookie: string;
  let csrf: string;
  const path = () => `/api/content/${contentId}/grade-sync`;
  const launch = async (user: (typeof CANVAS_USERS)[keyof typeof CANVAS_USERS]) =>
    (
      await launchFromCanvas(tb.app, tb.mock.canvas, {
        custom: { contentId },
        user,
        course: { id: 'grade-sync-course', label: 'SYK110' },
        lineItem: 'grade-sync-item',
      })
    ).ltik ?? '';

  beforeAll(async () => {
    tb = await openAppTestbed(undefined, { runAuthor: true });
    cookie = (await loginWithFeide({ app: tb.app, feide: tb.mock.feide }, 'author')).sessionCookie ?? '';
    csrf = (await request(tb.app).get('/auth/session').set('Cookie', cookie)).body.csrfToken as string;
    contentId = await tb.activity(await tb.feideAccount('author'), { published: true });
  }, 60_000);
  afterAll(() => tb?.close());

  it('[LTI-006] a Canvas teacher’s launch records the placement, whose grade sync the teacher reads and retries', async () => {
    // Arrange
    const ltik = await launch(CANVAS_USERS.teacher);
    const placement = await tb.db.ltiPlacement.findFirstOrThrow({ where: { contentId } });
    await createJobs(tb.db, placement.id, { succeeded: 1, failed: 2 });
    // Act
    const status = await request(tb.app).get(path()).set('Authorization', `Bearer ${ltik}`);
    const retry = await request(tb.app)
      .post(`${path()}/retry`)
      .set('Authorization', `Bearer ${ltik}`)
      .send({ placementId: placement.id });
    // Assert
    expect(status.status).toBe(200);
    expect(status.headers['cache-control']).toBe('no-store');
    expect(status.body.placements).toEqual([
      expect.objectContaining({
        placementId: placement.id,
        contextLabel: 'SYK110',
        graded: true,
        counts: { sent: 1, pending: 0, failed: 2, orphaned: 0 },
      }),
    ]);
    expect([retry.status, retry.body]).toEqual([200, { requeued: 2, stillFailed: 0 }]);
  });

  it('[LTI-012] a Canvas learner of the same course is refused, with the ltik in the header or not at all', async () => {
    // Act
    const ltik = await launch(CANVAS_USERS.student);
    const res = await request(tb.app).get(path()).set('Authorization', `Bearer ${ltik}`);
    const inQuery = await request(tb.app).get(`${path()}?ltik=${ltik}`);
    // Assert
    expect([res.status, res.body.errorCode]).toEqual([403, 'error.forbidden']);
    expect(inQuery.status).toBe(401);
  });

  it('[AUTH-003] the owner’s portal session reads the placements, and a retry needs the CSRF token', async () => {
    // Arrange
    const placement = await tb.db.ltiPlacement.findFirstOrThrow({ where: { contentId } });
    // Act
    const status = await request(tb.app).get(path()).set('Cookie', cookie);
    const without = await request(tb.app)
      .post(`${path()}/retry`)
      .set('Cookie', cookie)
      .send({ placementId: placement.id });
    const withToken = await request(tb.app)
      .post(`${path()}/retry`)
      .set('Cookie', cookie)
      .set(CSRF_HEADER, csrf)
      .send({ placementId: placement.id });
    // Assert
    expect(status.status).toBe(200);
    expect(status.body.placements).toHaveLength(1);
    expect([without.status, without.body.errorCode]).toEqual([401, 'hvl:csrf-invalid']);
    expect(withToken.status).toBe(200);
  });
});
