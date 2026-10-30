/**
 * GradeSyncRetryRateLimit — how many grade-sync retries one person may ask for in ten minutes, counted in Redis on
 * every server node.
 *
 * Why: a retry makes every failed job of a placement due at once, and the worker then calls Canvas for each learner
 *      (D-104). Pressing the button again and again would only hammer Canvas, which answers repeated calls with 429.
 *      The people search's per-person window (../../learningDesign/collaboration/PersonRateLimit.ts) bounds it the
 *      same way the copy limit does.
 * Spec: LTI-012, DATA-002
 * Invariants:
 *   - One fixed window per person: `GRADE_SYNC_RETRY_LIMIT` retries in `GRADE_SYNC_RETRY_WINDOW_SECONDS`; a refused
 *     retry counts too, so waiting is the only way past it.
 *   - PRIVACY: the key names the account ID only, never the activity, placement or learners; the value is a number.
 * Collaborators: ../../learningDesign/collaboration/PersonRateLimit.ts, ./gradeSyncRoutes.ts,
 *   ../../infra/redisClient.ts.
 * Tests: apps/server/test/grades/status/gradeSyncRetry.int.test.ts
 */
import type { Redis } from '../../infra/redisClient.js';
import { PersonRateLimit } from '../../learningDesign/collaboration/PersonRateLimit.js';

/** The prefix of the per-person retry counters in Redis. */
export const GRADE_SYNC_RETRY_KEY_PREFIX = 'hvli:grade-sync-retries:';

/** Retries one person may ask for per window: a few presses after Canvas was down, never a loop. */
export const GRADE_SYNC_RETRY_LIMIT = 10;

/** The window, in seconds (ten minutes). */
export const GRADE_SYNC_RETRY_WINDOW_SECONDS = 600;

/** Counts grade-sync retries per person in Redis. */
export class GradeSyncRetryRateLimit extends PersonRateLimit {
  /**
   * @param redis - The server's Redis client (not owned: the server closes it).
   * @param limit - Retries allowed per window; the default is `GRADE_SYNC_RETRY_LIMIT`.
   * @param windowSeconds - The window; the default is `GRADE_SYNC_RETRY_WINDOW_SECONDS`.
   */
  constructor(redis: Redis, limit = GRADE_SYNC_RETRY_LIMIT, windowSeconds = GRADE_SYNC_RETRY_WINDOW_SECONDS) {
    super(redis, { keyPrefix: GRADE_SYNC_RETRY_KEY_PREFIX, limit, windowSeconds });
  }
}
