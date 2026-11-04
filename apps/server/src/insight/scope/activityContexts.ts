/**
 * activityContexts — the contexts an activity's insight can be shown for: the portal's plays and every Canvas course
 * the activity is placed in, each with its course label where one is stored.
 *
 * Why: on the activity page the owner or co-author picks one of the activity's contexts, labelled with
 *      `LtiPlacement.contextLabel` where one is stored (D-106, D-087); a context is always one course of one Canvas
 *      (D-103), so two instances' courses with the same ID stay two contexts.
 * Spec: INS-007, LTI-006
 * Invariants:
 *   - The portal comes first, then the courses in order of their first placement; each course once, however many
 *     placements (resource links) it has.
 *   - A course key is built only by ../../xapi/platformContextKey.ts; a placement whose context cannot form a key is
 *     left out (it can hold no statements either).
 *   - The label is the non-empty `contextLabel` of the course's newest placement that has one, else null.
 *   - This lists what exists; who may see which context is INS-007's check (the API workstream).
 * Collaborators: ../../infra/prismaClient.ts, ../../xapi/platformContextKey.ts, ../InsightService.ts.
 * Tests: apps/server/test/insight/insightService.int.test.ts
 */
import { PORTAL_CONTEXT_KEY, type InsightContext } from '@hvl-interaktiv/api-contract';
import type { Database } from '../../infra/prismaClient.js';
import { platformContextKey } from '../../xapi/platformContextKey.js';

/** The placements' fields this module reads. */
interface PlacementContext {
  readonly platformId: string;
  readonly contextId: string;
  readonly contextLabel: string | null;
}

/**
 * Turns placements, oldest first, into the activity's contexts.
 * @param placements - The activity's placements, ordered by creation.
 * @returns The portal, then one entry per course.
 * @spec INS-007
 */
export function contextsOfPlacements(placements: readonly PlacementContext[]): InsightContext[] {
  const courses = new Map<string, string | null>();
  for (const placement of placements) {
    let key: string;
    try {
      key = platformContextKey(placement.platformId, placement.contextId);
    } catch {
      continue; // WHY: a context that cannot form a key is never stored with a statement (D-103).
    }
    const label = placement.contextLabel?.trim() || null;
    // WHY: a later launch may carry a renamed course label; the newest non-empty one names the course.
    courses.set(key, label ?? courses.get(key) ?? null);
  }
  return [{ key: PORTAL_CONTEXT_KEY, label: null }, ...[...courses].map(([key, label]) => ({ key, label }))];
}

/**
 * Lists an activity's contexts from its placements.
 * @param db - The database.
 * @param contentId - The activity, as stored.
 * @returns The portal, then each Canvas course the activity is placed in.
 * @spec INS-007
 */
export async function listActivityContexts(db: Database, contentId: string): Promise<InsightContext[]> {
  const placements = await db.ltiPlacement.findMany({
    where: { contentId },
    select: { platformId: true, contextId: true, contextLabel: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  return contextsOfPlacements(placements);
}
