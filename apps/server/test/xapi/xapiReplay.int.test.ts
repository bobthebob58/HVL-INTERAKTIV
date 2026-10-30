/**
 * Integration tests of D-115's replay rule on PostgreSQL across requests: CoursePresentation's resume, a QuestionSet
 * re-submitted after a reload, and the scope of "the learner's latest result" (activity, course and version).
 *
 * Spec: DATA-012, LTI-012
 */
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Principal } from '../../src/auth/Principal.js';
import { describeWithServices } from '../support/services.js';
import { fixturePlay, rowLine } from './support/xapiBridgeItems.js';
import { openXapiBench, type XapiBench } from './support/xapiBench.js';

const QS = 'H5P.QuestionSet 1.21';
const QS_CATEGORY = 'http://h5p.org/libraries/H5P.QuestionSet-1.21';

/** A QuestionSet's root `completed` with this score, in a new page load. */
const finish = (contentId: string, raw: number) => ({
  statementId: randomUUID(),
  attemptId: `${randomUUID()}:1`,
  verb: { id: 'http://adlnet.gov/expapi/verbs/completed' },
  object: { id: contentId },
  context: { contextActivities: { category: [{ id: QS_CATEGORY }] } },
  result: { score: { raw, max: 9, scaled: Math.round((raw / 9) * 10000) / 10000 } },
});

describeWithServices('[DATA-012] replays across requests', () => {
  let bench: XapiBench;
  beforeAll(async () => {
    bench = await openXapiBench();
  });
  afterAll(() => bench.close());

  const post = (header: [string, string], contentId: string, statements: unknown[], contentVersion = 1) =>
    request(bench.app)
      .post('/api/h5p/xapi')
      .set(...header)
      .send({ contentId, contentVersion, statements });

  it('[DATA-012] does not store CoursePresentation’s completed that the resume re-sends after a reload', async () => {
    // Arrange
    const contentId = await bench.activity('H5P.CoursePresentation 1.28');
    const { header } = await bench.principal('learner');
    const [first, second] = fixturePlay('H5P.CoursePresentation', contentId, { bridgeOnly: true }).views;
    // Act
    await post(header, contentId, first?.statements ?? []);
    await post(header, contentId, second?.statements ?? []);
    // Assert
    expect((await bench.rowsOf(contentId)).map(rowLine)).toEqual([
      'attempted root #1',
      'answered part …0d22 1/1 #1',
      'completed root 1/1 #1',
      'attempted root #1',
    ]);
  });

  it('[DATA-012] drops a QuestionSet re-submitted unchanged after a reload, and keeps one with a new score', async () => {
    // Arrange
    const contentId = await bench.activity(QS);
    const { header } = await bench.principal('learner');
    // Act
    await post(header, contentId, [finish(contentId, 6)]);
    await post(header, contentId, [finish(contentId, 6)]);
    await post(header, contentId, [finish(contentId, 8)]);
    // Assert
    expect((await bench.rowsOf(contentId)).map(rowLine)).toEqual([
      'completed root 6/9 #1',
      'completed root 8/9 #1',
    ]);
  });

  it('[DATA-012] compares only with the learner’s latest result in the same course and version', async () => {
    // Arrange
    const contentId = await bench.activity(QS, { version: 2 });
    const learnerKey = `learner-${randomUUID()}`;
    const inCourse = (course: string): Partial<Principal> => ({
      learnerKey,
      mode: 'lti',
      hvlMember: false,
      feideAuthenticated: false,
      lti: {
        platformId: '0192f0c4-7777-7000-8000-0000000000aa',
        deploymentId: 'd',
        contextId: course,
        contentId,
        messageType: 'LtiResourceLinkRequest',
      },
    });
    const courseA = (await bench.principal('learner', inCourse('A'))).header;
    const courseB = (await bench.principal('learner', inCourse('B'))).header;
    // Act
    await post(courseA, contentId, [finish(contentId, 6)], 2);
    await post(courseB, contentId, [finish(contentId, 6)], 2);
    await post(courseA, contentId, [finish(contentId, 6)], 1);
    await post(courseA, contentId, [finish(contentId, 6)], 2);
    // Assert
    const rows = await bench.rowsOf(contentId);
    expect(rows.map((row) => `${row.contextId?.split(':')[1] ?? ''} v${row.contentVersion}`)).toEqual([
      'A v2',
      'B v2',
      'A v1',
    ]);
  });
});
