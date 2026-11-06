/**
 * Integration tests of the request log through the whole app: a Canvas launch, a play, an xAPI batch and requests
 * with an ltik and a learnerKey in the query write one line each with the route pattern, and no log line of the run
 * holds the ltik, the learner's `learnerKey` or a path with the activity's ID (D-109's amendment of 2026-11-04).
 *
 * Spec: NFR-006, DATA-009
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { deriveLearnerKey } from '../../src/privacy/deriveLearnerKey.js';
import { openAppTestbed, type AppTestbed } from '../support/appTestbed.js';
import { launchFromCanvas } from '../support/ltiLaunchDriver.js';
import { describeWithServices } from '../support/services.js';
import { fixturePlay } from '../xapi/support/xapiBridgeItems.js';

const INBOUND_ID = '0123456789abcdef0123456789abcdef';

describeWithServices('[NFR-006] the request log in the whole app', () => {
  let tb: AppTestbed;
  let contentId: string;
  let ltik: string;
  let learnerKey: string;
  let from: number;
  const responses: request.Response[] = [];
  beforeAll(async () => {
    tb = await openAppTestbed();
    contentId = await tb.activity(await tb.staffAccount(), { published: true });
    const sub = `request-log-${Date.now()}`;
    from = tb.logs.length;
    const launch = await launchFromCanvas(tb.app, tb.mock.canvas, {
      custom: { contentId },
      user: { sub, roles: CANVAS_USERS.student.roles },
      course: { id: 'request-log-course' },
    });
    ltik = launch.ltik ?? '';
    learnerKey = deriveLearnerKey(
      { kind: 'lti', issuer: tb.mock.canvas.issuer, subject: sub },
      tb.env.PSEUDONYM_SECRETS,
    );
    const statements =
      fixturePlay('H5P.MultiChoice', contentId, { bridgeOnly: true }).views[0]?.statements ?? [];
    const bearer = `Bearer ${ltik}`;
    responses.push(
      launch.res,
      await request(tb.app).get(`/h5p/play/${contentId}`).set('Authorization', bearer),
      await request(tb.app)
        .post('/api/h5p/xapi')
        .set('Authorization', bearer)
        .send({ contentId, contentVersion: 1, statements }),
      await request(tb.app).get(`/api/content/${contentId}?ltik=${ltik}&learnerKey=${learnerKey}`),
      await request(tb.app).get(`/h5p/play/${contentId}?ltik=${ltik}`).set('X-Request-Id', INBOUND_ID),
    );
  }, 60_000);
  afterAll(async () => {
    await tb?.db.xapiStatement.deleteMany({ where: { contentId } });
    await tb?.close();
  });

  /** The request log's lines of this run, once the last response has closed. */
  const requestLines = async (): Promise<Record<string, unknown>[]> => {
    await expect
      .poll(() => tb.logs.slice(from).filter((line) => line.includes('"msg":"request"')).length)
      .toBeGreaterThanOrEqual(5);
    return tb.logs
      .slice(from)
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((line) => line.msg === 'request');
  };

  it('[NFR-006] names each request by its route pattern, or its router’s mount when refused first, with the ID sent back', async () => {
    // Act
    const lines = await requestLines();
    // Assert
    const byId = new Map(lines.map((line) => [line.requestId, line]));
    const logged = responses.map((res) => byId.get(res.headers['x-request-id']));
    expect(logged.map((line) => [line?.method, line?.route, line?.status])).toEqual([
      ['POST', '/lti/launch', responses[0]?.status],
      ['GET', '/h5p/play/:contentId', responses[1]?.status],
      ['POST', '/api/h5p/xapi', 202],
      ['GET', '/api/*', 401],
      ['GET', '/h5p/*', 401],
    ]);
    expect(responses[4]?.headers['x-request-id']).toBe(INBOUND_ID);
  });

  it('[DATA-009] no log line holds the ltik, the learner’s learnerKey or a path with the activity’s ID', async () => {
    // Arrange: the key is the one the server stored for this learner, so the search is for the real value.
    const stored = await tb.db.xapiStatement.findMany({ where: { contentId }, select: { learnerKey: true } });
    // Act
    const lines = await requestLines();
    const text = tb.logs.slice(from).join('\n');
    // Assert
    expect(new Set(stored.map((row) => row.learnerKey))).toEqual(new Set([learnerKey]));
    expect(ltik.length).toBeGreaterThan(20);
    for (const secret of [ltik, learnerKey, `/h5p/play/${contentId}`, `/api/content/${contentId}`]) {
      expect(text).not.toContain(secret);
    }
    expect(JSON.stringify(lines)).not.toContain(contentId);
  });
});
