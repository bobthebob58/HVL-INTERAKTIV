/**
 * canvasFaults — fault injection for the mock Canvas's services: the next N requests to the token endpoint, the
 * score service, the line-item service or the membership service answer an error, a 429 with `Retry-After`, or
 * arrive late.
 *
 * Why: the grade worker (LTI-012, D-104) retries a 429, a 5xx or a network error with backoff, treats a 404 that a
 *      line-item read confirms as orphaned and fails any other 4xx at once; the NRPS count (LTI-008) must survive
 *      an unavailable Canvas. Tests need Canvas to fail on purpose, as the mock Feide's `setGroupsFailure` does.
 * Spec: LTI-008, LTI-012
 * Invariants:
 *   - Faults queue per target and are used oldest first; one request takes at most one fault, and a fault with
 *     `count` N answers exactly N requests. A service takes its fault before any other check (token, line item),
 *     as an overloaded Canvas or a proxy in front of it would answer.
 *   - A fault with `delayMs` waits first; without a `status` the request is then served normally, so a delay alone
 *     tests a client's timeout.
 *   - A fault's answer is fixed text: it never echoes request data.
 * Collaborators: ./canvasServices.mjs (owns the queues), ./canvasTokenEndpoint.mjs, ./canvasLineItems.mjs,
 *   ./canvasScores.mjs, ./canvasMemberships.mjs, ./canvasServiceControls.mjs, ./httpRouter.mjs.
 * Tests: tools/mock-platform/test/canvasFaults.test.mjs, tools/mock-platform/test/canvasScoreFaults.test.mjs
 */
import { sendJson } from './httpRouter.mjs';

/** The services a fault can target. */
export const FAULT_TARGETS = Object.freeze(['token', 'scores', 'lineItems', 'memberships']);

const MAX_DELAY_MS = 120_000;
const isWhole = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

/**
 * Checks and completes a fault description.
 * @param {{count?: number, status?: number, retryAfter?: number, delayMs?: number, error?: string}} [spec] -
 *   `status` 400–599; `retryAfter` seconds (sent as `Retry-After`); `delayMs` up to 120 000; `error` an OAuth
 *   error code for the body instead of Canvas's `errors` list.
 * @returns {{count: number, status?: number, retryAfter?: number, delayMs: number, error?: string}} The fault.
 * @throws {RangeError} For a value out of range, or a fault with neither a status nor a delay.
 */
export function normaliseFault(spec = {}) {
  const { count = 1, status, retryAfter, delayMs = 0, error } = spec;
  if (!isWhole(count, 1, 1000)) throw new RangeError('fault count must be a whole number from 1 to 1000');
  if (status !== undefined && !isWhole(status, 400, 599))
    throw new RangeError('fault status must be 400–599');
  if (retryAfter !== undefined && !isWhole(retryAfter, 0, 86_400)) {
    throw new RangeError('fault retryAfter must be whole seconds from 0 to 86400');
  }
  if (!isWhole(delayMs, 0, MAX_DELAY_MS)) throw new RangeError('fault delayMs must be 0–120000');
  if (error !== undefined && !/^[a-z_]{1,64}$/.test(String(error))) {
    throw new RangeError('fault error must be an OAuth error code such as invalid_grant');
  }
  if (status === undefined && delayMs === 0) throw new RangeError('a fault needs a status, a delay or both');
  return { count, status, retryAfter, delayMs, error };
}

/**
 * Creates one queue of faults per target.
 * @returns {{add: Function, take: Function, pending: Function, clear: Function}} `add(target, spec)` queues a
 *   fault; `take(target)` uses up one request of the oldest fault, or returns undefined; `pending(target)` counts
 *   the requests still to fail; `clear()` empties every queue.
 */
export function createFaultQueues() {
  const queues = new Map(FAULT_TARGETS.map((target) => [target, []]));
  const queueOf = (target) => {
    const queue = queues.get(target);
    if (!queue) throw new RangeError(`unknown fault target: ${target} (one of ${FAULT_TARGETS.join(', ')})`);
    return queue;
  };
  return {
    add(target, spec) {
      const fault = normaliseFault(spec);
      queueOf(target).push({ ...fault, left: fault.count });
      return fault;
    },
    take(target) {
      const queue = queueOf(target);
      const head = queue[0];
      if (head === undefined) return undefined;
      head.left -= 1;
      if (head.left === 0) queue.shift();
      return head;
    },
    pending: (target) => queueOf(target).reduce((sum, fault) => sum + fault.left, 0),
    clear: () => queues.forEach((queue) => (queue.length = 0)),
  };
}

/**
 * Applies a fault to a request: waits for its delay, then answers its status, if it has one.
 * @param {import('node:http').ServerResponse} res - The response.
 * @param {{status?: number, retryAfter?: number, delayMs: number, error?: string} | undefined} fault - From
 *   `take`, or undefined for no fault.
 * @returns {Promise<boolean>} True when the fault answered the request, so the service must not.
 */
export async function applyFault(res, fault) {
  if (fault === undefined) return false;
  if (fault.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, fault.delayMs).unref());
  if (fault.status === undefined) return false;
  const headers = fault.retryAfter === undefined ? {} : { 'Retry-After': String(fault.retryAfter) };
  const body = fault.error
    ? { error: fault.error, error_description: 'Mock Canvas fault' }
    : { errors: [{ message: 'Mock Canvas fault' }] };
  sendJson(res, fault.status, body, headers);
  return true;
}
