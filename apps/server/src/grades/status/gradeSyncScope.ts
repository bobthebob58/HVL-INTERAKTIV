/**
 * gradeSyncScope — which placements of an activity a person may see the grade sync of, and retry: every placement
 * for its owner and co-authors in the portal, the launch's own course for a Canvas author, none for learners.
 *
 * Why: LTI-012's acceptance lets authors see a per-activity sync status and retry failed jobs. D-104 has the counts
 *      shown on the activity page and in `/app/play`, and leaves who may see them to D-106: the activity's owner and
 *      co-authors, and an LTI author whose launch comes from that course, whether or not they own the activity (after
 *      a course copy, LTI-007). In `/app/play` the course is the launch's and cannot be changed (D-106), so a Canvas
 *      principal sees that course only, also when they own the activity. Kept pure, so the rules are tested as a
 *      table.
 * Spec: LTI-012, LTI-006, LTI-007
 * Invariants:
 *   - SECURITY: only a principal with the `author` role gets a scope: a learner never does, whatever they own (D-102),
 *     and an admin gets nothing through that role (D-106); in the portal only an owner or co-author.
 *   - A Canvas scope is the launch's platform and course (`principal.lti`), never a course from the request.
 *   - The scope reads only the principal and the activity's owner and co-authors; the View check comes first
 *     (../../content/contentAccess.ts), so an activity the person may not view is never reached here (D-066).
 * Collaborators: ./gradeSyncAccess.ts (the caller), ../../auth/Principal.ts,
 *   ../../h5p/permissions/ContentAccessRepository.ts.
 * Tests: apps/server/test/grades/status/gradeSyncScope.test.ts
 */
import type { Principal } from '../../auth/Principal.js';
import type { ContentFacts } from '../../h5p/permissions/ContentAccessRepository.js';

/** The placements a person may see: all of the activity's, or those in one Canvas course. */
export type GradeSyncScope =
  | { readonly kind: 'all' }
  | { readonly kind: 'course'; readonly platformId: string; readonly contextId: string };

/**
 * The scope of a person's grade-sync view of one activity.
 * @param principal - Who asks.
 * @param facts - The activity, which the person may view.
 * @returns The scope, or undefined when the person may see no placement's grade sync (403).
 * @spec LTI-012
 */
export function gradeSyncScope(
  principal: Pick<Principal, 'userId' | 'roles' | 'mode' | 'lti'>,
  facts: Pick<ContentFacts, 'ownerUserId' | 'coAuthorIds'>,
): GradeSyncScope | undefined {
  // SECURITY: learners never see grade sync (D-102), and admin alone grants nothing (D-106): the author role is needed.
  if (!principal.roles.includes('author')) return undefined;
  if (principal.mode === 'lti') {
    // WHY: in Canvas the view is the launch's course only (D-106), so another course's counts never show there.
    const launch = principal.lti;
    return launch
      ? { kind: 'course', platformId: launch.platformId, contextId: launch.contextId }
      : undefined;
  }
  const editor = facts.ownerUserId === principal.userId || facts.coAuthorIds.includes(principal.userId);
  return editor ? { kind: 'all' } : undefined;
}

/**
 * The placement filter of a scope, for a Prisma `where` on `LtiPlacement`.
 * @param contentId - The activity's stored ID.
 * @param scope - The person's scope.
 * @returns The `where` clause: the activity, and the course when the scope names one.
 */
export const placementWhere = (
  contentId: string,
  scope: GradeSyncScope,
): { contentId: string; platformId?: string; contextId?: string } =>
  scope.kind === 'all'
    ? { contentId }
    : { contentId, platformId: scope.platformId, contextId: scope.contextId };
