/**
 * Integration tests of `POST /api/h5p/xapi` through the whole app: who may send statements (a portal session with the
 * CSRF token, or an ltik as Bearer, never in the query), only about the launched activity in Canvas, and whose
 * statements are stored (learners only).
 *
 * Spec: LTI-011, LTI-003, AUTH-003, DATA-012
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { CSRF_HEADER } from '../../src/auth/session/csrfToken.js';
import { academicYearOf } from '../../src/privacy/academicYear.js';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { loginWithFeide } from '../support/feideTestbed.js';
import { launchFromCanvas } from '../support/ltiLaunchDriver.js';
import { describeWithServices } from '../support/services.js';
import { fixturePlay } from './support/xapiBridgeItems.js';

const XAPI = '/api/h5p/xapi';

describeWithServices('[LTI-011] who may send xAPI statements', () => {
  let tb: AppTestbed;
  let contentId: string;
  let other: string;
  beforeAll(async () => {
    tb = await openAppTestbed();
    const owner = await tb.staffAccount();
    contentId = await tb.activity(owner, { published: true });
    other = await tb.activity(owner, { published: true });
  }, 60_000);
  afterAll(() => tb?.close());

  /** A MultiChoice page load's statements about an activity, as the bridge sends them. */
  const batch = (id: string) => ({
    contentId: id,
    contentVersion: 1,
    statements: fixturePlay('H5P.MultiChoice', id, { bridgeOnly: true }).views[0]?.statements ?? [],
  });
  const rows = () => tb.db.xapiStatement.findMany({ where: { contentId }, orderBy: { timestamp: 'asc' } });
  const ltikOf = async (roles: readonly string[], sub: string) =>
    (
      await launchFromCanvas(tb.app, tb.mock.canvas, {
        custom: { contentId },
        user: { sub: `${sub}-${Date.now()}`, roles },
        course: { id: 'xapi-course' },
      })
    ).ltik ?? '';

  it('[LTI-011] refuses a batch from nobody with 401', async () => {
    const res = await request(tb.app).post(XAPI).send(batch(contentId));
    expect([res.status, res.body.errorCode]).toEqual([401, 'hvl:unauthenticated']);
  });

  it('[AUTH-003] stores a portal learner’s statements with the CSRF token, with no course, and refuses them without it', async () => {
    // Arrange
    await tb.db.xapiStatement.deleteMany({ where: { contentId } });
    const cookie =
      (await loginWithFeide({ app: tb.app, feide: tb.mock.feide }, 'student')).sessionCookie ?? '';
    const csrf = (await request(tb.app).get('/auth/session').set('Cookie', cookie)).body.csrfToken as string;
    // Act
    const without = await request(tb.app).post(XAPI).set('Cookie', cookie).send(batch(contentId));
    const res = await request(tb.app)
      .post(XAPI)
      .set('Cookie', cookie)
      .set(CSRF_HEADER, csrf)
      .send(batch(contentId));
    // Assert
    const stored = await rows();
    expect([without.status, without.body.errorCode]).toEqual([401, 'hvl:csrf-invalid']);
    expect([res.status, res.text]).toEqual([202, '']);
    expect(stored.map((row) => row.verb)).toEqual(['attempted', 'answered']);
    expect(stored.every((row) => row.contextId === null)).toBe(true);
    expect(stored[0]?.learnerKey).toMatch(/^[\w-]{43}$/);
    expect(stored[0]?.academicYear).toBe(academicYearOf(new Date()));
  });

  it('[LTI-003] stores a Canvas learner’s statements with the Bearer ltik under the launch’s course, never from the query', async () => {
    // Arrange
    await tb.db.xapiStatement.deleteMany({ where: { contentId } });
    const ltik = await ltikOf(CANVAS_USERS.student.roles, 'student');
    // Act
    const inQuery = await request(tb.app).post(`${XAPI}?ltik=${ltik}`).send(batch(contentId));
    const res = await request(tb.app)
      .post(XAPI)
      .set('Authorization', `Bearer ${ltik}`)
      .send(batch(contentId));
    // Assert
    expect([inQuery.status, inQuery.body.errorCode]).toEqual([401, 'hvl:ltik-invalid']);
    expect(res.status).toBe(202);
    expect((await rows()).map((row) => row.contextId)).toEqual([
      `${tb.platformId}:xapi-course`,
      `${tb.platformId}:xapi-course`,
    ]);
    expect(tb.logs.join('\n')).not.toContain(ltik);
  });

  it('[LTI-011] refuses a Canvas learner’s statements about any activity but the launched one with 403', async () => {
    // Arrange
    const ltik = await ltikOf(CANVAS_USERS.student.roles, 'student');
    // Act
    const res = await request(tb.app).post(XAPI).set('Authorization', `Bearer ${ltik}`).send(batch(other));
    // Assert
    expect([res.status, res.body.errorCode]).toEqual([403, 'error.forbidden']);
    expect(await tb.db.xapiStatement.count({ where: { contentId: other } })).toBe(0);
  });

  it('[LTI-011] answers a Canvas teacher’s batch 202 and stores nothing (D-102)', async () => {
    // Arrange
    await tb.db.xapiStatement.deleteMany({ where: { contentId } });
    const ltik = await ltikOf(CANVAS_USERS.teacher.roles, 'teacher');
    // Act
    const res = await request(tb.app)
      .post(XAPI)
      .set('Authorization', `Bearer ${ltik}`)
      .send(batch(contentId));
    // Assert
    expect([res.status, res.text]).toEqual([202, '']);
    expect(await rows()).toEqual([]);
  });
});
