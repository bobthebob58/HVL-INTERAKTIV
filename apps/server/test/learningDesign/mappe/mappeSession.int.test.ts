/**
 * Integration tests for the pedagogisk mappe routes through the whole app (D-094, D-089): a portal export must carry
 * the session's CSRF token, a real Canvas ltik is refused like a signed-out request, and an export logs neither the
 * author's name nor the activity's title. The permission matrix itself (./mappeRoutes.int.test.ts) injects its
 * principals.
 *
 * Spec: MAPPE-001, MAPPE-003, AUTH-003
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../../../tools/mock-platform/mockPlatform.mjs';
import { CSRF_HEADER } from '../../../src/auth/session/csrfToken.js';
import { openAppTestbed, type AppTestbed } from '../../support/appTestbed.js';
import { loginWithFeide } from '../../support/feideTestbed.js';
import { launchFromCanvas } from '../../support/ltiLaunchDriver.js';
import { studioContentWithMappe } from '../../support/mappeFixture.js';
import { describeWithServices } from '../../support/services.js';

const TITLE = 'Loggprøve med blåbær';
const EXPORT = '/api/mappe/export?format=md';

describeWithServices('[MAPPE-001] the pedagogisk mappe export through the whole app', () => {
  let tb: AppTestbed;
  let cookie: string;
  let csrf: string;
  let contentId: string;
  beforeAll(async () => {
    tb = await openAppTestbed(undefined, { runAuthor: true, studioContent: studioContentWithMappe() });
    cookie = (await loginWithFeide({ app: tb.app, feide: tb.mock.feide }, 'author')).sessionCookie ?? '';
    csrf = (await request(tb.app).get('/auth/session').set('Cookie', cookie)).body.csrfToken as string;
    contentId = await tb.activity(await tb.feideAccount('author'), { title: TITLE });
  }, 60_000);
  afterAll(() => tb?.close());

  it('[AUTH-003] refuses an export without the CSRF token and one with a Canvas ltik; with the token it answers the file', async () => {
    // Arrange
    const body = { contentIds: [contentId], locale: 'nn' };
    const { ltik } = await launchFromCanvas(tb.app, tb.mock.canvas, {
      messageType: 'LtiDeepLinkingRequest',
      user: { sub: `teacher-${Date.now()}`, roles: CANVAS_USERS.teacher.roles },
    });
    // Act
    const noCsrf = await request(tb.app).post(EXPORT).set('Cookie', cookie).send(body);
    const canvas = await request(tb.app)
      .post(EXPORT)
      .set('Authorization', `Bearer ${ltik ?? ''}`)
      .send(body);
    const exported = await request(tb.app)
      .post(EXPORT)
      .set('Cookie', cookie)
      .set(CSRF_HEADER, csrf)
      .send(body);
    // Assert
    expect(ltik).toBeTruthy();
    expect([noCsrf.status, noCsrf.body.errorCode]).toEqual([401, 'hvl:csrf-invalid']);
    expect([canvas.status, canvas.body.errorCode]).toEqual([401, 'hvl:unauthenticated']);
    expect(exported.status).toBe(200);
    expect(exported.text).toContain(`### ${TITLE}`);
  });

  it('[MAPPE-003] logs neither the author’s name nor the activity’s title while it makes the file', async () => {
    // Arrange
    const from = tb.logs.length;
    // Act
    const exported = await request(tb.app)
      .post(EXPORT)
      .set('Cookie', cookie)
      .set(CSRF_HEADER, csrf)
      .send({ contentIds: [contentId], locale: 'nn' });
    // Assert
    expect(exported.text).toContain('Aud Forfattar');
    const lines = tb.logs.slice(from).join('\n');
    expect(lines).not.toContain('Aud Forfattar');
    expect(lines).not.toContain(TITLE);
  });
});
