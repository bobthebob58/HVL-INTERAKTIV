/**
 * InsightViewGate — how many insight views one server process builds at the same time: two at once, twenty in
 * line behind them, and a refusal past that.
 *
 * Why: one view is limited (200 000 stored statements, about 100 MB while it is built, D-122), but nothing
 *      limited how many were built at the same moment, so a busy morning of large views could add up to more
 *      memory than the server has. A view takes about a second, so waiting in a short line costs a teacher
 *      little, and only a full line is told to try again (D-134).
 * Spec: INS-001, INS-009, NFR-002
 * Invariants:
 *   - The gate's own rules are ../infra/BoundedGate.ts's: never more than the places and the line, first come
 *     first served, a place freed however a build ends, per process.
 *   - A refused view read nothing; the API answers it 503 `insight.busy` with `Retry-After`.
 * Collaborators: ../infra/BoundedGate.ts, ./InsightService.ts (builds every view through it),
 *   ./http/insightView.ts (answers a refusal), ../http/h5pErrorResponse.ts (keeps that status).
 * Tests: apps/server/test/infra/boundedGate.test.ts, apps/server/test/insight/http/insightBusy.int.test.ts
 */
import { BoundedGate, type GateLimits } from '../infra/BoundedGate.js';

/** D-134's limits: two views at once (about 200 MB), twenty waiting (about ten seconds for the last). */
export const INSIGHT_GATE_LIMITS: GateLimits = { atOnce: 2, waiting: 20 };

/** What a refused request is told to wait before it asks again, in seconds. */
export const INSIGHT_BUSY_RETRY_AFTER_SECONDS = 5;

/** The code and message key of the API's answer to a refused request (503). */
export const INSIGHT_BUSY_CODE = 'insight.busy';

/** The gate insight views are built through. */
export class InsightViewGate extends BoundedGate {
  /**
   * @param limits - Places and line length; D-134's limits outside tests.
   */
  constructor(limits: GateLimits = INSIGHT_GATE_LIMITS) {
    super(limits);
  }
}
