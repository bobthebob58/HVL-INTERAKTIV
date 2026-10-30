/**
 * gradeSyncStatus — reads the grade sync of an activity's placements that a person may see: each placement's
 * course, policy and its jobs counted by state (sent, pending, failed, orphaned).
 *
 * Why: LTI-012's acceptance: authors see a per-activity sync status. D-104 shows the counts per placement, on the
 *      activity page and in `/app/play`, with orphaned beside sent, pending and failed. The counts are of jobs (one
 *      per attempt with a gradable result, D-115) and are not k-suppressed (spec 05 §3, D-106): Canvas's gradebook
 *      shows each learner's score to the same teachers anyway.
 * Spec: LTI-012, LTI-006
 * Invariants:
 *   - PRIVACY: only counts leave this module: no learner key, Canvas user ID, score or error text is read into the
 *     answer (DATA-002); the job rows are grouped in the database, never loaded.
 *   - Placements come oldest first (then by ID, so the order is stable), within the person's scope.
 *   - A placement without a line item is `graded: false`; its counts are whatever jobs it has (none are written).
 *   - `masteryThreshold` is the stored threshold or LTI-012's default 0.8 for `mastery`, and null for the others.
 * Collaborators: ./gradeSyncScope.ts (`placementWhere`), ./gradeSyncRoutes.ts, ../../infra/prismaClient.ts,
 *   @hvl-interaktiv/api-contract (`GradeSyncStatusResponse`).
 * Tests: apps/server/test/grades/status/gradeSyncRoutes.int.test.ts
 */
import {
  DEFAULT_MASTERY_THRESHOLD,
  type GradeSyncCounts,
  type GradeSyncPlacement,
} from '@hvl-interaktiv/api-contract';
import type { Database } from '../../infra/prismaClient.js';
import { placementWhere, type GradeSyncScope } from './gradeSyncScope.js';

/** Counts with every state at zero. */
const noJobs = (): { -readonly [K in keyof GradeSyncCounts]: number } => ({
  sent: 0,
  pending: 0,
  failed: 0,
  orphaned: 0,
});

/** The answer's name of each stored job status: `succeeded` jobs are the ones Canvas accepted, `sent`. */
const COUNT_OF_STATUS = {
  succeeded: 'sent',
  pending: 'pending',
  failed: 'failed',
  orphaned: 'orphaned',
} as const satisfies Record<string, keyof GradeSyncCounts>;

/**
 * The placements of an activity in a scope, with their job counts.
 * @param db - The database.
 * @param contentId - The activity's stored ID.
 * @param scope - Which placements the person may see.
 * @returns The placements, oldest first; empty when the activity has none in the scope.
 * @spec LTI-012
 */
export async function readGradeSyncPlacements(
  db: Database,
  contentId: string,
  scope: GradeSyncScope,
): Promise<GradeSyncPlacement[]> {
  const placements = await db.ltiPlacement.findMany({
    where: placementWhere(contentId, scope),
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      contextLabel: true,
      lineItemUrl: true,
      attemptPolicy: true,
      masteryThreshold: true,
      platform: { select: { name: true } },
    },
  });
  if (placements.length === 0) return [];
  // PRIVACY: the database counts the jobs; no job row (learner key, encrypted sub, score) is read (DATA-002).
  const groups = await db.gradeSyncJob.groupBy({
    by: ['placementId', 'status'],
    where: { placementId: { in: placements.map((placement) => placement.id) } },
    _count: { _all: true },
  });
  const counts = new Map(placements.map((placement) => [placement.id, noJobs()]));
  for (const group of groups) {
    const placementCounts = counts.get(group.placementId);
    if (placementCounts) placementCounts[COUNT_OF_STATUS[group.status]] += group._count._all;
  }
  return placements.map((placement) => ({
    placementId: placement.id,
    platformName: placement.platform.name,
    contextLabel: placement.contextLabel,
    graded: placement.lineItemUrl !== null,
    attemptPolicy: placement.attemptPolicy,
    masteryThreshold:
      placement.attemptPolicy === 'mastery'
        ? (placement.masteryThreshold ?? DEFAULT_MASTERY_THRESHOLD)
        : null,
    counts: counts.get(placement.id) ?? noJobs(),
  }));
}
