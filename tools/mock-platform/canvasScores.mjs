/**
 * canvasScores — the mock Canvas's AGS score service (`POST /api/lti/courses/:course/line_items/:id/scores`): it
 * checks each score as AGS 2.0 and Canvas do and records every post and every accepted score for tests.
 *
 * Why: D-104's grade worker posts LTI-012's score body to the line item's `/scores` URL. Tests of the worker need a
 *      platform that refuses what Canvas refuses, keeps the result order AGS requires, and shows afterwards
 *      exactly what arrived.
 * Spec: LTI-012
 * Invariants:
 *   - Checks run in the order of Canvas's `ScoresController` (C:`app/controllers/lti/ims/scores_controller.rb:75-86`),
 *     and the first problem decides the answer: a token with the `score` scope (401), a live line item (404,
 *     Canvas's generic error), then the body. Only then does the mock add its own rule: the media type must be
 *     `application/vnd.ims.lis.v1.score+json` (415). Canvas has no such check; it parses `application/json` too
 *     (C:`config/initializers/mime_types.rb:42,52`), so a client that sends another type passes there.
 *   - `userId` must be an active learner of the course, else 422 «User not found in course or is not a student»
 *     (C:`app/controllers/lti/ims/concerns/gradebook_services.rb:81-85`; Canvas also accepts a completed enrolment).
 *     Then `activityProgress`, `gradingProgress` and `timestamp` must be present (400, Canvas's generic «… is
 *     missing»), the timestamp ISO 8601 and not older than the stored result (400; an equal one is accepted,
 *     C:`…/scores_controller.rb:319-329`, as AGS 2.0 requires). With a `scoreGiven` and a `gradingProgress` of
 *     `FullyGraded` or `PendingManual`, `scoreMaximum` must be above 0 and `scoreGiven` at least 0 (422,
 *     C:`…/scores_controller.rb:342-367,551-553`); `scoreGiven` may exceed `scoreMaximum`. Progress values outside
 *     AGS 2.0's lists answer 400 *(verify: Canvas refuses them in its model)*.
 *   - Error texts are fixed and never echo the request (Canvas's own timestamp texts include the values).
 *   - Every post is recorded in `scorePosts` (status, problem codes, fault or not); accepted scores also in
 *     `scores`. An accepted score answers 200 with a `resultUrl`.
 * Collaborators: ./canvasServices.mjs, ./canvasLineItems.mjs, ./canvasMemberships.mjs, ./canvasTokenEndpoint.mjs,
 *   ./canvasFaults.mjs, ./canvasServiceHttp.mjs, ./ltiVocabulary.mjs.
 * Tests: tools/mock-platform/test/canvasAgs.test.mjs, tools/mock-platform/test/canvasScoreRules.test.mjs,
 *   tools/mock-platform/test/canvasScoreFaults.test.mjs
 */
import { applyFault } from './canvasFaults.mjs';
import { mediaTypeOf, readJsonObject, sendApiError, sendServiceError } from './canvasServiceHttp.mjs';
import { sendJson } from './httpRouter.mjs';
import { LTI_MEDIA_TYPE, LTI_SCOPE } from './ltiVocabulary.mjs';

/** AGS 2.0's `activityProgress` values. */
export const ACTIVITY_PROGRESS = Object.freeze([
  'Initialized',
  'Started',
  'InProgress',
  'Submitted',
  'Completed',
]);
/** AGS 2.0's `gradingProgress` values. */
export const GRADING_PROGRESS = Object.freeze([
  'FullyGraded',
  'Pending',
  'PendingManual',
  'Failed',
  'NotReady',
]);

const STATUS_OF = {
  'unsupported-media-type': 415,
  'unknown-user': 422,
  'bad-score-maximum': 422,
  'bad-score-given': 422,
};
const MESSAGE_OF = {
  'unsupported-media-type': 'Unsupported media type',
  'unknown-user': 'User not found in course or is not a student',
  'bad-timestamp': 'Provided timestamp is not a valid timestamp',
  'stale-timestamp': 'Provided timestamp is before the last updated timestamp',
  'bad-score-maximum': 'ScoreMaximum must be greater than 0 when ScoreGiven is present',
  'bad-score-given': 'ScoreGiven must be greater than or equal to 0',
};
const REQUIRED = {
  activityProgress: 'activity-progress',
  gradingProgress: 'grading-progress',
  timestamp: 'timestamp',
};
const ACCEPTS_SCORE = ['FullyGraded', 'PendingManual'];
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const isTimestamp = (value) =>
  typeof value === 'string' && ISO_TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value));
