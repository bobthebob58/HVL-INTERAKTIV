/**
 * canvasServiceHttp — request and response helpers of the mock Canvas's LTI Advantage services: JSON bodies, media
 * types, bearer tokens, Canvas's two error shapes, and pages with Canvas's `Link` header.
 *
 * Why: the AGS line-item and score services (LTI-012) and NRPS (LTI-008) read and answer HTTP the same way; one
 *      module keeps their media types, error bodies and paging alike, and ./httpRouter.mjs stays the routing core.
 *      Sources are cited as canvas-platform-values.md §0 cites Canvas's (`C:`, the commit named there).
 * Spec: LTI-008, LTI-012
 * Invariants:
 *   - A body over 1 MiB, or one that is not a JSON object, reads as undefined; nothing here throws on client input.
 *   - Every answer carries `Cache-Control: no-store`. Errors have fixed text and never echo request data, in
 *     Canvas's two shapes: its LTI services' `{"errors": {"type", "message"}}`
 *     (C:`app/controllers/lti/ims/concerns/lti_services.rb:105-113`), and its generic API errors'
 *     `{"errors": [{"message"}]}` for a missing record or parameter
 *     (C:`app/controllers/application_controller.rb:2296,2309`).
 *   - Pages follow Canvas's `Api` paging (C:`lib/api.rb:413,511-545`): every page's `Link` lists `current`, `first`
 *     and `last`, and `next` and `prev` where they exist, joined by `,`; each link keeps the request's query except
 *     `page` and `per_page` (and `limit` where NRPS drops it) and ends with `page=<n>&per_page=<size>`. A request's
 *     `limit`, else its `per_page`, sets the size.
 * Collaborators: ./canvasLineItems.mjs, ./canvasScores.mjs, ./canvasMemberships.mjs, ./canvasTokenEndpoint.mjs.
 * Tests: tools/mock-platform/test/canvasAgs.test.mjs, tools/mock-platform/test/canvasNrps.test.mjs
 */
const MAX_BODY_BYTES = 1024 * 1024;

/**
 * Reads a JSON object body.
 * @param {import('node:http').IncomingMessage} req - The request.
 * @returns {Promise<Record<string, unknown> | undefined>} The object, or undefined for a body that is too large,
 *   not JSON, or not an object.
 */
export async function readJsonObject(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return undefined;
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The request's media type, without parameters such as `charset`.
 * @param {import('node:http').IncomingMessage} req - The request.
 * @returns {string} e.g. `application/vnd.ims.lis.v1.score+json`, lower-cased; empty when absent.
 */
export const mediaTypeOf = (req) =>
  String(req.headers['content-type'] ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();

/**
 * The bearer token of a request.
 * @param {import('node:http').IncomingMessage} req - The request.
 * @returns {string | undefined} The token after `Authorization: Bearer`, or undefined.
 */
export const bearerTokenOf = (req) => /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '')?.[1];

/**
 * Sends JSON under a service media type.
 * @param {import('node:http').ServerResponse} res - The response.
 * @param {number} status - HTTP status.
 * @param {string} mediaType - e.g. `application/vnd.ims.lis.v2.lineitem+json`.
 * @param {unknown} body - Serialised with `JSON.stringify`.
 * @param {Record<string, string>} [headers] - Extra headers, e.g. `Link`.
 */
export function sendMedia(res, status, mediaType, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': mediaType, 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

/** Rails's names for the statuses the services answer, as Canvas writes them into `errors.type`. */
const STATUS_TYPE = {
  400: 'bad_request',
  401: 'unauthorized',
  404: 'not_found',
  415: 'unsupported_media_type',
  422: 'unprocessable_entity',
};

/**
 * Sends a service error in the shape of Canvas's LTI services (`render_error`).
 * @param {import('node:http').ServerResponse} res - The response.
 * @param {number} status - HTTP status.
 * @param {string} message - Fixed text; never request data.
 */
export const sendServiceError = (res, status, message) =>
  sendMedia(res, status, 'application/json; charset=utf-8', {
    errors: { type: STATUS_TYPE[status] ?? 'error', message },
  });

/**
 * Sends a generic Canvas API error (`{"errors": [{"message"}]}`), as Canvas answers a missing record or parameter.
 * @param {import('node:http').ServerResponse} res - The response.
 * @param {number} status - HTTP status, 404 or 400.
 * @param {string} [message] - Fixed text; default Canvas's text for a missing record.
 */
export const sendApiError = (res, status, message = 'The specified resource does not exist.') =>
  sendMedia(res, status, 'application/json; charset=utf-8', { errors: [{ message }] });

/**
 * Cuts one page out of a list and builds Canvas's `Link` header for it.
 * @param {readonly unknown[]} items - The whole list, in order.
 * @param {URL} url - The request URL (absolute); its `limit` (else `per_page`) and `page` choose the page.
 * @param {{defaultLimit: number, maxLimit: number, dropLimit?: boolean}} sizes - The page size without `limit`,
 *   the largest one, and whether the links leave `limit` out.
 * @returns {{items: unknown[], headers: Record<string, string>}} The page and its `Link` header.
 */
export function pageOf(items, url, { defaultLimit, maxLimit, dropLimit = false }) {
  const whole = (name) => Number.parseInt(url.searchParams.get(name) ?? '', 10);
  const asked = [whole('limit'), whole('per_page')].find((value) => Number.isInteger(value) && value > 0);
  const size = asked === undefined ? defaultLimit : Math.min(asked, maxLimit);
  const last = Math.max(1, Math.ceil(items.length / size));
  const current = Math.max(1, whole('page') || 1);
  const query = new URLSearchParams(url.search);
  for (const name of ['page', 'per_page', ...(dropLimit ? ['limit'] : [])]) query.delete(name);
  const base = `${url.origin}${url.pathname}?${query.size > 0 ? `${query}&` : ''}`;
  const pages = { current, next: current < last ? current + 1 : undefined };
  Object.assign(pages, { prev: current > 1 ? current - 1 : undefined, first: 1, last });
  const link = Object.entries(pages)
    .filter(([, page]) => page !== undefined)
    .map(([rel, page]) => `<${base}page=${page}&per_page=${size}>; rel="${rel}"`)
    .join(',');
  return { items: items.slice((current - 1) * size, current * size), headers: { Link: link } };
}
