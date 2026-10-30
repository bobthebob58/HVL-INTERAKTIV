/**
 * coAuthorRequests — the co-author routes' decisions: who may see an activity's authors, who may add one, and who may
 * remove one; then the change itself.
 *
 * Why: D-090 lets the owner add and remove co-authors, lets a co-author remove only themself, and lets only findable
 *      HVL staff be added (never the owner, a learner, an LTI account, a student author or someone whose last
 *      eligible Feide login is 13 months old). D-066 makes "may not view" look like "does not exist".
 * Spec: PROD-007, H5P-006, DATA-007
 * Invariants:
 *   - Order: the View decision first (404 `hvl:activity-unavailable`), then the person's right (403), and only then
 *     the body or the path's user ID (400), so a refused caller learns nothing from a 400.
 *   - Listing needs Edit (403 `hvl:edit-not-allowed`); adding needs the owner (403 `hvl:owner-only`) who is an HVL
 *     staff author (a student-author owner gets 403 `hvl:sharing-not-allowed`, D-059); removing needs the owner, or
 *     the co-author themself.
 *   - Who may be added is the directory's `isFindable` (./staffEligibility.ts), the same rule as search.
 *   - Every answer is the list as it is after the change, as the asker may see it.
 * Collaborators: ./coAuthorChanges.ts, ./PeopleDirectory.ts, ./staffEligibility.ts, ../../content/contentAccess.ts,
 *   ../http/collaborationRoutes.ts.
 * Tests: apps/server/test/learningDesign/collaboration/coAuthorRoutes.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/coAuthorAccess.int.test.ts
 */
import { coAuthorAddRequestSchema, type CoAuthorList } from '@hvl-interaktiv/api-contract';
import type { Principal } from '../../auth/Principal.js';
import { editableContent, viewableContent } from '../../content/contentAccess.js';
import type { Clock } from '../../content/publishingDeps.js';
import { isContentUuid } from '../../h5p/contentIds.js';
import type { ContentAccessRepository } from '../../h5p/permissions/ContentAccessRepository.js';
import { parseBody } from '../../http/api/apiBodies.js';
import { authError } from '../../http/authErrors.js';
import { HttpError } from '../../http/HttpError.js';
import { learningDesignError } from '../../http/learningDesignErrors.js';
import type { Database } from '../../infra/prismaClient.js';
import { addCoAuthor, readCoAuthorList, removeCoAuthor } from './coAuthorChanges.js';
import type { PeopleDirectory } from './PeopleDirectory.js';
import { isEligibleStaffAuthor } from './staffEligibility.js';

/** What the co-author requests read and write. */
export interface CoAuthorRequestDeps {
  readonly db: Database;
  readonly access: ContentAccessRepository;
  readonly clock: Clock;
  readonly people: Pick<PeopleDirectory, 'isFindable'>;
}

const listFor = async (deps: CoAuthorRequestDeps, contentId: string, viewerUserId: string) => {
  const list = await readCoAuthorList(deps.db, contentId, viewerUserId);
  // WHY: deleted between the permission check and the read: answered like any activity that does not exist.
  if (!list) throw authError('hvl:activity-unavailable');
  return list;
};

/**
 * An activity's owner and co-authors, for someone who may edit it.
 * @param deps - Database, activity facts, clock and directory.
 * @param principal - Who asks (a portal author).
 * @param contentId - The ID from the path (untrusted).
 * @returns The list.
 * @throws HttpError 404 `hvl:activity-unavailable`; 403 `hvl:edit-not-allowed`.
 * @spec PROD-007
 */
export async function listCoAuthors(
  deps: CoAuthorRequestDeps,
  principal: Principal,
  contentId: string,
): Promise<CoAuthorList> {
  const { facts } = await editableContent(deps.access, principal, contentId);
  return listFor(deps, facts.contentId, principal.userId);
}

/**
 * Adds a co-author (idempotent) as the owner.
 * @param deps - Database, activity facts, clock and directory.
 * @param principal - Who asks.
 * @param contentId - The ID from the path (untrusted).
 * @param body - The request body, `{ userId }` (untrusted).
 * @returns The list after the change.
 * @throws HttpError 404 `hvl:activity-unavailable`; 403 `hvl:owner-only`, `hvl:sharing-not-allowed` or
 *   `error.forbidden`; 400 `error.badRequest` or `hvl:coauthor-not-eligible`; 409 `hvl:coauthor-limit`.
 * @spec PROD-007
 */
export async function addCoAuthorRequest(
  deps: CoAuthorRequestDeps,
  principal: Principal,
  contentId: string,
  body: unknown,
): Promise<CoAuthorList> {
  const { facts, role } = await viewableContent(deps.access, principal, contentId);
  if (role !== 'owner') throw learningDesignError('hvl:owner-only');
  // SECURITY: a student author shares nothing beyond their own work (D-059, D-090), so they add nobody.
  if (principal.studentAuthor) throw authError('hvl:sharing-not-allowed');
  if (!isEligibleStaffAuthor(principal)) throw new HttpError(403, 'error.forbidden');
  const { userId } = parseBody(coAuthorAddRequestSchema, body);
  const candidate = userId.toLowerCase();
  const findable = candidate !== facts.ownerUserId && (await deps.people.isFindable(candidate, deps.clock()));
  if (!findable) throw learningDesignError('hvl:coauthor-not-eligible');
  await addCoAuthor(deps.db, {
    contentId: facts.contentId,
    actorUserId: principal.userId,
    userId: candidate,
  });
  return listFor(deps, facts.contentId, principal.userId);
}

/**
 * Removes a co-author (idempotent): the owner removes anyone, a co-author only themself.
 * @param deps - Database, activity facts, clock and directory.
 * @param principal - Who asks.
 * @param contentId - The ID from the path (untrusted).
 * @param userId - The co-author to remove, from the path (untrusted).
 * @returns The list after the change, as the asker may see it.
 * @throws HttpError 404 `hvl:activity-unavailable`; 403 `hvl:owner-only`; 400 `error.badRequest` (not a user ID).
 * @spec PROD-007
 */
export async function removeCoAuthorRequest(
  deps: CoAuthorRequestDeps,
  principal: Principal,
  contentId: string,
  userId: string,
): Promise<CoAuthorList> {
  const { facts, role } = await viewableContent(deps.access, principal, contentId);
  const target = userId.toLowerCase();
  const self = role === 'coAuthor' && target === principal.userId;
  if (role !== 'owner' && !self) throw learningDesignError('hvl:owner-only');
  if (!isContentUuid(target)) throw new HttpError(400, 'error.badRequest');
  await removeCoAuthor(deps.db, {
    contentId: facts.contentId,
    actorUserId: principal.userId,
    userId: target,
  });
  return listFor(deps, facts.contentId, principal.userId);
}
