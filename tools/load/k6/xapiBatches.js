/**
 * xapiBatches — the requests a learner's player page sends while the activity is used: the xAPI bridge's batches
 * (the root `attempted` on opening, one question's `answered`, the root `completed` with the total) and H5P's
 * learner-state saves.
 *
 * Why: NFR-001's API limit is about these requests (D-114's load amendment of 2026-11-05). They have the shape the
 *      bridge sends after cutting (packages/hvl-h5p-theme/src/xapiStatements.js, D-115) and the contract checks
 *      (`xapiBatchSchema`), with the activity's real question IDs, so the server stores them as it would a learner's.
 * Spec: NFR-001, LTI-011
 * Invariants:
 *   - Pure: the caller gives the IDs (`uuid`), so k6 and Node build the same bodies.
 *   - Every batch names the page's activity and version; attempt IDs are `<viewId>:1` (one attempt per page load).
 *   - Each question scores 0 or 1 out of 1; the total is their sum, so `scaled` is always `raw / max`.
 *   - PRIVACY: no actor, name or free text: the answers are fixed tokens, as anonymous as the learners (DATA-012).
 * Collaborators: ./visit.js, ./playerPages.js (`playerContext`), packages/api-contract/src/xapi.ts.
 * Tests: tools/load/test/xapiBatches.test.mjs
 */

const VERB = (name) => ({ id: `http://adlnet.gov/expapi/verbs/${name}` });
const LOCAL_CONTENT_ID = 'http://h5p.org/x-api/h5p-local-content-id';
const SUBCONTENT_ID = 'http://h5p.org/x-api/h5p-subContentId';

/** How each question type answers, as H5P reports it (interaction type and response). */
const ANSWERS = Object.freeze({
  'H5P.MultiChoice': { interactionType: 'choice', response: '0' },
  'H5P.Blanks': { interactionType: 'fill-in', response: 'svar' },
  'H5P.DragText': { interactionType: 'fill-in', response: 'ord[,]ord' },
});

// WHY: the contract wants `scaled` exactly when `max` is above 0, as H5P's `setScoredResult` writes it (D-115).
const score = (raw, max) =>
  max > 0 ? { raw, max, min: 0, scaled: Math.round((raw / max) * 10000) / 10000 } : { raw, max, min: 0 };

/**
 * A batch of statements about the page's activity.
 * @param {{contentId: string, contentVersion: number}} page - From `playerContext`.
 * @param {object[]} statements - The cut statements.
 * @returns {object} The `POST /api/h5p/xapi` body.
 */
const batchOf = (page, statements) => ({
  contentId: page.contentId,
  contentVersion: page.contentVersion,
  statements,
});

/**
 * The root `attempted` H5P sends when the activity starts.
 * @param {ReturnType<import('./playerPages.js').playerContext>} page - The player page's context.
 * @param {{viewId: string, uuid: () => string}} view - The page load's ID and an ID maker.
 * @returns {object} The batch.
 */
export const attemptedBatch = (page, view) =>
  batchOf(page, [
    {
      statementId: view.uuid(),
      attemptId: `${view.viewId}:1`,
      verb: VERB('attempted'),
      object: { id: page.contentId, definition: { extensions: { [LOCAL_CONTENT_ID]: page.contentId } } },
      context: { contextActivities: { category: [{ id: page.category }] } },
    },
  ]);

/**
 * One question's `answered`, as a part of the activity.
 * @param {ReturnType<import('./playerPages.js').playerContext>} page - The player page's context.
 * @param {{viewId: string, uuid: () => string}} view - The page load's ID and an ID maker.
 * @param {{subContentId: string, library: string}} question - The question.
 * @param {boolean} right - Whether the answer scores.
 * @returns {object} The batch.
 */
export function answeredBatch(page, view, question, right) {
  const machineName = question.library.split(' ')[0];
  const answer = ANSWERS[machineName] ?? { interactionType: 'other', response: undefined };
  const definition = {
    interactionType: answer.interactionType,
    extensions: { [LOCAL_CONTENT_ID]: page.contentId, [SUBCONTENT_ID]: question.subContentId },
  };
  const category = `http://h5p.org/libraries/${question.library.replace(' ', '-')}`;
  return batchOf(page, [
    {
      statementId: view.uuid(),
      attemptId: `${view.viewId}:1`,
      verb: VERB('answered'),
      object: { id: `${page.contentId}?subContentId=${question.subContentId}`, definition },
      context: { contextActivities: { parent: [{ id: page.contentId }], category: [{ id: category }] } },
      result: {
        score: score(right ? 1 : 0, 1),
        success: right,
        completion: true,
        duration: 'PT4.2S',
        ...(answer.response === undefined ? {} : { response: answer.response }),
      },
    },
  ]);
}

/**
 * The root `completed` with the visit's total, as QuestionSet sends it on its summary.
 * @param {ReturnType<import('./playerPages.js').playerContext>} page - The player page's context.
 * @param {{viewId: string, uuid: () => string}} view - The page load's ID and an ID maker.
 * @param {{raw: number, max: number, seconds: number}} total - The score and the time spent.
 * @returns {object} The batch.
 */
export const completedBatch = (page, view, total) =>
  batchOf(page, [
    {
      statementId: view.uuid(),
      attemptId: `${view.viewId}:1`,
      verb: VERB('completed'),
      object: { id: page.contentId, definition: { extensions: { [LOCAL_CONTENT_ID]: page.contentId } } },
      context: { contextActivities: { category: [{ id: page.category }] } },
      result: {
        score: score(total.raw, total.max),
        success: total.raw * 2 >= total.max,
        completion: true,
        duration: `PT${Math.max(0, Math.round(total.seconds))}S`,
      },
    },
  ]);

/**
 * The form H5P posts to save a learner's state (H5P.setUserData with `preload` and `invalidate`).
 * @param {number} answered - How many questions are answered so far.
 * @param {number} questions - How many questions the activity has.
 * @returns {Record<string, string>} The `application/x-www-form-urlencoded` fields.
 */
export function stateSaveForm(answered, questions) {
  const answers = Array.from({ length: questions }, (_, i) => (i < answered ? [0] : []));
  const state = { progress: Math.min(answered, questions - 1), answers, questions: answers.map(() => ({})) };
  return { data: JSON.stringify(state), preload: '1', invalidate: '1' };
}

/**
 * A version 4 UUID from 16 random bytes (k6 has no `crypto.randomUUID` in every version).
 * @param {ArrayLike<number>} bytes - 16 random bytes.
 * @returns {string} The UUID in lower case.
 */
export function uuidFromBytes(bytes) {
  const b = Array.from(bytes, (n) => n & 0xff);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = b.map((n) => n.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
