/**
 * Integration tests of who the xAPI ingestion records, on PostgreSQL (D-138): a learner from another Feide
 * organisation, a Canvas observer and a Canvas launch without roles are answered like anyone else and store
 * nothing; and a version that is no longer current takes no new learner, while a learner already in it may finish.
 *
 * Spec: LTI-011, DATA-012, INS-006
 */
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Principal } from '../../src/auth/Principal.js';
import { describeWithServices } from '../support/services.js';
import { fixturePlay } from './support/xapiBridgeItems.js';
import { openXapiBench, type XapiBench } from './support/xapiBench.js';

const PLATFORM = '0192f0c4-5555-7000-8000-0000000000aa';
const MC = 'H5P.MultiChoice 1.16';

/** A Canvas learner's launch of `contentId` in `course`; `learnerRole` as the launch's roles claim gave it. */
const launchOf = (contentId: string, course: string, learnerRole: boolean): Partial<Principal> => ({
  mode: 'lti',
  hvlMember: false,
  feideAuthenticated: false,
  lti: {
    platformId: PLATFORM,
    deploymentId: 'd',
    contextId: course,
    contentId,
    messageType: 'LtiResourceLinkRequest',
    ...(learnerRole ? { learnerRole: true as const } : {}),
  },
});

describeWithServices('[LTI-011] whose statements are stored', () => {
  let bench: XapiBench;
  beforeAll(async () => {
    bench = await openXapiBench();
  });
  afterAll(() => bench.close());

  /** Posts one page load's full stream about the activity, naming `contentVersion`. */
  const play = (header: [string, string], contentId: string, contentVersion = 1) =>
    request(bench.app)
      .post('/api/h5p/xapi')
      .set(...header)
      .send({
        contentId,
        contentVersion,
        statements: fixturePlay('H5P.MultiChoice', contentId).views[0]?.statements ?? [],
      });
  const learnersOf = async (contentId: string, contentVersion?: number) =>
    new Set(
      (await bench.rowsOf(contentId))
        .filter((row) => contentVersion === undefined || row.contentVersion === contentVersion)
        .map((row) => row.learnerKey),
    );

  it('[LTI-011] stores nothing for a learner from another Feide organisation, and answers them like anyone', async () => {
    // Arrange: an activity shared with anyone with Feide, which a guest may open (D-059)
    const contentId = await bench.activity(MC);
    await bench.db.h5PContent.update({ where: { id: contentId }, data: { visibility: 'feide' } });
    const member = await bench.principal('learner');
    const guest = await bench.principal('learner', { hvlMember: false });
    const before = bench.calls.length;
    // Act
    const answers = [await play(guest.header, contentId), await play(member.header, contentId)];
    // Assert: the same answer, the member's rows only, and the listener (the grade enqueuer) hears of them only
    expect(answers.map((res) => [res.status, res.text])).toEqual([
      [202, ''],
      [202, ''],
    ]);
    expect(await learnersOf(contentId)).toEqual(new Set([member.principal.learnerKey]));
    expect(bench.calls.slice(before).map((call) => call.principal.learnerKey)).toEqual([
      member.principal.learnerKey,
    ]);
  });

  it('[LTI-011] stores a Canvas launch with the Learner role, and nothing for an observer or a launch without roles', async () => {
    // Arrange
    const contentId = await bench.activity(MC);
    const student = await bench.principal('learner', launchOf(contentId, 'course-1', true));
    const observer = await bench.principal('learner', launchOf(contentId, 'course-1', false));
    // Act
    const answers = [await play(observer.header, contentId), await play(student.header, contentId)];
    // Assert
    expect(answers.map((res) => res.status)).toEqual([202, 202]);
    expect(await learnersOf(contentId)).toEqual(new Set([student.principal.learnerKey]));
  });

  it('[INS-006] a version that is no longer current takes no new learner; a learner already in it may finish', async () => {
    // Arrange: one learner plays version 1, then the activity gets version 2
    const contentId = await bench.activity(MC);
    const early = await bench.principal('learner');
    const late = await bench.principal('learner');
    await play(early.header, contentId, 1);
    await bench.db.h5PContent.update({ where: { id: contentId }, data: { version: 2 } });
    const rowsBefore = (await bench.rowsOf(contentId)).length;
    // Act: a new learner names the old version; the first learner's old page reports again; the new one reloads
    const refused = await play(late.header, contentId, 1);
    const finished = await play(early.header, contentId, 1);
    const reloaded = await play(late.header, contentId, 2);
    // Assert: every answer is the same 202, and version 1 still holds the first learner alone
    expect([refused, finished, reloaded].map((res) => res.status)).toEqual([202, 202, 202]);
    expect(await learnersOf(contentId, 1)).toEqual(new Set([early.principal.learnerKey]));
    expect(await learnersOf(contentId, 2)).toEqual(new Set([late.principal.learnerKey]));
    expect((await bench.rowsOf(contentId)).length).toBeGreaterThan(rowsBefore + 2);
    // PRIVACY: the log holds a count, not the learner (DATA-009)
    expect(bench.logs.some((line) => line.includes('"closedVersion":'))).toBe(true);
    expect(bench.logs.join('\n')).not.toContain(late.principal.learnerKey);
  });

  it('[INS-006] being in an older version in one course does not open it in another course', async () => {
    // Arrange: the same pseudonym in two courses (a test's shortcut), with rows in course A's version 1 only
    const contentId = await bench.activity(MC);
    const inA = await bench.principal('learner', launchOf(contentId, 'course-a', true));
    const inB = await bench.principal('learner', {
      ...launchOf(contentId, 'course-b', true),
      learnerKey: inA.principal.learnerKey,
    });
    await play(inA.header, contentId, 1);
    await bench.db.h5PContent.update({ where: { id: contentId }, data: { version: 2 } });
    // Act
    await play(inB.header, contentId, 1);
    // Assert
    const courses = new Set((await bench.rowsOf(contentId)).map((row) => row.contextId));
    expect(courses).toEqual(new Set([`${PLATFORM}:course-a`]));
  });
});
