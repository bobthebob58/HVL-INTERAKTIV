/**
 * NrpsLearnerCounter — after a resource-link launch, counts the course's active learners through Canvas's Names and
 * Roles service, when the launch carries the service and the stored count is not fresh, and stores only the number.
 *
 * Why: LTI-008 makes the number of active learners insight's denominator (INS-001). ltijs's `namesAndRoles` works
 *      only from a live launch context (D-104), so the count is read during a launch: after the redirect, in the
 *      background, so learning never waits for Canvas. The fresh mark in ./NrpsLearnerCountStore.ts keeps it to one
 *      read per course and hour, whichever node the launches reach.
 * Spec: LTI-008, INS-001
 * Invariants:
 *   - Runs only for a launch with the NRPS claim (`namesAndRoles.isAvailable()`) and a course; the course is D-103's
 *     `<platformId>:<contextId>` from the launch's context claim, never ltijs's `LaunchContext.contextId`.
 *   - The roster is read as ./nrpsRosterRead.ts reads it: the full Learner role URI, pages of 50 up to
 *     `NRPS_MAX_PAGES`, one new token after a 401, 60 s in all. A course with more pages keeps its old count, and
 *     its fresh mark keeps the hour, so it is not re-read at once.
 *   - Any failure (token, NRPS answer, Redis, the time limit) leaves the old count as it was, shortens the fresh mark
 *     so a later launch tries again, and is logged with a fixed event name, the platform ID and an HTTP status at
 *     most. `refresh` never throws, and `refreshInBackground` never rejects.
 *   - PRIVACY: members, their IDs and roles stay in memory only while counted; nothing about a member is stored or
 *     logged (LTI-008, DATA-002).
 * Collaborators: ../launch/onResourceLink.ts (starts it), ./NrpsLearnerCountStore.ts, ./nrpsRosterRead.ts,
 *   ./activeLearners.ts, ./nrpsServices.ts (builds it), ../../xapi/platformContextKey.ts, ../../jobs/jobClock.ts.
 * Tests: apps/server/test/lti/nrps/NrpsLearnerCounter.test.ts, apps/server/test/lti/nrps/NrpsLearnerCounter.int.test.ts,
 *   apps/server/test/lti/nrps/NrpsLearnerCounterFaults.int.test.ts, apps/server/test/lti/launch/onResourceLinkNrps.test.ts
 */
import type { Logger } from 'pino';
import { systemClock, type JobClock } from '../../jobs/jobClock.js';
import { platformContextKey } from '../../xapi/platformContextKey.js';
import type { LaunchFacts } from '../launchFacts.js';
import { activeLearnerCount } from './activeLearners.js';
import type { NrpsLearnerCountStore } from './NrpsLearnerCountStore.js';
import { httpStatusOf, readLearnerRoster, type NrpsLaunch } from './nrpsRosterRead.js';
import type { ForgetNrpsToken } from './nrpsTokenCache.js';

export type { NrpsLaunch } from './nrpsRosterRead.js';

/** What one refresh did. */
export type NrpsRefreshOutcome = 'unavailable' | 'fresh' | 'counted' | 'too-large' | 'failed';

/** The course a launch came from: its platform and its context claim (../launchFacts.ts). */
export type NrpsCourse = Pick<LaunchFacts, 'platformId' | 'contextId'>;

/** What the counter needs. */
export interface NrpsCounterDeps {
  readonly store: Pick<NrpsLearnerCountStore, 'claimRefresh' | 'retrySoon' | 'save'>;
  readonly logger: Pick<Logger, 'info' | 'warn'>;
  /** `NRPS_MAX_PAGES`. */
  readonly maxPages: number;
  /** Drops ltijs's cached NRPS token after a 401 (./nrpsTokenCache.ts). */
  readonly forgetToken: ForgetNrpsToken;
  readonly clock?: JobClock;
  readonly timeoutMs?: number;
}

/** Counts and stores the active learners of launched courses (LTI-008). */
export class NrpsLearnerCounter {
  /**
   * @param deps - The count store, a logger, the page limit, the token cache and, for tests, a clock and a timeout.
   */
  constructor(private readonly deps: NrpsCounterDeps) {}

  /**
   * Starts a refresh without waiting for it: what a launch handler calls after its redirect.
   * @param launch - The launch's ltijs context.
   * @param course - The launch's platform and course (../launchFacts.ts).
   * @spec LTI-008
   */
  refreshInBackground(launch: NrpsLaunch, course: NrpsCourse): void {
    // WHY: `refresh` catches everything itself; the extra catch only keeps a future change from an unhandled rejection.
    this.refresh(launch, course).catch(() => undefined);
  }

  /**
   * Counts the course's active learners when its count is not fresh, and stores the number.
   * @param launch - The launch's ltijs context.
   * @param course - The launch's platform and course.
   * @returns What happened; never throws.
   * @spec LTI-008
   */
  async refresh(launch: NrpsLaunch, course: NrpsCourse): Promise<NrpsRefreshOutcome> {
    const { store, logger } = this.deps;
    const contextKey = contextKeyOf(launch, course);
    if (contextKey === undefined) return 'unavailable';
    const platformId = course.platformId;
    try {
      if (!(await store.claimRefresh(contextKey))) return 'fresh';
      const roster = await readLearnerRoster(launch, {
        maxPages: this.deps.maxPages,
        forgetToken: this.deps.forgetToken,
        ...(this.deps.timeoutMs === undefined ? {} : { timeoutMs: this.deps.timeoutMs }),
      });
      if (!roster.complete) {
        // WHY: a partial count would understate the denominator; the old count and the full hour stay.
        logger.warn({ event: 'nrps.too-large', platformId }, 'NRPS roster larger than NRPS_MAX_PAGES');
        return 'too-large';
      }
      const count = activeLearnerCount(roster.members);
      await store.save(contextKey, count, (this.deps.clock ?? systemClock)());
      logger.info({ event: 'nrps.counted', platformId }, 'NRPS learner count stored');
      return 'counted';
    } catch (error) {
      // PRIVACY: an error may carry the roster's URL or body; only its status is logged.
      logger.warn(
        { event: 'nrps.count-failed', platformId, status: httpStatusOf(error) },
        'NRPS learner count failed; the old count stays',
      );
      await store.retrySoon(contextKey).catch(() => undefined);
      return 'failed';
    }
  }
}

/**
 * The course's key, or undefined when the launch has no NRPS claim or no course.
 * @param launch - The launch's ltijs context.
 * @param course - The launch's platform and course.
 * @returns D-103's `<platformId>:<contextId>`, or undefined.
 */
function contextKeyOf(launch: NrpsLaunch, course: NrpsCourse): string | undefined {
  try {
    if (course.contextId === '' || !launch.namesAndRoles.isAvailable()) return undefined;
    return platformContextKey(course.platformId, course.contextId);
  } catch {
    // WHY: a context ID over 255 characters cannot form D-103's key; such a course gets no count.
    return undefined;
  }
}
