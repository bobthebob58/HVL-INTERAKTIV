/**
 * canvasLineItems — the mock Canvas's AGS line items: an in-memory store per course and the line-item service
 * (`GET`/`POST /api/lti/courses/:course/line_items`, `GET …/line_items/:id`).
 *
 * Why: D-104's grade worker confirms a 404 on a score post with a `lineitem.readonly` read before it marks a job
 *      orphaned (LTI-012), and a graded placement's launch names its line item in the AGS claim. Tests need line
 *      items that exist, that can be deleted as a teacher deletes an assignment, and a service that answers as AGS
 *      2.0 and Canvas do.
 * Spec: LTI-012
 * Invariants:
 *   - A line item's `id` is its URL, `<origin>/api/lti/courses/<course>/line_items/<id>`, the form the launch claim
 *     carries (./canvasIdTokens.mjs); an ID is never reused, also after deletion.
 *   - A deleted or unknown line item is a 404 with Canvas's generic error for every read and for score posts; lists
 *     leave it out.
 *   - Reads need the `lineitem` or `lineitem.readonly` scope, creating needs `lineitem` (401 otherwise, as Canvas,
 *     C:`app/controllers/lti/ims/line_items_controller.rb:81-87`); a new line item needs a `label` and a
 *     `scoreMaximum` above 0 (AGS 2.0 §3.2), is sent as line-item JSON (415 otherwise, the mock's own rule) and
 *     answers 201 (C:`…/line_items_controller.rb:159-161`).
 *   - A list filters by `resource_link_id`, `resource_id` and `tag` and pages as Canvas's `Api` does
 *     (./canvasServiceHttp.mjs): 10 a page by default, `limit` or `per_page` up to 100 (C:`lib/api.rb:22-23`; Canvas
 *     does not cap an AGS `limit` *(verify)*).
 * Collaborators: ./canvasServices.mjs, ./canvasScores.mjs, ./canvasTokenEndpoint.mjs, ./canvasFaults.mjs,
 *   ./canvasServiceHttp.mjs, ./ltiVocabulary.mjs.
 * Tests: tools/mock-platform/test/canvasAgs.test.mjs
 */
import { applyFault } from './canvasFaults.mjs';
import {
  mediaTypeOf,
  pageOf,
  readJsonObject,
  sendApiError,
  sendMedia,
  sendServiceError,
} from './canvasServiceHttp.mjs';
import { LTI_MEDIA_TYPE, LTI_SCOPE } from './ltiVocabulary.mjs';

const READ_SCOPES = [LTI_SCOPE.lineItem, LTI_SCOPE.lineItemReadonly];
const OPTIONAL_TEXT = ['resourceLinkId', 'resourceId', 'tag'];
const isText = (value) => typeof value === 'string' && value !== '';

/**
 * Lists what is wrong with a new line item.
 * @param {Record<string, unknown>} spec - Its fields.
 * @returns {string[]} Problem codes (`bad-label`, `bad-score-maximum`, `bad-<field>`); empty when valid.
 */
export function lineItemProblems(spec) {
  const problems = [];
  if (!isText(spec.label) || spec.label.length > 255) problems.push('bad-label');
  const max = spec.scoreMaximum;
  if (!(typeof max === 'number' && Number.isFinite(max) && max > 0)) problems.push('bad-score-maximum');
  for (const field of OPTIONAL_TEXT)
    if (spec[field] !== undefined && !isText(spec[field])) problems.push(`bad-${field}`);
  return problems;
}

/**
 * Creates the line-item store of one mock Canvas.
 * @param {string} origin - The mock Canvas's origin.
 * @returns {object} `add(courseId, spec)`, `ensure(courseId, id, resourceLinkId)`, `find(courseId, id)`,
 *   `remove(url)` and `list(courseId?)`; line items are returned as AGS JSON.
 */
