/**
 * gradeSyncAnswers — the API answers the grade-sync panel tests fake: an activity's placements in the contract's
 * shape, with counts before and after a retry.
 *
 * Why: the panel's display tests and its retry tests (LTI-012) read the same placements; one module keeps the
 *      contract's shape and the test course names in one place.
 * Spec: LTI-012
 * Collaborators: ../../support/fakeFetch.ts, packages/api-contract (types only).
 * Tests: used by GradeSyncPanel.test.tsx and GradeSyncPanelRetry.test.tsx in this folder.
 */
import type { GradeSyncPlacement, GradeSyncStatusResponse } from '@hvl-interaktiv/api-contract';
import type { FakeAnswer } from '../../support/fakeFetch';

/** The activity's ID. */
export const ID = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';
/** The status route of the activity. */
export const PATH = `/api/content/${ID}/grade-sync`;
/** The placement in SYK110. */
export const SYK = '0192f0c4-0000-7000-8000-0000000000a1';
/** The placement in NAT200. */
export const NAT = '0192f0c4-0000-7000-8000-0000000000b2';

/**
 * The SYK110 placement with its counts.
 * @param counts - The job counts.
 * @returns A graded placement with the `best` policy.
 */
export const syk = (counts: GradeSyncPlacement['counts']): GradeSyncPlacement => ({
  placementId: SYK,
  platformName: 'HVL Canvas',
  contextLabel: 'SYK110',
  graded: true,
  attemptPolicy: 'best',
  masteryThreshold: null,
  counts,
});

/** NAT200, a link without a gradebook column. */
export const NAT_UNGRADED: GradeSyncPlacement = {
  ...syk({ sent: 0, pending: 0, failed: 0, orphaned: 0 }),
  placementId: NAT,
  contextLabel: 'NAT200',
  graded: false,
};

/**
 * The status answer.
 * @param placements - The placements, in order.
 * @returns A 200 answer with the activity's placements.
 */
export const status = (...placements: GradeSyncPlacement[]): FakeAnswer => ({
  status: 200,
  body: { contentId: ID, placements } satisfies GradeSyncStatusResponse,
});

/** SYK110 with scores in every state, two of them failed. */
export const BEFORE = syk({ sent: 12, pending: 3, failed: 2, orphaned: 1 });
/** SYK110 after the two failed scores were requeued. */
export const AFTER = syk({ sent: 12, pending: 5, failed: 0, orphaned: 1 });