const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isPresent = (value) => value !== undefined && value !== null && value !== '';

/**
 * Lists what is wrong with a score post, in Canvas's check order.
 * @param {Record<string, unknown> | undefined} score - The parsed body; undefined when it was not a JSON object.
 * @param {{mediaType: string, isLearner: (userId: unknown) => boolean, storedTimestamp: (userId: unknown) =>
 *   string | undefined}} context - The request's media type, the roster check, and the learner's stored result time.
 * @returns {string[]} Problem codes; the first decides the answer; empty when the score is accepted.
 */
export function scoreProblems(score, { mediaType, isLearner, storedTimestamp }) {
  if (score === undefined) return ['invalid-json'];
  const problems = [];
  const check = (ok, code) => void (ok || problems.push(code));
  check(isLearner(score.userId), 'unknown-user');
  for (const [field, code] of Object.entries(REQUIRED)) check(isPresent(score[field]), `missing-${code}`);
  if (isPresent(score.timestamp)) {
    check(isTimestamp(score.timestamp), 'bad-timestamp');
    const stored = Date.parse(storedTimestamp(score.userId) ?? '');
    check(!(Date.parse(score.timestamp) < stored), 'stale-timestamp');
  }
  if (isPresent(score.scoreGiven) && ACCEPTS_SCORE.includes(score.gradingProgress)) {
    check(isNumber(score.scoreMaximum) && score.scoreMaximum > 0, 'bad-score-maximum');
    check(isNumber(score.scoreGiven) && score.scoreGiven >= 0, 'bad-score-given');
  }
  if (isPresent(score.activityProgress))
    check(ACTIVITY_PROGRESS.includes(score.activityProgress), 'bad-activity-progress');
  if (isPresent(score.gradingProgress))
    check(GRADING_PROGRESS.includes(score.gradingProgress), 'bad-grading-progress');
  check(mediaType === LTI_MEDIA_TYPE.score, 'unsupported-media-type');
  return problems;
}

/** Answers a refused score as Canvas would: a generic error for a missing field, its LTI shape otherwise. */
function refuse(res, problem) {
  const missing = Object.keys(REQUIRED).find((name) => `missing-${REQUIRED[name]}` === problem);
  if (missing !== undefined) sendApiError(res, 400, `${missing} is missing`);
  else sendServiceError(res, STATUS_OF[problem] ?? 400, MESSAGE_OF[problem] ?? 'Score refused');
}

/**
 * Creates the score service of one mock Canvas.
 * @param {{store: object, memberships: object, tokens: {authorize: Function}, faults: {take: Function}}} services -
 *   The line-item store, the rosters, the token service and the fault queues (target `scores`).
 * @returns {{scores: object[], scorePosts: object[], handle: Function}} The records and the route handler.
 */
export function createScoreService({ store, memberships, tokens, faults }) {
  const scores = [];
  const scorePosts = [];
  const latest = new Map();

  async function handle(req, res, { params }) {
    const receivedAt = new Date().toISOString();
    const lineItem = store.find(params.course, params.id);
    const lineItemUrl = lineItem?.id;
    const record = (entry) =>
      void scorePosts.push({ lineItemUrl, fault: false, problems: [], receivedAt, ...entry });
    const fault = faults.take('scores');
    if (await applyFault(res, fault)) return record({ ok: false, status: fault.status, fault: true });
    if (!tokens.authorize(req, res, [LTI_SCOPE.score])) return record({ ok: false, status: res.statusCode });
    if (!lineItem) {
      sendApiError(res, 404);
      return record({ ok: false, status: 404, problems: ['unknown-line-item'] });
    }
    const score = await readJsonObject(req);
    const resultKey = (userId) => `${lineItem.id}\n${userId}`;
    const problems = scoreProblems(score, {
      mediaType: mediaTypeOf(req),
      isLearner: (userId) => memberships.isActiveLearner(params.course, userId),
      storedTimestamp: (userId) => latest.get(resultKey(userId)),
    });
    if (problems.length > 0) {
      refuse(res, problems[0]);
      return record({ ok: false, status: res.statusCode, problems, score });
    }
    latest.set(resultKey(score.userId), score.timestamp);
    scores.push({ lineItemUrl, courseId: params.course, score, receivedAt });
    record({ ok: true, status: 200, score });
    sendJson(res, 200, { resultUrl: `${lineItemUrl}/results/${scores.length}` });
  }

  return { scores, scorePosts, handle };
}
