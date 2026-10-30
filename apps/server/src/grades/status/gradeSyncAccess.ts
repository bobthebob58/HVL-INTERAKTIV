/**
 * gradeSyncAccess — checks a request for an activity's grade sync: first that the person may view the activity, then
 * which of its placements they may see (./gradeSyncScope.ts).
 *
 * Why: the contract (`GRADE_BRIDGE_ROUTES`) answers 404 `hvl:activity-unavailable` for an activity that is unknown or
 *      not viewable, the same answer for both (D-066), and 403 `error.forbidden` to someone who may view it but is
 *      neither its owner or co-author nor a Canvas author of a course it is placed in (D-106). Checking View first
 *      means a 403 only ever tells something to a person who can open the activity anyway.
 * Spec: LTI-012, H5P-006
 * Invariants:
 *   - View is decided by the H5P-006 matrix (`viewableContent`), the rules the player uses.
 *   - The returned `contentId` is the stored, canonical ID, whatever letter case the path used.
 * Collaborators: ./gradeSyncScope.ts, ../../content/contentAccess.ts, ./gradeSyncRoutes.ts.
 * Tests: apps/server/test/grades/status/gradeSyncRoutes.int.test.ts
 */
import type { Principal } from '../../auth/Principal.js';
import { viewableContent } from '../../content/contentAccess.js';
import type { ContentAccessRepository } from '../../h5p/permissions/ContentAccessRepository.js';
import { HttpError } from '../../http/HttpError.js';
import { gradeSyncScope, type GradeSyncScope } from './gradeSyncScope.js';

/** An activity the person may see the grade sync of, and which placements. */
export interface GradeSyncAccess {
  /** The stored activity ID (lower-case UUID). */
  readonly contentId: string;
  readonly scope: GradeSyncScope;
}

/**
 * Checks that a person may see an activity's grade sync.
 * @param access - The activity facts.
 * @param principal - Who asks.
 * @param contentId - The ID from the path (untrusted).
 * @returns The canonical ID and the person's scope.
 * @throws HttpError 404 `hvl:activity-unavailable` when the activity is unknown or not viewable; 403
 *   `error.forbidden` when the person may view it but see no placement's grade sync.
 * @spec LTI-012
 */
export async function gradeSyncAccess(
  access: ContentAccessRepository,
  principal: Principal,
  contentId: string,
): Promise<GradeSyncAccess> {
  const { facts } = await viewableContent(access, principal, contentId);
  const scope = gradeSyncScope(principal, facts);
  if (!scope) throw new HttpError(403, 'error.forbidden');
  return { contentId: facts.contentId, scope };
}
