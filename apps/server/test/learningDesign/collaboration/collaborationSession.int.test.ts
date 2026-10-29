/**
 * Integration tests for the collaboration routes through the whole app (D-090, D-091, D-092, D-089): every write
 * must carry the session's CSRF token, and a real Canvas ltik is refused like a signed-out request on every route,
 * people search included, before anything is read or stored. The permission matrices (./coAuthorRoutes.int.test.ts
 * and the others) inject their principals.
 *
 * Spec: PROD-007, AUTH-003, LTI-006
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../../../tools/mock-platform/mockPlatform.mjs';
import { CSRF_HEADER } from '../../../src/auth/session/csrfToken.js';
import { openAppTestbed, type AppTestbed } from '../../support/appTestbed.js';
import { loginWithFeide } from '../../support/feideTestbed.js';
import { launchFromCanvas } from '../../support/ltiLaunchDriver.js';
import { describeWithServices } from '../../support/services.js';

const SOMEONE = '0192f0c4-0000-7000-8000-00000000d001';

describeWithServices('[PROD-007] the collaboration routes through the whole app', () => {
  let tb: AppTestbed;
  let cookie: string;
  let csrf: string;
  let contentId: string;
  let ltik: string;
  beforeAll(async () => {
    tb = await openAppTestbed(undefined, { runAuthor: true });
    cookie = (await loginWithFeide({ app: tb.app, feide: tb.mock.feide }, 'author')).sessionCookie ?? '';
    csrf = (await request(tb.app).get('/auth/session').set('Cookie', cookie)).body.csrfToken as string;
    contentId = await tb.activity(await tb.feideAccount('author'));
    const launch = await launchFromCanvas(tb.app, tb.mock.canvas, {
      messageType: 'LtiDeepLinkingRequest',
      user: { sub: `teacher-${Date.now()}`, roles: CANVAS_USERS.teacher.roles },
    });
    ltik = launch.ltik ?? '';
  }, 60_000);
  afterAll(() => tb?.close());

  /** The routes that change something, with their bodies. */
  const writes = () =>
    [
      ['post', `/api/content/${contentId}/coauthors`, { userId: SOMEONE }],
      ['delete', `/api/content/${contentId}/coauthors/${SOMEONE}`, undefined],
      ['put', `/api/content/${contentId}/bank`, { consentVersion: 1 }],
      ['delete', `/api/content/${contentId}/bank`, undefined],
      ['post', `/api/content/${contentId}/duplicate`, undefined],
    ] as const;

  it('[AUTH-003] refuses every write without the CSRF token, and changes nothing', async () => {
    // Act
    const answers = [];
    for (const [method, path, body] of writes())
      answers.push(await request(tb.app)[method](path).set('Cookie', cookie).send(body));
    // Assert
    for (const res of answers) expect([res.status, res.body.errorCode]).toEqual([401, 'hvl:csrf-invalid']);
    expect(await tb.db.h5PContent.count({ where: { sourceContentId: contentId } })).toBe(0);
    expect(await tb.db.auditEvent.count({ where: { targetId: contentId } })).toBe(0);
  });

  it('[LTI-006] a Canvas ltik is refused on every collaboration route, so a launch never searches HVL staff', async () => {
    // Act
    const reads = ['/api/people?q=Kari', '/api/bank', `/api/content/${contentId}/coauthors`];
    const answers = [];
    for (const path of reads)
      answers.push(await request(tb.app).get(path).set('Authorization', `Bearer ${ltik}`));
    for (const [method, path, body] of writes())
      answers.push(await request(tb.app)[method](path).set('Authorization', `Bearer ${ltik}`).send(body));
    // Assert
    expect(ltik).not.toBe('');
    for (const res of answers) expect([res.status, res.body.errorCode]).toEqual([401, 'hvl:unauthenticated']);
    expect(await tb.db.h5PContent.count({ where: { sourceContentId: contentId } })).toBe(0);
  });

  it('[PROD-007] with the token, the owner copies the activity (201) and searches (200), and no log line has the query', async () => {
    // Arrange
    const query = `Kari${randomUUID().slice(0, 8)}`;
    // Act
    const copied = await request(tb.app)
      .post(`/api/content/${contentId}/duplicate`)
      .set('Cookie', cookie)
      .set(CSRF_HEADER, csrf);
    const searched = await request(tb.app).get(`/api/people?q=${query}`).set('Cookie', cookie);
    const refused = await request(tb.app)
      .get(`/api/people?q=${query}${'x'.repeat(100)}`)
      .set('Cookie', cookie);
    // Assert
    expect(copied.status).toBe(201);
    expect(await tb.db.h5PContent.count({ where: { sourceContentId: contentId } })).toBe(1);
    expect([searched.status, refused.status]).toEqual([200, 400]);
    expect(tb.logs.join('\n')).not.toContain(query);
  });
});
