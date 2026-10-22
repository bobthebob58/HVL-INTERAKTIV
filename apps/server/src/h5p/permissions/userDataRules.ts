/**
 * userDataRules — the H5P-006 matrix for learner state (resume data), as a pure function.
 *
 * Why: learner state is personal data. A learner may use only their own state, and only for an activity they
 *      may view; nobody else may read it, except an admin answering a data-subject request, which is
 *      audit-logged (H5P-006, DATA-008). A pure function lets a table-driven test cover every cell.
 * Spec: H5P-006, DATA-002, DATA-008
 * Invariants:
 *   - Own data means `affectedUserId === actor.learnerKey`, in the state view, for content the actor may view.
 *   - Finished data (`*Finished`) is always denied: it is switched off (D-037).
 *   - "All users" (`affectedUserId` undefined) is always denied, and so is an empty or non-string ID.
 *   - Someone else's state is reachable only by an admin whose open data-subject request names that learner;
 *     the caller must audit-log every such grant.
 * Collaborators: ../HvlPermissionSystem.ts (the caller and auditor), ./contentRules.ts (decides `View`),
 *   ../HvlH5pUser.ts.
 * Tests: apps/server/test/h5p/permissions/userDataMatrix.test.ts
 */
import { UserDataPermission } from '@lumieducation/h5p-server';
import type { HvlH5pUser } from '../HvlH5pUser.js';

/**
 * The outcome of a user-data check: `dataSubjectRequest` is an allow that the caller must audit-log first.
 */
export type UserDataDecision = 'allow' | 'deny' | 'dataSubjectRequest';

const STATE = new Set<UserDataPermission>([
  UserDataPermission.EditState,
  UserDataPermission.DeleteState,
  UserDataPermission.ViewState,
  UserDataPermission.ListStates,
]);

/**
 * Decides a user-data permission.
 * @param user - An issued H5P user.
 * @param permission - The user-data permission Lumi asks about.
 * @param affectedUserId - Whose state: a learnerKey, or `undefined` for every learner (always denied).
 * @param canViewContent - Whether the user may view the activity the state belongs to.
 * @returns `allow` for own state, `dataSubjectRequest` for an admin's request, `deny` otherwise.
 */
export function decideUserData(
  user: HvlH5pUser,
  permission: UserDataPermission,
  affectedUserId: string | undefined,
  canViewContent: boolean,
): UserDataDecision {
  // PRIVACY: finished data is not stored (D-037), so no one may write, read or delete it.
  if (!STATE.has(permission)) return 'deny';
  // SECURITY: "every learner" and malformed IDs never match a pseudonym, even an empty one by mistake.
  if (typeof affectedUserId !== 'string' || affectedUserId === '') return 'deny';
  const { actor } = user;
  if (affectedUserId === actor.learnerKey) {
    // WHY: only the state view keys state by the learnerKey; the account view here is a wiring error (D-036).
    return user.view === 'state' && canViewContent ? 'allow' : 'deny';
  }
  // PRIVACY: teachers see aggregates only (spec 05); a single learner's state is for data-subject requests.
  return actor.role === 'admin' && actor.dataSubjectRequest?.learnerKey === affectedUserId
    ? 'dataSubjectRequest'
    : 'deny';
}
