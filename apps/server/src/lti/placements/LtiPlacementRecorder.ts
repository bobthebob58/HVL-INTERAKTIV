/**
 * LtiPlacementRecorder — records where an activity is placed in Canvas, at every resource-link launch.
 *
 * Why: LTI-006 records or updates an `LtiPlacement (platformId, contextId, resourceLinkId, contentId, lineItemUrl)`
 *      at each launch. S6's grade bridge and insight read it per course; a course copy gives a new context with its
 *      own placement for the same activity (LTI-007).
 * Spec: LTI-006, LTI-007
 * Invariants:
 *   - One row per (platform, course, resource link); a later launch updates its activity and line item.
 *   - The caller has already checked that the activity exists and is available to this launch.
 *   - Concurrent first launches of one link create one row.
 * Collaborators: ../launch/onResourceLink.ts, ../../infra/prismaClient.ts.
 * Tests: apps/server/test/lti/placements/LtiPlacementRecorder.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';

/** A placement as a launch reports it. */
export interface PlacementInput {
  /** `LtiPlatform.id`. */
  readonly platformId: string;
  /** The Canvas course (`context.id`). */
  readonly contextId: string;
  /** The Canvas link (`resource_link.id`). */
  readonly resourceLinkId: string;
  /** The activity. */
  readonly contentId: string;
  /** The AGS line item, when the placement is graded. */
  readonly lineItemUrl?: string;
}

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';

/** Records placements. */
export class LtiPlacementRecorder {
  /**
   * @param db - The database.
   */
  constructor(private readonly db: Database) {}

  /**
   * Creates or updates the placement of one resource link.
   * @param input - What the launch says.
   * @returns The placement's ID.
   */
  async record(input: PlacementInput): Promise<string> {
    const { platformId, contextId, resourceLinkId, contentId } = input;
    const where = { platformId_contextId_resourceLinkId: { platformId, contextId, resourceLinkId } };
    const data = { contentId, lineItemUrl: input.lineItemUrl ?? null };
    const upsert = () =>
      this.db.ltiPlacement.upsert({
        where,
        create: { platformId, contextId, resourceLinkId, ...data },
        update: data,
      });
    try {
      return (await upsert()).id;
    } catch (error) {
      // WHY: two first launches of one link can both try to insert; the second then updates the row.
      if (!isUniqueViolation(error)) throw error;
      return (await upsert()).id;
    }
  }
}
