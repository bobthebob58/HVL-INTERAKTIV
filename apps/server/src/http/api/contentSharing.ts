/**
 * contentSharing — who may change an activity's visibility, and to what (PROD-006).
 *
 * Why: sharing decides who can find and play an activity: only the owner, co-authors and admins may change it,
 *      student authors may keep their activities private only until a course visibility exists (D-059), and an
 *      activity a person cannot edit must not reveal that it exists (D-066). Kept pure so the rules are tested
 *      as a table.
 * Spec: PROD-006, PROD-004, AUTH-002
 * Invariants:
 *   - Only visibility changes here; publishing is the publish flow's (./publishRoutes.ts, D-074).
 *   - Someone who may not edit gets the same 404 as for an activity that does not exist.
 * Collaborators: ./contentSharingRoutes.ts, ../../h5p/permissions/ContentAccessRepository.ts.
 * Tests: apps/server/test/http/api/contentSharing.test.ts
 */
import type { Principal } from '../../auth/Principal.js';
import type { ContentFacts, ContentVisibility } from '../../h5p/permissions/ContentAccessRepository.js';
import type { AuthErrorCode } from '../authErrors.js';

/**
 * Why a sharing change is refused, if it is.
 * @param principal - Who asks.
 * @param facts - The activity, or undefined when it does not exist.
 * @param to - The requested visibility.
 * @returns The refusal's code, or undefined when the change is allowed.
 */
export function sharingRefusal(
  principal: Pick<Principal, 'userId' | 'roles' | 'studentAuthor'>,
  facts: ContentFacts | undefined,
  to: ContentVisibility,
): AuthErrorCode | undefined {
  const admin = principal.roles.includes('admin');
  const editor =
    facts !== undefined &&
    principal.roles.includes('author') &&
    (facts.ownerUserId === principal.userId || facts.coAuthorIds.includes(principal.userId));
  // SECURITY: not being allowed to edit looks exactly like the activity not existing (D-066).
  if (!facts || (!admin && !editor)) return 'hvl:activity-unavailable';
  if (!admin && principal.studentAuthor && to !== 'private') return 'hvl:sharing-not-allowed';
  return undefined;
}
