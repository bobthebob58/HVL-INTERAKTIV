/**
 * studioRouteLimits — the per-person limits of the studio's routes: how many activities an author may create
 * from patterns, how often the planner may be asked for, and how often the mappe may be made.
 *
 * Why: each of these requests costs the server work the person chooses the amount of: a new activity is a save,
 *      the planner reads a course's activities, and a mappe reads and checks up to fifty. An author at work
 *      creates a handful of activities, opens the planner now and then, and gets a mappe preview each time the
 *      choice of activities rests; the limits are far above that (D-128).
 * Spec: PROD-007, PED-031, MAPPE-001
 * Invariants:
 *   - Fixed ten-minute windows per person in Redis, so the limits hold across server nodes; a counter is a number
 *     under a key that names an account ID, never what was asked for (docs/privacy/DATA-INVENTORY.md).
 *   - New activities from a pattern count under the same key as new activities from the editor
 *     (../../http/h5pRouteLimits.ts `creationLimit`), so the two ways in share one limit.
 *   - The mappe's preview and its export count together.
 *   - Past a limit the routes answer 429 `hvl:rate-limited` with `Retry-After` (`refuseWhenLimited`).
 * Collaborators: ../collaboration/PersonRateLimit.ts, ../../http/h5pRouteLimits.ts, ../../server/studioServices.ts
 *   (builds them), ./patternRoutes.ts, ./learningDesignRoutes.ts, ./mappeRoutes.ts.
 * Tests: apps/server/test/learningDesign/http/studioRouteLimits.int.test.ts
 */
import { creationLimit } from '../../http/h5pRouteLimits.js';
import type { Redis } from '../../infra/redisClient.js';
import { PersonRateLimit, type PersonLimit } from '../collaboration/PersonRateLimit.js';

const TEN_MINUTES = 600;
/** Planner requests of one author in ten minutes. */
export const PLANNER_REQUESTS_PER_TEN_MINUTES = 120;
/** Mappe previews and exports of one author together in ten minutes. */
export const MAPPE_REQUESTS_PER_TEN_MINUTES = 120;

/** The limits of the studio's routes. */
export interface StudioRouteLimits {
  /** New activities of one author; shared with the editor's save of a new activity. */
  readonly creations: PersonLimit;
  /** Planner requests of one author. */
  readonly planner: PersonLimit;
  /** Mappe previews and exports of one author, together. */
  readonly mappe: PersonLimit;
}

/**
 * Builds the limits on the server's Redis.
 * @param redis - The server's Redis client (not owned: the server closes it).
 * @returns The three limits with D-128's numbers.
 * @spec PROD-007
 */
export function createStudioRouteLimits(redis: Redis): StudioRouteLimits {
  const window = (keyPrefix: string, limit: number): PersonLimit =>
    new PersonRateLimit(redis, { keyPrefix, limit, windowSeconds: TEN_MINUTES });
  return {
    creations: creationLimit(redis),
    planner: window('hvli:planner-requests:', PLANNER_REQUESTS_PER_TEN_MINUTES),
    mappe: window('hvli:mappe-requests:', MAPPE_REQUESTS_PER_TEN_MINUTES),
  };
}
