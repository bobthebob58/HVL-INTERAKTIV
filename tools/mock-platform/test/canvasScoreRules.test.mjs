/**
 * Tests for the score checks of the mock Canvas, in Canvas's order: the roster check, AGS 2.0's required fields and
 * value lists, the result order (a score older than the stored result is refused), the score values, and the mock's
 * own media-type rule.
 *
 * Spec: LTI-012
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CANVAS_USERS, LTI_ROLE } from '../mockPlatform.mjs';
import { scoreBody, startServiceBench } from './serviceBench.mjs';

let bench;
let token;
const COURSE = 'course-rules';
let url;

beforeAll(async () => {
  bench = await startServiceBench();
  token = await bench.token();
  url = bench.canvas.ags.addLineItem({ courseId: COURSE, label: 'Quiz', scoreMaximum: 100 }).id;
  bench.canvas.nrps.setMembers(COURSE, [
    { user_id: CANVAS_USERS.student.sub, roles: [LTI_ROLE.learner] },
    { user_id: CANVAS_USERS.teacher.sub, roles: [LTI_ROLE.instructor] },
    { user_id: 'left-the-course', roles: [LTI_ROLE.learner], status: 'Inactive' },
  ]);
});
afterAll(() => bench.close());

const at = (iso) => scoreBody({ timestamp: iso });
const refusal = async (response) => [response.status, (await response.json()).errors.message];
const lastProblems = () => bench.canvas.ags.scorePosts.at(-1).problems;

describe('[LTI-012] mock Canvas score checks', () => {
  it.each([
    ['another media type', scoreBody(), 'application/json', 415, 'unsupported-media-type'],
    ['a body that is no JSON object', '[1]', undefined, 400, 'invalid-json'],
    [
      'no userId, as Canvas looks the user up first',
      scoreBody({ userId: undefined }),
      undefined,
      422,
      'unknown-user',
    ],
    [
      'an unknown user before a missing timestamp',
      scoreBody({ userId: 'nobody', timestamp: undefined }),
      'application/json',
      422,
      'unknown-user',
    ],
    [
      'no gradingProgress',
      scoreBody({ gradingProgress: undefined }),
      undefined,
      400,
      'missing-grading-progress',
    ],
    [
      'a timestamp that is not ISO 8601',
      scoreBody({ timestamp: 'yesterday' }),
      undefined,
      400,
      'bad-timestamp',
    ],
    [
      'an unknown activityProgress',
      scoreBody({ activityProgress: 'Done' }),
      undefined,
      400,
      'bad-activity-progress',
    ],
    [
      'an unknown gradingProgress',
      scoreBody({ gradingProgress: 'Graded' }),
      undefined,
      400,
      'bad-grading-progress',
    ],
    ['a negative scoreGiven', scoreBody({ scoreGiven: -1 }), undefined, 422, 'bad-score-given'],
    [
      'scoreGiven without scoreMaximum',
      scoreBody({ scoreMaximum: undefined }),
      undefined,
      422,
      'bad-score-maximum',
    ],
    ['scoreMaximum 0', scoreBody({ scoreMaximum: 0 }), undefined, 422, 'bad-score-maximum'],
  ])('[LTI-012] refuses %s with %i', async (_name, body, type, status, problem) => {
    const response = await bench.postScore(url, body, token, type);
    expect(response.status).toBe(status);
    expect(lastProblems()[0]).toBe(problem);
  });

  it.each([
    ['someone outside the course', 'not-enrolled'],
    ['the teacher', CANVAS_USERS.teacher.sub],
    ['a learner whose enrolment is inactive', 'left-the-course'],
  ])("[LTI-012] refuses a score for %s with 422 and Canvas's text", async (_name, userId) => {
    const response = await bench.postScore(url, scoreBody({ userId }), token);
    expect(await refusal(response)).toEqual([422, 'User not found in course or is not a student']);
    expect(lastProblems()).toEqual(['unknown-user']);
  });

  it("[LTI-012] answers a missing field with Canvas's generic error", async () => {
    const response = await bench.postScore(url, scoreBody({ timestamp: undefined }), token);
    expect([response.status, await response.json()]).toEqual([
      400,
      { errors: [{ message: 'timestamp is missing' }] },
    ]);
  });

  it('[LTI-012] accepts scoreGiven above scoreMaximum, a score without scoreGiven, and skips score checks as Canvas does', async () => {
    // Arrange
    const unscored = { scoreGiven: undefined, scoreMaximum: undefined, activityProgress: 'Started' };
    // Act
    const extra = await bench.postScore(url, scoreBody({ scoreGiven: 110 }), token);
    const started = await bench.postScore(
      url,
      scoreBody({ ...unscored, gradingProgress: 'NotReady' }),
      token,
    );
    const pending = await bench.postScore(
      url,
      scoreBody({ scoreMaximum: undefined, gradingProgress: 'Pending' }),
      token,
    );
    // Assert
    expect([extra.status, started.status, pending.status]).toEqual([200, 200, 200]);
  });

  it('[LTI-012] accepts a learner the mock launched into the course, who was not in it before', async () => {
    // Arrange
    const user = { sub: `learner-${crypto.randomUUID()}`, roles: CANVAS_USERS.student.roles };
    const before = await bench.postScore(url, scoreBody({ userId: user.sub }), token);
    // Act
    await bench.launch({ user, course: { id: COURSE } });
    const after = await bench.postScore(url, scoreBody({ userId: user.sub }), token);
    // Assert
    expect([before.status, after.status]).toEqual([422, 200]);
  });
});

describe('[LTI-012] mock Canvas result order', () => {
  it('[LTI-012] refuses a score older than the stored result, accepts an equal or newer one, per learner', async () => {
    // Arrange
    const line = bench.canvas.ags.addLineItem({ courseId: COURSE, label: 'Order', scoreMaximum: 100 }).id;
    const posts = [
      at('2026-10-30T10:00:00.000Z'),
      at('2026-10-30T09:59:59.999Z'),
      at('2026-10-30T10:00:00.000Z'),
      at('2026-10-30T10:00:00.001Z'),
    ];
    // Act
    const statuses = [];
    for (const body of posts) statuses.push((await bench.postScore(line, body, token)).status);
    const older = await bench.postScore(line, at('2026-10-30T09:00:00.000Z'), token);
    const accepted = bench.canvas.ags.scores.filter((score) => score.lineItemUrl === line);
    // Assert
    expect(statuses).toEqual([200, 400, 200, 200]);
    expect(await refusal(older)).toEqual([400, 'Provided timestamp is before the last updated timestamp']);
    expect(lastProblems()).toEqual(['stale-timestamp']);
    expect(accepted.map((score) => score.score.timestamp)).toEqual(
      [posts[0], posts[2], posts[3]].map((b) => b.timestamp),
    );
  });

  it("[LTI-012] keeps each learner's result order apart", async () => {
    // Arrange
    const line = bench.canvas.ags.addLineItem({ courseId: COURSE, label: 'Apart', scoreMaximum: 100 }).id;
    const user = { sub: `learner-${crypto.randomUUID()}`, roles: [LTI_ROLE.learner] };
    await bench.launch({ user, course: { id: COURSE } });
    // Act
    await bench.postScore(line, at('2026-10-30T12:00:00.000Z'), token);
    const other = await bench.postScore(line, { ...at('2026-10-30T11:00:00.000Z'), userId: user.sub }, token);
    // Assert
    expect(other.status).toBe(200);
  });
});
