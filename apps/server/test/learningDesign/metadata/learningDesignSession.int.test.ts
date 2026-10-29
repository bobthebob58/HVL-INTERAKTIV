/**
 * Integration tests for the learning-design `PUT` through the whole app (D-087, D-089): a portal save must carry the
 * session's CSRF token, and a real Canvas ltik is refused like a signed-out request, before anything is stored. The
 * permission matrix itself (./learningDesignRoutes.int.test.ts) injects its principals.
 *
 * Spec: PED-030, AUTH-003
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../../../tools/mock-platform/mockPlatform.mjs';
import { CSRF_HEADER } from '../../../src/auth/session/csrfToken.js';
import { openAppTestbed, type AppTestbed } from '../../support/appTestbed.js';
import { loginWithFeide } from '../../support/feideTestbed.js';
import { launchFromCanvas } from '../../support/ltiLaunchDriver.js';
import { describeWithServices } from '../../support/services.js';

const BODY = { updatedAt: null, outcomes: [], phase: 'forarbeid' } as const;

describeWithServices('[PED-030] the learning-design PUT through the whole app', () => {
  let tb: AppTestbed;
  let cookie: string;
  let csrf: string;
  let contentId: string;
  beforeAll(async () => {
    tb = await openAppTestbed(undefined, { runAuthor: true });
    cookie = (await loginWithFeide({ app: tb.app, feide: tb.mock.feide }, 'author')).sessionCookie ?? '';
    csrf = (await request(tb.app).get('/auth/session').set('Cookie', cookie)).body.csrfToken as string;
    contentId = await tb.activity(await tb.feideAccount('author'));
  }, 60_000);
  afterAll(() => tb?.close());

  it('[AUTH-003] refuses a save without the CSRF token and one with a Canvas ltik with 401, storing nothing; with the token it is stored', async () => {
    // Arrange
    const path = `/api/content/${contentId}/learning-design`;
    const { ltik } = await launchFromCanvas(tb.app, tb.mock.canvas, {
      messageType: 'LtiDeepLinkingRequest',
      user: { sub: `teacher-${Date.now()}`, roles: CANVAS_USERS.teacher.roles },
    });
    const stored = () => tb.db.learningDesignMetadata.count({ where: { contentId } });
    // Act
    const noCsrf = await request(tb.app).put(path).set('Cookie', cookie).send(BODY);
    const canvas = await request(tb.app)
      .put(path)
      .set('Authorization', `Bearer ${ltik ?? ''}`)
      .send(BODY);
    const afterRefusals = await stored();
    const saved = await request(tb.app).put(path).set('Cookie', cookie).set(CSRF_HEADER, csrf).send(BODY);
    // Assert
    expect(ltik).toBeTruthy();
    expect([noCsrf.status, noCsrf.body.errorCode]).toEqual([401, 'hvl:csrf-invalid']);
    expect([canvas.status, canvas.body.errorCode]).toEqual([401, 'hvl:unauthenticated']);
    expect(afterRefusals).toBe(0);
    expect([saved.status, saved.body.phase]).toEqual([200, 'forarbeid']);
    expect(await stored()).toBe(1);
  });
});
