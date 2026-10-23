/**
 * contentRules — the H5P-006 matrix for general actions, activities and temporary files, as pure functions.
 *
 * Why: the permission matrix must be provable cell by cell (H5P-006 "Verify"). Keeping the decisions free of
 *      I/O lets a table-driven test cover every combination of role, view, relation, status and visibility.
 * Spec: H5P-006, PROD-004, PROD-006, LTI-007
 * Invariants:
 *   - Anything not listed in the matrix is denied, including unknown enum values and `ContentPermission.Embed`.
 *   - Decisions read the actor's explicit fields and the view, never `user.id` (D-036), so a wrong view fails
 *     closed.
 *   - A draft is never visible to a learner, not even through an LTI launch (PROD-004).
 *   - An LTI launch reveals a published activity to the learner or author it was launched for (D-060); it never
 *     grants Edit, Delete or Download.
 *   - Unknown content (no facts) is denied for every per-activity permission.
 * Collaborators: ../HvlPermissionSystem.ts (the caller), ./ContentAccessRepository.ts (facts),
 *   ../HvlH5pUser.ts (actor and views), ./userDataRules.ts (uses `View` for own state).
 * Tests: apps/server/test/h5p/permissions/contentMatrix.test.ts,
 *   apps/server/test/h5p/permissions/generalAndTemporary.test.ts
 */
import { ContentPermission, GeneralPermission, TemporaryFilePermission } from '@lumieducation/h5p-server';
import type { HvlH5pActor, HvlH5pUser } from '../HvlH5pUser.js';
import type { ContentFacts } from './ContentAccessRepository.js';

const ADMIN_GENERAL = new Set<GeneralPermission>([
  GeneralPermission.InstallRecommended,
  GeneralPermission.UpdateAndInstallLibraries,
  GeneralPermission.CreateRestricted,
]);

const TEMPORARY_FILE = new Set<TemporaryFilePermission>([
  TemporaryFilePermission.Create,
  TemporaryFilePermission.Delete,
  TemporaryFilePermission.List,
  TemporaryFilePermission.View,
]);

const isStaff = (actor: HvlH5pActor): boolean => actor.role === 'author' || actor.role === 'admin';

const isOwnerOrCoAuthor = (actor: HvlH5pActor, facts: ContentFacts): boolean =>
  facts.ownerUserId === actor.accountId || facts.coAuthorIds.includes(actor.accountId);

/**
 * Decides a permission that belongs to a role rather than an object (library install, restricted types).
 * @param user - An issued H5P user.
 * @param permission - The general permission Lumi asks about.
 * @returns True only for an admin in the account view asking for one of the three general permissions.
 */
export function decideGeneral(user: HvlH5pUser, permission: GeneralPermission): boolean {
  // SECURITY: library changes are admin-only (D-004, D-041); the Hub install route is refused separately.
  return user.view === 'account' && user.actor.role === 'admin' && ADMIN_GENERAL.has(permission);
}

/**
 * Decides a temporary-file permission (files uploaded in the editor before saving).
 * @param user - An issued H5P user.
 * @param permission - The temporary-file permission Lumi asks about.
 * @returns True for an author or admin in the account view.
 */
export function decideTemporaryFile(user: HvlH5pUser, permission: TemporaryFilePermission): boolean {
  // WHY: "own files" holds already, because the storage key of a temporary file starts with the account ID.
  return user.view === 'account' && isStaff(user.actor) && TEMPORARY_FILE.has(permission);
}

/**
 * Tells whether a published activity's visibility reaches this person (`PROD-006`). Status is not checked.
 * @param actor - The person asking.
 * @param facts - The activity.
 * @returns True for an admin, the owner and co-authors, and for HVL members or Feide users as the
 *   visibility allows.
 */
export function isVisibleTo(actor: HvlH5pActor, facts: ContentFacts): boolean {
  if (actor.role === 'admin' || isOwnerOrCoAuthor(actor, facts)) return true;
  switch (facts.visibility) {
    case 'organisation':
      return actor.hvlMember;
    case 'feide':
      return actor.feideAuthenticated;
    default:
      return false;
  }
}

function mayView(actor: HvlH5pActor, facts: ContentFacts): boolean {
  const published = facts.status === 'published';
  switch (actor.role) {
    case 'admin':
      return true;
    case 'author':
      // WHY: authors preview their own drafts (PROD-004); others' activities only once published and visible, or
      // when their own launch opened it, e.g. after a Canvas course copy (D-060, LTI-007).
      return (
        isOwnerOrCoAuthor(actor, facts) ||
        (published && (isVisibleTo(actor, facts) || actor.ltiLaunchContentIds.includes(facts.contentId)))
      );
    case 'learner':
      // WHY: a draft stays hidden from learners even when its ID arrives in an LTI launch (PROD-004).
      return published && (isVisibleTo(actor, facts) || actor.ltiLaunchContentIds.includes(facts.contentId));
    default:
      return false;
  }
}

/**
 * Decides a per-activity permission (create, list, view, edit, delete, download, embed).
 * @param user - An issued H5P user.
 * @param permission - The content permission Lumi asks about.
 * @param facts - The activity, or `undefined` when it does not exist (and for `Create` and `List`).
 * @returns True only where the H5P-006 matrix allows it.
 */
export function decideContent(
  user: HvlH5pUser,
  permission: ContentPermission,
  facts: ContentFacts | undefined,
): boolean {
  const { actor } = user;
  const account = user.view === 'account';
  switch (permission) {
    case ContentPermission.Create:
    case ContentPermission.List:
      return account && isStaff(actor);
    case ContentPermission.View:
      // WHY: either view may view; the player runs in the state view and the editor in the account view.
      return facts !== undefined && mayView(actor, facts);
    case ContentPermission.Edit:
    case ContentPermission.Delete:
    case ContentPermission.Download:
      return (
        account &&
        facts !== undefined &&
        (actor.role === 'admin' || (actor.role === 'author' && isOwnerOrCoAuthor(actor, facts)))
      );
    default:
      // SECURITY: Embed and unknown values are not in the matrix, so they are denied.
      return false;
  }
}
