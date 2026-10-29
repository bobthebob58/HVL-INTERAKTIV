/**
 * PeopleSearchRateLimit — how many people searches one person may make in a minute, counted in Redis.
 *
 * Why: the co-author search shows HVL staff names (D-090); a limit per person keeps a signed-in account from walking
 *      the whole staff list letter by letter. Redis holds the count, so every server node shares it.
 * Spec: PROD-007, DATA-002
 * Invariants:
 *   - A fixed window per person: the first search starts a 60-second window, and every search in it counts, refused
 *     ones too; when the count passes the limit the answer says how many seconds remain (at least 1).
 *   - PRIVACY: the key names the account ID only, never the query; the value is a number.
 *   - The window's expiry is set with the first count in one transaction, so a key can never stay without one.
 * Collaborators: ./PeopleDirectory.ts (the caller), ../../infra/redisClient.ts.
 * Tests: apps/server/test/learningDesign/collaboration/peopleSearch.int.test.ts
 */
import type { Redis } from '../../infra/redisClient.js';

/** The prefix of the per-person counters in Redis. */
export const PEOPLE_SEARCH_KEY_PREFIX = 'hvli:people-search:';

/** Searches one person may make per window (D-090); typing with a debounce makes far fewer. */
export const PEOPLE_SEARCH_LIMIT = 30;

/** The window, in seconds. */
export const PEOPLE_SEARCH_WINDOW_SECONDS = 60;

/** Whether a search may go ahead, and if not, when the person may search again. */
export type RateDecision =
  { readonly allowed: true } | { readonly allowed: false; readonly retryAfterSeconds: number };

/** Counts people searches per person in Redis. */
export class PeopleSearchRateLimit {
  /**
   * @param redis - The server's Redis client (not owned: the server closes it).
   * @param limit - Searches allowed per window; the default is `PEOPLE_SEARCH_LIMIT`.
   * @param windowSeconds - The window; the default is `PEOPLE_SEARCH_WINDOW_SECONDS`.
   */
  constructor(
    private readonly redis: Redis,
    private readonly limit = PEOPLE_SEARCH_LIMIT,
    private readonly windowSeconds = PEOPLE_SEARCH_WINDOW_SECONDS,
  ) {}

  /**
   * Counts one search for a person.
   * @param userId - The account that searches.
   * @returns Allowed, or refused with the seconds until the window ends.
   * @throws the Redis client's error when Redis cannot be reached (the search then fails, it is never unlimited).
   * @spec PROD-007
   */
  async take(userId: string): Promise<RateDecision> {
    const key = PEOPLE_SEARCH_KEY_PREFIX + userId;
    // WHY: INCR and EXPIRE NX in one MULTI: the first search of a window sets its end, later ones never move it.
    const [count, , ttl] = await this.redis
      .multi()
      .incr(key)
      .expire(key, this.windowSeconds, 'NX')
      .ttl(key)
      .exec();
    if (Number(count) <= this.limit) return { allowed: true };
    return { allowed: false, retryAfterSeconds: Math.max(1, Number(ttl)) };
  }
}
