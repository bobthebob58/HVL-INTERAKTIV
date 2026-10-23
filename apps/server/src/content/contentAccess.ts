/**
 * contentAccess — what a principal may do with one activity, decided by the H5P-006 matrix, for the `/api` routes.
 *
 * Why: the API must answer exactly as the H5P permission system does (H5P-006), so it reads the same facts
 *      (ContentAccessRepository) and asks the same pure rules (`decideContent`) with the principal's account view.
 *      D-066 keeps an activity a person may not view indistinguishable from one that does not exist.
 * Spec: H5P-006, PROD-004, PROD-003
 * Invariants:
 *   - Not viewable (or unknown) is 404 `hvl:activity-unavailable`; viewable but not editable is 403
 *     `hvl:edit-not-allowed`.
 *   - Publishing is allowed to exactly those who may edit.
 *   - The returned `contentId` is the canonical stored ID, whatever case the request used.
 * Collaborators: ../h5p/permissions/contentRules.ts, ../h5p/permissions/ContentAccessRepository.ts,
 *   ../auth/principalToH5pActor.ts, ../http/api/contentListRoutes.ts, ../http/api/publishRoutes.ts.
 * Tests: apps/server/test/http/api/contentListRoutes.int.test.ts, apps/server/test/http/api/publishGuards.int.test.ts
 */
import { ContentPermission } from '@lumieducation/h5p-server';
import type { Principal } from '../auth/Principal.js';
import { principalToH5pActor } from '../auth/principalToH5pActor.js';
import { asAccountUser } from '../h5p/HvlH5pUser.js';
import type { ContentAccessRepository, ContentFacts } from '../h5p/permissions/ContentAccessRepository.js';
import { decideContent } from '../h5p/permissions/contentRules.js';
import { authError } from '../http/authErrors.js';

/** What the principal may do with one activity they may view. */
export interface ContentAccess {
  readonly facts: ContentFacts;
  /** `owner`, `coAuthor`, or null when the principal neither owns nor co-authors it. */
  readonly role: 'owner' | 'coAuthor' | null;
  /** H5P-006 Edit; also decides publishing (PROD-003). */
  readonly mayEdit: boolean;
}

/**
 * Reads an activity's facts and the principal's rights on it.
 * @param repository - The activity facts.
 * @param principal - Who asks.
 * @param contentId - The ID from the request (untrusted).
 * @returns The access, for an activity the principal may view.
 * @throws HttpError 404 `hvl:activity-unavailable` when it is unknown or not viewable.
 * @spec H5P-006
 */
export async function viewableContent(
  repository: ContentAccessRepository,
  principal: Principal,
  contentId: string,
): Promise<ContentAccess> {
  const facts = await repository.factsFor(contentId);
  const user = asAccountUser(principalToH5pActor(principal));
  // SECURITY: an activity the person may not view answers like one that does not exist (D-066).
  if (!facts || !decideContent(user, ContentPermission.View, facts))
    throw authError('hvl:activity-unavailable');
  const role =
    facts.ownerUserId === principal.userId
      ? 'owner'
      : facts.coAuthorIds.includes(principal.userId)
        ? 'coAuthor'
        : null;
  return { facts, role, mayEdit: decideContent(user, ContentPermission.Edit, facts) };
}

/**
 * Like `viewableContent`, for routes that need Edit permission (findings, publish, unpublish).
 * @param repository - The activity facts.
 * @param principal - Who asks.
 * @param contentId - The ID from the request (untrusted).
 * @returns The access of someone who may edit.
 * @throws HttpError 404 `hvl:activity-unavailable`; 403 `hvl:edit-not-allowed` when viewable but not editable.
 * @spec H5P-006
 */
export async function editableContent(
  repository: ContentAccessRepository,
  principal: Principal,
  contentId: string,
): Promise<ContentAccess> {
  const access = await viewableContent(repository, principal, contentId);
  if (!access.mayEdit) throw authError('hvl:edit-not-allowed');
  return access;
}
