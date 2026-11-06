/**
 * LtiPlacementRecorder — records where an activity is placed in Canvas, at every resource-link launch.
 *
 * Why: LTI-006 records or updates an `LtiPlacement (platformId, contextId, resourceLinkId, contentId, lineItemUrl)`
 *      at each launch. S6's grade bridge and insight read it per course; a course copy gives a new context with its
 *      own placement for the same activity (LTI-007). D-087 keeps the course label too, as a course-code suggestion
 *      for the activity's authors (PED-030). D-104's amendment of 2026-11-04 checks the line item's URL here, at
 *      every launch, because the grade worker later sends a learner's `sub` and a bearer token to it.
 * Spec: LTI-006, LTI-007, PED-030, DATA-002, LTI-012
 * Invariants:
 *   - One row per (platform, course, resource link); a later launch updates its activity, line item and label.
 *   - The caller has already checked that the activity exists and is available to this launch.
 *   - Concurrent first launches of one link create one row.
 *   - SECURITY: a line item URL is stored only when ../../grades/lineItemUrlPolicy.ts allows it for the launch's
 *     platform (its origin in `CANVAS_ORIGINS` or the platform's own, https in production); otherwise the placement
 *     is stored without one (not graded), and the refusal is logged with its reason and origin only.
 *   - PRIVACY: the course label is stored only when it is a course code with a digit (./courseLabel.ts), else null;
 *     each launch overwrites it, so a label renamed to a name is dropped at the next launch.
 * Collaborators: ../launch/onResourceLink.ts, ./courseLabel.ts, ../../grades/lineItemUrlPolicy.ts,
 *   ../../infra/prismaClient.ts, ../ltiRoutes.ts (passes the rules).
 * Tests: apps/server/test/lti/placements/LtiPlacementRecorder.int.test.ts,
 *   apps/server/test/lti/placements/courseLabel.test.ts
 */
import type { Logger } from 'pino';
import { lineItemUrlRefusal, webOriginOf, type LineItemUrlRules } from '../../grades/lineItemUrlPolicy.js';
import type { Database } from '../../infra/prismaClient.js';
import { placementCourseLabel } from './courseLabel.js';

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
  /** The launch's `context.label` claim as sent (untrusted); only a course code of it is stored (D-087). */
  readonly contextLabel?: unknown;
}

/** The line item rules (`CANVAS_ORIGINS`, https in production) and where a refusal is logged. */
export interface PlacementRecorderOptions extends LineItemUrlRules {
  /** Logs a refused line item URL (its reason and origin, never the URL); nothing is logged without it. */
  readonly logger?: Pick<Logger, 'warn'>;
}

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';

/** Records placements. */
export class LtiPlacementRecorder {
  /**
   * @param db - The database.
   * @param options - The line item rules and a logger; without rules only the platform's own origins are allowed.
   */
  constructor(
    private readonly db: Database,
    private readonly options: PlacementRecorderOptions = {},
  ) {}

  /**
   * Creates or updates the placement of one resource link.
   * @param input - What the launch says.
   * @returns The placement's ID.
   */
  async record(input: PlacementInput): Promise<string> {
    const { platformId, contextId, resourceLinkId, contentId } = input;
    const where = { platformId_contextId_resourceLinkId: { platformId, contextId, resourceLinkId } };
    const data = {
      contentId,
      lineItemUrl:
        input.lineItemUrl === undefined ? null : await this.allowedLineItem(platformId, input.lineItemUrl),
      contextLabel: placementCourseLabel(input.contextLabel),
    };
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

  /** The line item URL when the platform may receive scores there (D-104 amendment), else null. */
  private async allowedLineItem(platformId: string, lineItemUrl: string): Promise<string | null> {
    const platform = await this.db.ltiPlatform.findUnique({
      where: { id: platformId },
      select: { url: true, authenticationEndpoint: true, accessTokenEndpoint: true },
    });
    const refusal = platform ? lineItemUrlRefusal(lineItemUrl, platform, this.options) : 'origin';
    if (refusal === undefined) return lineItemUrl;
    // SECURITY: the reason and the origin only, which tell an operator what to add to CANVAS_ORIGINS (DATA-009).
    this.options.logger?.warn(
      { event: 'lti.placement.line-item-refused', reason: refusal, origin: webOriginOf(lineItemUrl) },
      'line item URL refused',
    );
    return null;
  }
}
