/**
 * PeopleSearchRateLimit — how many people searches one person may make in a minute, counted in Redis.
 *
 * Why: the co-author search shows HVL staff names (D-090); a limit per person keeps a signed-in account from walking
 *      the whole staff list letter by letter. Redis holds the count, so every server node shares it.
 * Spec: PROD-007, DATA-002
 * Invariants:
 *   - A fixed window per person (./PersonRateLimit.ts): the first search starts a 60-second window, and every search
 *     in it counts, refused ones too; when the count passes the limit the answer says how many seconds remain.
 *   - PRIVACY: the key names the account ID only, never the query; the value is a number.
 * Collaborators: ./PeopleDirectory.ts (the caller), ./PersonRateLimit.ts, ../../infra/redisClient.ts.
 * Tests: apps/server/test/learningDesign/collaboration/peopleSearch.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/peopleSearchPrivacy.int.test.ts
 */
import type { Redis } from '../../infra/redisClient.js';
import { PersonRateLimit } from './PersonRateLimit.js';

export type { RateDecision } from './PersonRateLimit.js';

/** The prefix of the per-person counters in Redis. */
export const PEOPLE_SEARCH_KEY_PREFIX = 'hvli:people-search:';

/** Searches one person may make per window (D-090); typing with a debounce makes far fewer. */
export const PEOPLE_SEARCH_LIMIT = 30;

/** The window, in seconds. */
export const PEOPLE_SEARCH_WINDOW_SECONDS = 60;

/** Counts people searches per person in Redis. */
export class PeopleSearchRateLimit extends PersonRateLimit {
  /**
   * @param redis - The server's Redis client (not owned: the server closes it).
   * @param limit - Searches allowed per window; the default is `PEOPLE_SEARCH_LIMIT`.
   * @param windowSeconds - The window; the default is `PEOPLE_SEARCH_WINDOW_SECONDS`.
   */
  constructor(redis: Redis, limit = PEOPLE_SEARCH_LIMIT, windowSeconds = PEOPLE_SEARCH_WINDOW_SECONDS) {
    super(redis, { keyPrefix: PEOPLE_SEARCH_KEY_PREFIX, limit, windowSeconds });
  }
}