export function createLineItemStore(origin) {
  const items = new Map();
  let counter = 0;
  const keyOf = (courseId, id) => `${courseId}\n${id}`;
  const json = ({ url, label, scoreMaximum, ...rest }) => ({
    id: url,
    label,
    scoreMaximum,
    ...Object.fromEntries(
      OPTIONAL_TEXT.filter((field) => rest[field] !== undefined).map((f) => [f, rest[f]]),
    ),
  });
  const live = (item) => (item && !item.deleted ? json(item) : undefined);
  const nextFreeId = (courseId) => {
    counter += 1;
    while (items.has(keyOf(courseId, String(counter)))) counter += 1;
    return String(counter);
  };

  function add(courseId, spec) {
    const problems = lineItemProblems(spec);
    if (problems.length > 0) throw new RangeError(`invalid line item: ${problems.join(', ')}`);
    const id = spec.id === undefined ? nextFreeId(courseId) : String(spec.id);
    if (items.has(keyOf(courseId, id))) throw new RangeError(`line item ${id} already exists`);
    const url = `${origin}/api/lti/courses/${encodeURIComponent(courseId)}/line_items/${id}`;
    const item = { url, courseId, deleted: false, label: spec.label, scoreMaximum: spec.scoreMaximum };
    for (const field of OPTIONAL_TEXT) if (spec[field] !== undefined) item[field] = spec[field];
    items.set(keyOf(courseId, id), item);
    return json(item);
  }

  return {
    add,
    ensure(courseId, id, resourceLinkId) {
      if (items.has(keyOf(courseId, id))) return;
      add(courseId, {
        id,
        label: 'Mock activity',
        scoreMaximum: 100,
        ...(resourceLinkId && { resourceLinkId }),
      });
    },
    find: (courseId, id) => live(items.get(keyOf(courseId, id))),
    remove(url) {
      const item = [...items.values()].find((candidate) => candidate.url === url && !candidate.deleted);
      if (item) item.deleted = true;
      return item !== undefined;
    },
    list: (courseId) =>
      [...items.values()]
        .filter((item) => courseId === undefined || item.courseId === courseId)
        .map(live)
        .filter(Boolean),
  };
}

/**
 * Serves the line-item service.
 * @param {{add: Function}} router - The mock Canvas router.
 * @param {{store: object, tokens: {authorize: Function}, faults: {take: Function}, origin: string}} services -
 *   The store, the token service, the fault queues (target `lineItems`) and the mock Canvas's origin.
 */
export function registerLineItemRoutes(router, { store, tokens, faults, origin }) {
  const base = '/api/lti/courses/:course/line_items';
  router.add('GET', base, async (req, res, { url, params }) => {
    if (await applyFault(res, faults.take('lineItems'))) return;
    if (!tokens.authorize(req, res, READ_SCOPES)) return;
    const filters = { resourceLinkId: 'resource_link_id', resourceId: 'resource_id', tag: 'tag' };
    const wanted = Object.entries(filters).filter(([, query]) => url.searchParams.has(query));
    const matching = store
      .list(params.course)
      .filter((item) => wanted.every(([field, query]) => item[field] === url.searchParams.get(query)));
    const page = pageOf(matching, new URL(url.pathname + url.search, origin), {
      defaultLimit: 10,
      maxLimit: 100,
    });
    sendMedia(res, 200, LTI_MEDIA_TYPE.lineItemContainer, page.items, page.headers);
  });
  router.add('POST', base, async (req, res, { params }) => {
    if (!tokens.authorize(req, res, [LTI_SCOPE.lineItem])) return;
    const type = mediaTypeOf(req);
    if (type !== LTI_MEDIA_TYPE.lineItem && type !== 'application/json') {
      return sendServiceError(res, 415, 'Unsupported media type');
    }
    const spec = await readJsonObject(req);
    const problems = spec === undefined ? ['invalid-json'] : lineItemProblems(spec);
    if (problems.length > 0) return sendServiceError(res, 400, `Line item refused: ${problems.join(', ')}`);
    // WHY: the platform names a new line item; an `id` in the body must not pick or collide with a stored one.
    sendMedia(res, 201, LTI_MEDIA_TYPE.lineItem, store.add(params.course, { ...spec, id: undefined }));
  });
  router.add('GET', `${base}/:id`, async (req, res, { params }) => {
    if (await applyFault(res, faults.take('lineItems'))) return;
    if (!tokens.authorize(req, res, READ_SCOPES)) return;
    const item = store.find(params.course, params.id);
    if (!item) return sendApiError(res, 404);
    sendMedia(res, 200, LTI_MEDIA_TYPE.lineItem, item);
  });
}
