/**
 * NrpsLearnerCountStore — keeps the number of active learners per Canvas course in Redis, with a one-hour freshness
 * mark that also lets only one server node refresh a course at a time; insight reads the count from here.
 *
 * Why: LTI-008 caches the count for one hour and uses it as insight's denominator (INS-001). A count that cannot be
 *      refreshed must stay as it was ("failure leaves the old count"), so the count outlives the hour: a separate
 *      mark says whether it is fresh. Setting that mark only when it is absent (`SET NX`) both starts the hour and
 *      claims the refresh, so many learners launching at once cause one NRPS read, on one node.
 * Spec: LTI-008, INS-001
 * Invariants:
 *   - Keys hold D-103's platform-scoped course, never a bare context ID: `hvli:nrps:count:<platformId>:<contextId>`
 *     and `hvli:nrps:fresh:<platformId>:<contextId>`.
 *   - PRIVACY: the count key holds `{"count": n, "countedAt": "<ISO time>"}` and nothing else: no member, name, ID or
 *     e-mail (LTI-008). It lives 30 days after the last successful count (DATA-INVENTORY's Redis keys).
 *   - The fresh mark lives one hour (LTI-008); after a failed read it is shortened to five minutes, so the next
 *     launch after that tries again, while a course too large to count keeps the full hour.
 *   - A stored value that is not a well-formed count reads as no count; a reader never throws on stored data.
 * Collaborators: ./NrpsLearnerCounter.ts (writes), the insight denominators (S6 step 4, read), ../../infra/redisClient.ts,
 *   ../../xapi/platformContextKey.ts (the key's context part).
 * Tests: apps/server/test/lti/nrps/NrpsLearnerCountStore.int.test.ts
 */
import type { Redis } from '../../infra/redisClient.js';

/** The prefix of the stored counts. */
export const NRPS_COUNT_KEY_PREFIX = 'hvli:nrps:count:';
/** The prefix of the freshness marks. */
export const NRPS_FRESH_KEY_PREFIX = 'hvli:nrps:fresh:';
/** How long a count is fresh: one hour (LTI-008). */
export const NRPS_FRESH_SECONDS = 3600;
/** How soon a launch may try again after a failed read: five minutes. */
export const NRPS_RETRY_SECONDS = 300;
/** How long a count is kept after it was taken: 30 days. */
export const NRPS_COUNT_RETENTION_SECONDS = 30 * 24 * 3600;

/** A stored learner count. */
export interface NrpsLearnerCount {
  /** Active learners in the course when it was counted. */
  readonly count: number;
  /** When it was counted. */
  readonly countedAt: Date;
}

/** Reads and writes the learner counts of platform-scoped courses (D-103). */
export class NrpsLearnerCountStore {
  /**
   * @param redis - The server's Redis client (not owned: the server closes it).
   */
  constructor(private readonly redis: Redis) {}

  /**
   * Claims the next hour's refresh of a course: true when its count was not fresh and this caller should read NRPS.
   * @param contextKey - `<platformId>:<contextId>` (../../xapi/platformContextKey.ts).
   * @returns True when the mark was set now; false while a count is fresh or another refresh holds the mark.
   * @spec LTI-008
   */
  async claimRefresh(contextKey: string): Promise<boolean> {
    const set = await this.redis.set(`${NRPS_FRESH_KEY_PREFIX}${contextKey}`, '1', {
      NX: true,
      EX: NRPS_FRESH_SECONDS,
    });
    return set === 'OK';
  }

  /**
   * Lets the next launch try again sooner, after a read that failed (the old count stays).
   * @param contextKey - `<platformId>:<contextId>`.
   * @spec LTI-008
   */
  async retrySoon(contextKey: string): Promise<void> {
    await this.redis.expire(`${NRPS_FRESH_KEY_PREFIX}${contextKey}`, NRPS_RETRY_SECONDS);
  }

  /**
   * Stores a new count.
   * @param contextKey - `<platformId>:<contextId>`.
   * @param count - Active learners counted.
   * @param countedAt - When.
   * @spec LTI-008
   */
  async save(contextKey: string, count: number, countedAt: Date): Promise<void> {
    // PRIVACY: a number and a time; the members it was counted from are never written (LTI-008).
    const value = JSON.stringify({ count, countedAt: countedAt.toISOString() });
    await this.redis.set(`${NRPS_COUNT_KEY_PREFIX}${contextKey}`, value, {
      EX: NRPS_COUNT_RETENTION_SECONDS,
    });
  }

  /**
   * Reads a course's latest count, fresh or not, for insight's denominator (INS-001).
   * @param contextKey - `<platformId>:<contextId>`.
   * @returns The count and when it was taken, or undefined when there is none.
   * @spec LTI-008
   */
  async read(contextKey: string): Promise<NrpsLearnerCount | undefined> {
    const raw = await this.redis.get(`${NRPS_COUNT_KEY_PREFIX}${contextKey}`);
    if (typeof raw !== 'string') return undefined;
    try {
      const value = JSON.parse(raw) as { count?: unknown; countedAt?: unknown };
      const countedAt = new Date(String(value.countedAt));
      if (!Number.isSafeInteger(value.count) || (value.count as number) < 0) return undefined;
      if (Number.isNaN(countedAt.getTime())) return undefined;
      return { count: value.count as number, countedAt };
    } catch {
      return undefined;
    }
  }
}
