/**
 * canvasServiceControls — HTTP test controls for the mock Canvas's services under `/__mock/`, so a mock started by
 * the CLI can be made to fail and inspected from a browser or with curl.
 *
 * Why: tests in the same process call `canvas.tokens`, `canvas.ags` and `canvas.nrps` directly; a developer trying
 *      the grade bridge (LTI-012) or the NRPS count (LTI-008) against `npm run mock:platform` has only HTTP, as the
 *      mock Feide's `/__mock/next-login` offers for logins.
 * Spec: LTI-008, LTI-012
 * Invariants:
 *   - Parameters come from the query string or an `application/x-www-form-urlencoded` body (the body wins when
 *     both name one); a value out of range answers 400 with a fixed text that names the allowed values, never the
 *     value sent.
 *   - `POST /__mock/faults` queues a fault (./canvasFaults.mjs); `POST /__mock/line-items/delete` deletes a line
 *     item by URL; `POST /__mock/tokens/revoke` forgets every access token; `GET /__mock/services` shows line
 *     items, accepted scores, every score post and every token request.
 *   - The controls are a test double's: the mock listens on 127.0.0.1 and holds synthetic data only.
 * Collaborators: ./canvasServices.mjs, ./canvasFaults.mjs, ./httpRouter.mjs, ./cli.mjs (prints the URLs).
 * Tests: tools/mock-platform/test/canvasServiceControls.test.mjs
 */
import { FAULT_TARGETS } from './canvasFaults.mjs';
import { readForm, sendJson } from './httpRouter.mjs';

const NUMBER_FIELDS = ['count', 'status', 'retryAfter', 'delayMs'];

/** Query and form fields together; the form wins (`URLSearchParams.get` returns the first value). */
const paramsOf = async (req, query) =>
  new URLSearchParams([...(req.method === 'POST' ? await readForm(req) : []), ...query]);

/**
 * Serves the `/__mock/` controls of the services.
 * @param {{add: Function}} router - The mock Canvas router.
 * @param {{tokens: object, ags: object, faults: {add: Function, pending: Function}}} services - From
 *   ./canvasServices.mjs.
 */
export function registerServiceControls(router, { tokens, ags, faults }) {
  router.add('POST', '/__mock/faults', async (req, res, { query }) => {
    const params = await paramsOf(req, query);
    const target = params.get('target') ?? 'scores';
    if (!FAULT_TARGETS.includes(target)) {
      return sendJson(res, 400, { error: `target must be one of ${FAULT_TARGETS.join(', ')}` });
    }
    const spec = {};
    for (const field of NUMBER_FIELDS) if (params.has(field)) spec[field] = Number(params.get(field));
    if (params.has('error')) spec.error = params.get('error');
    try {
      const fault = faults.add(target, spec);
      sendJson(res, 200, { target, fault, pending: faults.pending(target) });
    } catch {
      sendJson(res, 400, {
        error:
          'a fault needs count 1–1000, status 400–599 and/or delayMs 0–120000, retryAfter 0–86400 seconds, ' +
          'error an OAuth error code (a–z and _)',
      });
    }
  });
  router.add('POST', '/__mock/line-items/delete', async (req, res, { query }) => {
    const url = (await paramsOf(req, query)).get('url') ?? '';
    sendJson(res, 200, { deleted: ags.deleteLineItem(url) });
  });
  router.add('POST', '/__mock/tokens/revoke', (_req, res) => {
    tokens.revokeAll();
    sendJson(res, 200, { revoked: true });
  });
  router.add('GET', '/__mock/services', (_req, res) =>
    sendJson(res, 200, {
      lineItems: ags.lineItems(),
      scores: ags.scores,
      scorePosts: ags.scorePosts,
      tokenRequests: tokens.requests,
    }),
  );
}
