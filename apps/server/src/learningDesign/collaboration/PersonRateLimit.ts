/**
 * PersonRateLimit — a fixed window per person, counted in Redis: how many times one account may do something costly
 * (search HVL staff names, copy an activity) in a short time.
 *
 * Why: the people search (D-090) and copying (D-092 amendment 2026-10-29) each need a per-person limit that every
 *      server node shares. One counter keeps their behaviour the same: the window, the expiry and the `Retry-After`.
 * Spec: PROD-007, DATA-002
 * Invariants:
 *   - A fixed window per person and purpose: the first count starts the window, and every count in it counts,
 *     refused ones too; past the limit the answer says how many seconds remain (at least 1).
 *   - PRIVACY: the key is the purpose's prefix and the account ID, never what the person asked for; the value is a
 *     number.
 *   - The window's expiry is set with the first count in one transaction, so a key can never stay without one.
 * Collaborators: ./PeopleSearchRateLimit.ts, ./CopyRateLimit.ts, ../../infra/redisClient.ts.
 * Tests: apps/server/test/learningDesign/collaboration/peopleSearch.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/copyRateLimit.int.test.ts
 */
import type { Redis } from '../../infra/redisClient.js';

/** Whether an action may go ahead, and if not, when the person may try again. */
export type RateDecision =
  { readonly allowed: true } | { readonly allowed: false; readonly retryAfterSeconds: number };

/** A per-person limit, as its callers use it. */
export interface PersonLimit {
  /**
   * Counts one action of a person.
   * @param userId - The account that acts.
   * @returns Allowed, or refused with the seconds until the window ends.
   */
  take(userId: string): Promise<RateDecision>;
}

/** The shape of one limit: its Redis key prefix, how many actions, and the window in seconds. */
export interface PersonRateLimitShape {
  readonly keyPrefix: string;
  readonly limit: number;
  readonly windowSeconds: number;
}

/** Counts actions per person in Redis, in fixed windows. */
export class PersonRateLimit implements PersonLimit {
  /**
   * @param redis - The server's Redis client (not owned: the server closes it).
   * @param shape - The key prefix, the limit and the window.
   */
  constructor(
    private readonly redis: Redis,
    private readonly shape: PersonRateLimitShape,
  ) {}

  /**
   * Counts one action of a person.
   * @param userId - The account that acts.
   * @returns Allowed, or refused with the seconds until the window ends.
   * @throws the Redis client's error when Redis cannot be reached (the action then fails, it is never unlimited).
   * @spec PROD-007
   */
  async take(userId: string): Promise<RateDecision> {
    const key = this.shape.keyPrefix + userId;
    // WHY: INCR and EXPIRE NX in one MULTI: the first count of a window sets its end, later ones never move it.
    const [count, , ttl] = await this.redis
      .multi()
      .incr(key)
      .expire(key, this.shape.windowSeconds, 'NX')
      .ttl(key)
      .exec();
    if (Number(count) <= this.shape.limit) return { allowed: true };
    return { allowed: false, retryAfterSeconds: Math.max(1, Number(ttl)) };
  }
}
