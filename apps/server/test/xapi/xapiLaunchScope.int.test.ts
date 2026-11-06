/**
 * Integration tests of what a Canvas launch may store through `POST /api/h5p/xapi`: statements about the launched
 * activity only, even where the permission matrix would let the learner view another; nothing from a launch outside a
 * course; and the academic year of the request, since an LTI principal's key is derived for each request.
 *
 * Spec: LTI-011, DATA-012
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Principal } from '../../src/auth/Principal.js';
import { describeWithServices } from '../support/services.js';
import { fixturePlay } from './support/xapiBridgeItems.js';
import { openXapiBench, type XapiBench } from './support/xapiBench.js';

const PLATFORM = '0192f0c4-8888-7000-8000-0000000000aa';
const MC = 'H5P.MultiChoice 1.16';

/** An LTI learner's launch of `contentId` in `course` ('' for a launch with no context claim). */
const launchOf = (contentId: string, course: string): Partial<Principal> => ({
  mode: 'lti',
  hvlMember: false,
  feideAuthenticated: false,
  lti: {
    platformId: PLATFORM,
    deploymentId: 'd',
    contextId: course,
    contentId,
    messageType: 'LtiResourceLinkRequest',
  },
});

describeWithServices('[LTI-011] what a Canvas launch may store', () => {
  let bench: XapiBench;
  beforeAll(async () => {
    bench = await openXapiBench();
  });
  afterAll(() => bench.close());

  /** A MultiChoice page load's full stream about an activity. */
  const statementsOf = (contentId: string) =>
    fixturePlay('H5P.MultiChoice', contentId).views[0]?.statements ?? [];
  const post = (header: [string, string], contentId: string) =>
    request(bench.app)
      .post('/api/h5p/xapi')
      .set(...header)
      .send({ contentId, contentVersion: 1, statements: statementsOf(contentId) });

  it('[LTI-011] refuses an activity the launch did not open, even one the learner could view (D-102)', async () => {
    // Arrange
    const [launched, other] = [await bench.activity(MC), await bench.activity(MC)];
    const { header, principal } = await bench.principal('learner', launchOf(launched, 'course-1'));
    // WHY: as a co-author the matrix lets them view it, so only the launch check stands between (defence in depth).
    await bench.db.contentCollaborator.create({ data: { contentId: other, userId: principal.userId } });
    // Act
    const res = await post(header, other);
    // Assert
    expect([res.status, res.body.errorCode]).toEqual([403, 'error.forbidden']);
    expect(await bench.rowsOf(other)).toEqual([]);
  });

  it('[DATA-012] stores nothing from a launch with no course and answers 202, never as a portal play (D-103)', async () => {
    // Arrange
    const contentId = await bench.activity(MC);
    const { header } = await bench.principal('learner', launchOf(contentId, ''));
    const before = bench.calls.length;
    // Act
    const res = await post(header, contentId);
    // Assert
    expect([res.status, res.text]).toEqual([202, '']);
    expect(await bench.rowsOf(contentId)).toEqual([]);
    expect(bench.calls.length).toBe(before);
    const counted = `"noCourse":${String(statementsOf(contentId).length)}`;
    expect(bench.logs.some((line) => line.includes(counted))).toBe(true);
  });

  it('[DATA-012] gives a Canvas learner’s rows the year of the request, whose key it was derived for (D-107)', async () => {
    // Arrange
    const contentId = await bench.activity(MC);
    const { header } = await bench.principal('learner', launchOf(contentId, 'course-2'));
    bench.now = new Date('2026-08-01T06:00:00.000Z');
    // Act
    await post(header, contentId);
    bench.now = undefined;
    // Assert
    expect((await bench.rowsOf(contentId)).map((row) => row.academicYear)).toEqual([2026, 2026]);
  });
});
