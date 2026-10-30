/**
 * CopyRateLimit — how many copies one person may start in ten minutes (a duplicate or «Lagre som ny versjon»),
 * counted in Redis, and the 429 that says so.
 *
 * Why: each copy streams every file of its source through the server into new storage (D-092), and nothing bounded
 *      how many one person could start, in parallel or in a row (D-092 amendment 2026-10-29, S5 review). The people
 *      search's per-person window (./PersonRateLimit.ts) bounds it the same way on every server node.
 * Spec: PROD-007, PROD-013
 * Invariants:
 *   - One window per person for both kinds of copy: `COPY_LIMIT` copies in `COPY_WINDOW_SECONDS`.
 *   - PRIVACY: the key names the account ID only, never the source; the value is a number.
 *   - The refusal is 429 `hvl:rate-limited` and carries the seconds until the window ends, for `Retry-After`.
 * Collaborators: ./PersonRateLimit.ts, ./ContentDuplicator.ts (counts), ../../h5p/createH5pRuntime.ts (builds it),
 *   ../http/collaborationRoutes.ts and ../../http/routes/contentRoutes.ts (send `Retry-After`),
 *   ../../http/learningDesignErrors.ts.
 * Tests: apps/server/test/learningDesign/collaboration/copyRateLimit.int.test.ts,
 *   apps/server/test/learningDesign/safeEditing/saveAsCopy.int.test.ts
 */
import type { HttpError } from '../../http/HttpError.js';
import { learningDesignError } from '../../http/learningDesignErrors.js';
import type { Redis } from '../../infra/redisClient.js';
import { PersonRateLimit } from './PersonRateLimit.js';

/** The prefix of the per-person copy counters in Redis. */
export const COPY_KEY_PREFIX = 'hvli:copies:';

/** Copies one person may start per window; an author copies a handful of activities at a time. */
export const COPY_LIMIT = 20;

/** The window, in seconds (ten minutes). */
export const COPY_WINDOW_SECONDS = 600;

/** Counts copies per person in Redis. */
export class CopyRateLimit extends PersonRateLimit {
  /**
   * @param redis - The server's Redis client (not owned: the server closes it).
   * @param limit - Copies allowed per window; the default is `COPY_LIMIT`.
   * @param windowSeconds - The window; the default is `COPY_WINDOW_SECONDS`.
   */
  constructor(redis: Redis, limit = COPY_LIMIT, windowSeconds = COPY_WINDOW_SECONDS) {
    super(redis, { keyPrefix: COPY_KEY_PREFIX, limit, windowSeconds });
  }
}

/** The 429 of a copy past the limit, with the seconds until the person may copy again. */
export type CopyLimitedError = HttpError & { readonly retryAfterSeconds: number };

/**
 * The refusal of a copy past the person's limit.
 * @param retryAfterSeconds - Seconds until the window ends.
 * @returns HttpError 429 `hvl:rate-limited` carrying `retryAfterSeconds`.
 */
export const copyLimitedError = (retryAfterSeconds: number): CopyLimitedError =>
  Object.assign(learningDesignError('hvl:rate-limited'), { retryAfterSeconds });

/**
 * The seconds a copy refusal asks the person to wait, for the route's `Retry-After`.
 * @param error - Whatever a copy threw.
 * @returns The seconds, or undefined when the error is not a copy-limit refusal.
 */
export function retryAfterOf(error: unknown): number | undefined {
  const seconds = (error as Partial<CopyLimitedError> | null)?.retryAfterSeconds;
  return typeof seconds === 'number' ? seconds : undefined;
}
