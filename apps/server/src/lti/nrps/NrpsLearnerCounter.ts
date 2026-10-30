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
 *   - Asks NRPS for the full Learner role URI (./activeLearners.ts), pages of 50, at most `NRPS_MAX_PAGES` pages;
 *     a course with more pages keeps its old count, and its fresh mark keeps the hour, so it is not re-read at once.
 *   - Any failure (token, NRPS answer, Redis, a timeout after 60 s) leaves the old count as it was, shortens the
 *     fresh mark so a later launch tries again, and is logged with a fixed event name, the platform ID and an HTTP
 *     status at most. `refresh` never throws, and `refreshInBackground` never rejects.
 *   - PRIVACY: members, their IDs and roles stay in memory only while counted; nothing about a member is stored or
 *     logged (LTI-008, DATA-002).
 * Collaborators: ../launch/onResourceLink.ts (starts it), ./NrpsLearnerCountStore.ts, ./activeLearners.ts,
 *   ../../xapi/platformContextKey.ts, ../../jobs/jobClock.ts, ../ltiRoutes.ts (wires it).
 * Tests: apps/server/test/lti/nrps/NrpsLearnerCounter.int.test.ts, apps/server/test/lti/launch/onResourceLinkNrps.test.ts
 */
import type { Logger } from 'pino';
import { systemClock, type JobClock } from '../../jobs/jobClock.js';
import { platformContextKey } from '../../xapi/platformContextKey.js';
import type { LaunchFacts } from '../launchFacts.js';
import { activeLearnerCount, LEARNER_ROLE_URI, type NrpsMemberFacts } from './activeLearners.js';
import type { NrpsLearnerCountStore } from './NrpsLearnerCountStore.js';

/** NRPS page size: Canvas's default and maximum (tools/mock-platform/canvasMemberships.mjs). */
export const NRPS_PAGE_SIZE = 50;
/** How long one count may take before it counts as failed. */
export const NRPS_TIMEOUT_MS = 60_000;

/** What the counter uses of an ltijs launch context (ltijs's `LaunchContext` fits it). */
export interface NrpsLaunch {
  readonly namesAndRoles: {
    isAvailable(): boolean;
    getMembers(options: {
      role: string;
      limit: number;
      pages: number;
    }): Promise<{ readonly members: readonly NrpsMemberFacts[]; readonly next?: string | undefined }>;
  };
}

/** What one refresh did. */
export type NrpsRefreshOutcome = 'unavailable' | 'fresh' | 'counted' | 'too-large' | 'failed';

/** What the counter needs. */
export interface NrpsCounterDeps {
  readonly store: Pick<NrpsLearnerCountStore, 'claimRefresh' | 'retrySoon' | 'save'>;
  readonly logger: Pick<Logger, 'info' | 'warn'>;
  /** `NRPS_MAX_PAGES`. */
  readonly maxPages: number;
  readonly clock?: JobClock;
  readonly timeoutMs?: number;
}

/** The HTTP status of a failed ltijs request (its `HttpError`), if any; nothing else of the error is logged. */
const statusOf = (error: unknown): number | undefined => {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === 'number' ? status : undefined;
};

/** Counts and stores the active learners of launched courses (LTI-008). */
export class NrpsLearnerCounter {
  /**
   * @param deps - The count store, a logger, the page limit and, for tests, a clock and a timeout.
   */
  constructor(private readonly deps: NrpsCounterDeps) {}

  /**
   * Starts a refresh without waiting for it: what a launch handler calls after its redirect.
   * @param launch - The launch's ltijs context.
   * @param facts - The launch's platform and course (../launchFacts.ts).
   * @spec LTI-008
   */
  refreshInBackground(launch: NrpsLaunch, facts: Pick<LaunchFacts, 'platformId' | 'contextId'>): void {
    // WHY: `refresh` catches everything itself; the extra catch only keeps a future change from an unhandled rejection.
    this.refresh(launch, facts).catch(() => undefined);
  }

  /**
   * Counts the course's active learners when its count is not fresh, and stores the number.
   * @param launch - The launch's ltijs context.
   * @param facts - The launch's platform and course.
   * @returns What happened; never throws.
   * @spec LTI-008
   */
  async refresh(
    launch: NrpsLaunch,
    facts: Pick<LaunchFacts, 'platformId' | 'contextId'>,
  ): Promise<NrpsRefreshOutcome> {
    const { store, logger } = this.deps;
    const contextKey = this.contextKeyOf(launch, facts);
    if (contextKey === undefined) return 'unavailable';
    const platformId = facts.platformId;
    try {
      if (!(await store.claimRefresh(contextKey))) return 'fresh';
      const memberships = await this.withTimeout(
        // SECURITY: the full role URI; Canvas matches the short name `Learner` to nobody (LTI-008, trap (b)).
        launch.namesAndRoles.getMembers({
          role: LEARNER_ROLE_URI,
          limit: NRPS_PAGE_SIZE,
          pages: this.deps.maxPages,
        }),
      );
      if (memberships.next !== undefined) {
        // WHY: a partial count would understate the denominator; the old count and the full hour stay.
        logger.warn({ event: 'nrps.too-large', platformId }, 'NRPS roster larger than NRPS_MAX_PAGES');
        return 'too-large';
      }
      const count = activeLearnerCount(memberships.members);
      await store.save(contextKey, count, (this.deps.clock ?? systemClock)());
      logger.info({ event: 'nrps.counted', platformId }, 'NRPS learner count stored');
      return 'counted';
    } catch (error) {
      // PRIVACY: an error may carry the roster's URL or body; only its status is logged.
      logger.warn(
        { event: 'nrps.count-failed', platformId, status: statusOf(error) },
        'NRPS learner count failed; the old count stays',
      );
      await store.retrySoon(contextKey).catch(() => undefined);
      return 'failed';
    }
  }

  /** The course's key, or undefined when the launch has no NRPS claim or no course. */
  private contextKeyOf(
    launch: NrpsLaunch,
    facts: Pick<LaunchFacts, 'platformId' | 'contextId'>,
  ): string | undefined {
    try {
      if (facts.contextId === '' || !launch.namesAndRoles.isAvailable()) return undefined;
      return platformContextKey(facts.platformId, facts.contextId);
    } catch {
      // WHY: a context ID over 255 characters cannot form D-103's key; such a course gets no count.
      return undefined;
    }
  }

  /** Rejects when the read takes longer than the timeout (ltijs's requests have none). */
  private async withTimeout<T>(work: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('NRPS timeout')), this.deps.timeoutMs ?? NRPS_TIMEOUT_MS);
      timer.unref();
    });
    try {
      return await Promise.race([work, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
