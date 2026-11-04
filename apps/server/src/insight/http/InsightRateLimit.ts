/**
 * InsightRateLimit — how many insight requests one person may make in a minute, counted in Redis on every server
 * node.
 *
 * Why: a view reads every statement of an activity in one context and period and runs the validator for its findings;
 *      a script that asks again and again would load the database for nothing. The people search's per-person window
 *      (../../learningDesign/collaboration/PersonRateLimit.ts) bounds it the same way the other read APIs are bounded.
 *      Opening the tab makes three requests (contexts, view, findings) and each new choice or download one more, so
 *      60 a minute never stops a teacher.
 * Spec: INS-007, INS-006, DATA-002
 * Invariants:
 *   - One fixed window per person, shared by the four insight routes: `INSIGHT_REQUEST_LIMIT` requests in
 *     `INSIGHT_REQUEST_WINDOW_SECONDS`; a refused request counts too, so waiting is the only way past it.
 *   - PRIVACY: the key names the account ID only, never the activity, context or period; the value is a number.
 * Collaborators: ../../learningDesign/collaboration/PersonRateLimit.ts, ./insightRoutes.ts, ./insightApi.ts,
 *   ../../infra/redisClient.ts.
 * Tests: apps/server/test/insight/http/insightRateLimit.int.test.ts
 */
import type { Redis } from '../../infra/redisClient.js';
import { PersonRateLimit } from '../../learningDesign/collaboration/PersonRateLimit.js';

/** The prefix of the per-person insight counters in Redis. */
export const INSIGHT_REQUEST_KEY_PREFIX = 'hvli:insight-requests:';

/** Insight requests one person may make per window (the contract's 429 says the same). */
export const INSIGHT_REQUEST_LIMIT = 60;

/** The window, in seconds. */
export const INSIGHT_REQUEST_WINDOW_SECONDS = 60;

/** Counts insight requests per person in Redis. */
export class InsightRateLimit extends PersonRateLimit {
  /**
   * @param redis - The server's Redis client (not owned: the server closes it).
   * @param limit - Requests allowed per window; the default is `INSIGHT_REQUEST_LIMIT`.
   * @param windowSeconds - The window; the default is `INSIGHT_REQUEST_WINDOW_SECONDS`.
   */
  constructor(redis: Redis, limit = INSIGHT_REQUEST_LIMIT, windowSeconds = INSIGHT_REQUEST_WINDOW_SECONDS) {
    super(redis, { keyPrefix: INSIGHT_REQUEST_KEY_PREFIX, limit, windowSeconds });
  }
}
