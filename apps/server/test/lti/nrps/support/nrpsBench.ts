/**
 * nrpsBench — the whole app with the mock Canvas, one learner launch into a course with a known roster, and the
 * launch's ltijs context, for the NRPS learner-count integration tests.
 *
 * Why: LTI-008's count runs on ltijs's launch context, which reads NRPS over HTTP with ltijs's own token and paging.
 *      The context ltijs rebuilds from the ltik holds the same NRPS claim as the live launch's, so the tests drive
 *      the counter exactly as the launch hook does, against the mock Canvas's roster, faults and token controls.
 * Spec: LTI-008
 * Invariants:
 *   - The course ID is new for each bench, and the platform is the testbed's own, so parallel runs never share a
 *     Redis key; `close` deletes the course's two keys and closes the testbed.
 *   - The roster holds 120 active learners (three pages of 50) and four members who must not count: an inactive and
 *     a deleted learner, an instructor and a teaching assistant. Member IDs are random, so a test can look for them.
 *   - `staleWith(n)` sets an old count of n and removes the fresh mark: the state in which a launch reads NRPS.
 * Collaborators: ../../../support/appTestbed.ts, ../../../support/ltiLaunchDriver.ts,
 *   ../../../../../../tools/mock-platform/mockPlatform.mjs, ../../../../src/lti/nrps/NrpsLearnerCounter.ts.
 * Tests: apps/server/test/lti/nrps/NrpsLearnerCounter.int.test.ts,
 *   apps/server/test/lti/nrps/NrpsLearnerCounterFaults.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import type { LaunchContext } from 'ltijs';
import { LTI_ROLE, type NrpsMember } from '../../../../../../tools/mock-platform/mockPlatform.mjs';
import { launchFactsOf, type LaunchFacts } from '../../../../src/lti/launchFacts.js';
import {
  NRPS_COUNT_KEY_PREFIX,
  NRPS_FRESH_KEY_PREFIX,
  NrpsLearnerCountStore,
} from '../../../../src/lti/nrps/NrpsLearnerCountStore.js';
import { NrpsLearnerCounter } from '../../../../src/lti/nrps/NrpsLearnerCounter.js';
import { forgetNrpsToken } from '../../../../src/lti/nrps/nrpsTokenCache.js';
import { platformContextKey } from '../../../../src/xapi/platformContextKey.js';
import { openAppTestbed, type AppTestbed } from '../../../support/appTestbed.js';
import { capturedLogger, type CapturedLogger } from '../../../support/capturedLogger.js';
import { launchFromCanvas } from '../../../support/ltiLaunchDriver.js';

/** The active learners in the bench's roster. */
export const ACTIVE_LEARNERS = 120;
/** The time of every old count `staleWith` stores. */
export const EARLIER = new Date('2026-10-01T08:00:00.000Z');

const member = (n: number, roles: string[], status?: NrpsMember['status']): NrpsMember => ({
  user_id: `member-${n}-${randomUUID()}`,
  roles,
  ...(status ? { status } : {}),
});

/** A running app, a learner's launch into the bench's course, and the count's store and logger. */
export interface NrpsBench {
  readonly tb: AppTestbed;
  /** The launch's ltijs context (with the NRPS claim). */
  readonly launch: LaunchContext;
  /** The course's D-103 key. */
  readonly contextKey: string;
  readonly courseId: string;
  readonly roster: readonly NrpsMember[];
  readonly store: NrpsLearnerCountStore;
  /** The counters' logger and what it wrote. */
  readonly captured: CapturedLogger;
  /** A counter as the app builds it, with `NRPS_MAX_PAGES` = `maxPages` (default 100). */
  counter(options?: { maxPages?: number }): NrpsLearnerCounter;
  /** The course as the launch hook passes it: the launch's own facts. */
  course(): LaunchFacts;
  /** Stores an old count and removes the fresh mark. */
  staleWith(count: number): Promise<void>;
  close(): Promise<void>;
}

/**
 * Starts the app and the mock Canvas, launches a learner into a new course and gives that course the roster.
 * @returns The bench.
 */
export async function openNrpsBench(): Promise<NrpsBench> {
  const tb = await openAppTestbed();
  const courseId = `nrps-course-${randomUUID()}`;
  const roster: NrpsMember[] = [
    ...Array.from({ length: ACTIVE_LEARNERS }, (_, n) => member(n, [LTI_ROLE.learner])),
    member(200, [LTI_ROLE.learner], 'Inactive'),
    member(201, [LTI_ROLE.learner], 'Deleted'),
    member(202, [LTI_ROLE.instructor]),
    member(203, ['http://purl.imsglobal.org/vocab/lis/v2/membership/Instructor#TeachingAssistant']),
  ];
  const activity = await tb.activity(await tb.staffAccount(), { published: true });
  const run = await launchFromCanvas(tb.app, tb.mock.canvas, {
    custom: { contentId: activity },
    resourceLinkId: 'nrps-link',
    course: { id: courseId },
  });
  const launch = await tb.lti.provider.getLaunchContext(run.ltik ?? '');
  tb.mock.canvas.nrps.setMembers(courseId, roster);
  const contextKey = platformContextKey(tb.platformId, courseId);
  const store = new NrpsLearnerCountStore(tb.redis);
  const captured = capturedLogger('debug');
  return {
    tb,
    launch,
    contextKey,
    courseId,
    roster,
    store,
    captured,
    counter: ({ maxPages = 100 } = {}) =>
      new NrpsLearnerCounter({
        store,
        logger: captured.logger,
        maxPages,
        forgetToken: forgetNrpsToken(tb.db),
      }),
    course: () => launchFactsOf(launch.idToken),
    async staleWith(count) {
      await store.save(contextKey, count, EARLIER);
      await tb.redis.del(`${NRPS_FRESH_KEY_PREFIX}${contextKey}`);
    },
    async close() {
      await tb.redis.del([`${NRPS_COUNT_KEY_PREFIX}${contextKey}`, `${NRPS_FRESH_KEY_PREFIX}${contextKey}`]);
      await tb.close();
    },
  };
}
