/**
 * benchLearner — the learner principal of a launch into one of the grade bench's placements, as the LTI launch seals
 * it for the xAPI ingestion and the grade enqueuer.
 *
 * Why: the enqueuer finds the placement by the launch's `(platformId, contextId, resourceLinkId)` and keys the job by
 *      the principal's `learnerKey` (LTI-012, D-104), so each bench learner needs a launch of its own placement.
 * Spec: LTI-012
 * Invariants:
 *   - Each call gives a new user ID and learner key, so learners never share a job.
 * Collaborators: ./gradeBench.ts, ../../../src/auth/Principal.ts.
 * Tests: apps/server/test/grades/gradeSyncWorker.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import { sealPrincipal, type Principal } from '../../../src/auth/Principal.js';
import { uniqueName } from '../../support/services.js';

/** The launch facts of a placement that a learner's principal carries. */
export interface LaunchedPlacement {
  readonly contextId: string;
  readonly resourceLinkId: string;
  readonly lineItemUrl: string;
}

/**
 * A learner principal from a launch into the placement.
 * @param platformId - The mock Canvas's `LtiPlatform.id`.
 * @param placement - The placement launched.
 * @param contentId - The activity it opens.
 * @returns The sealed principal.
 */
export function learnerOf(platformId: string, placement: LaunchedPlacement, contentId: string): Principal {
  return sealPrincipal({
    userId: randomUUID(),
    learnerKey: uniqueName('learner'),
    roles: ['learner'],
    mode: 'lti',
    locale: 'nn',
    hvlMember: false,
    feideAuthenticated: false,
    studentAuthor: false,
    lti: {
      platformId,
      deploymentId: '1',
      contextId: placement.contextId,
      resourceLinkId: placement.resourceLinkId,
      contentId,
      lineItemUrl: placement.lineItemUrl,
      messageType: 'LtiResourceLinkRequest',
    },
  });
}
