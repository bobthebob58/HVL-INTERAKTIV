/**
 * XapiRateLimit — how many xAPI statements one person may send about one activity in a minute, counted in Redis on
 * every server node: 120 (LTI-011).
 *
 * Why: LTI-011 rate-limits each learner and activity to 120 statements per minute. Probe P1's peak was 22 a minute
 *      without `interacted` and `progressed`, which the bridge never sends, so a refusal means misuse (D-115). The
 *      counter follows the repository's per-person window (../learningDesign/collaboration/PersonRateLimit.ts), but
 *      counts a whole batch's statements at once.
 * Spec: LTI-011
 * Invariants:
 *   - A fixed window per person and activity: the first count starts it, and every statement sent in it counts,
 *     those of a refused batch too. A batch that takes the count past the limit is refused whole, with the seconds
 *     until the window ends (at least 1) for `Retry-After`; nothing from it is stored.
 *   - PRIVACY: the key is `hvli:xapi:<userId>:<contentId>` (an account ID and an activity ID, no statement data);
 *     the value is a number and lives one minute (DATA-INVENTORY's Redis keys, D-103).
 *   - The window's expiry is set with the first count in one transaction, so a key never stays without one.
 *   - Redis being unreachable fails the request; the limit is never skipped.
 * Collaborators: ./XapiIngest.ts, ../learningDesign/collaboration/PersonRateLimit.ts (`RateDecision`),
 *   ../infra/redisClient.ts.
 * Tests: apps/server/test/xapi/xapiLimits.int.test.ts
 */
import { XAPI_RATE_LIMIT_PER_MINUTE } from '@hvl-interaktiv/api-contract';
import type { Redis } from '../infra/redisClient.js';
import type { RateDecision } from '../learningDesign/collaboration/PersonRateLimit.js';

/** The prefix of the per-person, per-activity statement counters in Redis. */
export const XAPI_RATE_KEY_PREFIX = 'hvli:xapi:';
/** The window, in seconds (LTI-011: per minute). */
export const XAPI_RATE_WINDOW_SECONDS = 60;

/** A statement limit, as the ingestion uses it. */
export interface StatementLimit {
  /**
   * Counts a batch's statements.
   * @param userId - The account that sends them.
   * @param contentId - The activity they are about.
   * @param count - How many statements the batch holds.
   * @returns Allowed, or refused with the seconds until the window ends.
   */
  take(userId: string, contentId: string, count: number): Promise<RateDecision>;
}

/** Counts statements per person and activity in Redis, in fixed one-minute windows. */
export class XapiRateLimit implements StatementLimit {
  /**
   * @param redis - The server's Redis client (not owned: the server closes it).
   * @param limit - Statements allowed per window; LTI-011's 120 by default.
   * @param windowSeconds - The window; one minute by default.
   */
  constructor(
    private readonly redis: Redis,
    private readonly limit = XAPI_RATE_LIMIT_PER_MINUTE,
    private readonly windowSeconds = XAPI_RATE_WINDOW_SECONDS,
  ) {}

  /**
   * Counts a batch's statements.
   * @param userId - The account that sends them.
   * @param contentId - The activity they are about (as stored).
   * @param count - How many statements the batch holds.
   * @returns Allowed, or refused with the seconds until the window ends.
   * @throws the Redis client's error when Redis cannot be reached.
   * @spec LTI-011
   */
  async take(userId: string, contentId: string, count: number): Promise<RateDecision> {
    const key = `${XAPI_RATE_KEY_PREFIX}${userId}:${contentId}`;
    // WHY: INCRBY and EXPIRE NX in one MULTI: the first count of a window sets its end, later ones never move it.
    const [total, , ttl] = await this.redis
      .multi()
      .incrBy(key, count)
      .expire(key, this.windowSeconds, 'NX')
      .ttl(key)
      .exec();
    if (Number(total) <= this.limit) return { allowed: true };
    return { allowed: false, retryAfterSeconds: Math.max(1, Number(ttl)) };
  }
}
