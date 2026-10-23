/**
 * HvlPermissionSystem — the only `IPermissionSystem` the server gives Lumi; it applies the H5P-006 matrix.
 *
 * Why: Lumi's default (`LaissezFairePermissionSystem`) allows everything. This class answers Lumi's four
 *      questions from the actor's explicit fields (D-036), the activity's facts in PostgreSQL, and the pure
 *      rules in ./permissions/, and audit-logs every data-subject access to someone else's state.
 * Spec: H5P-006, PROD-004, PROD-006, DATA-007
 * Invariants:
 *   - Fails closed: a user that `isHvlH5pUser` does not recognise (undefined, forged or copied) is denied on all
 *     four methods, before any database lookup.
 *   - Anything not in the matrix is denied, including unknown permission values.
 *   - A granted data-subject access is recorded before `true` is returned; if recording fails, the check
 *     rejects. Denials are never recorded.
 *   - Logs nothing: decisions carry pseudonyms and account IDs only, and no log line is needed to enforce them.
 * Collaborators: ./HvlH5pUser.ts, ./permissions/contentRules.ts, ./permissions/userDataRules.ts,
 *   ./permissions/ContentAccessRepository.ts, ./permissions/UserDataAccessAuditor.ts; the editor and player
 *   factories hand it to every Lumi component (D-036).
 * Tests: apps/server/test/h5p/HvlPermissionSystem.test.ts,
 *   apps/server/test/h5p/permissions/contentMatrix.test.ts,
 *   apps/server/test/h5p/permissions/userDataMatrix.test.ts,
 *   apps/server/test/h5p/permissions/generalAndTemporary.test.ts,
 *   apps/server/test/h5p/permissions/HvlPermissionSystem.int.test.ts
 */
import {
  ContentPermission,
  type ContentId,
  type GeneralPermission,
  type IPermissionSystem,
  type TemporaryFilePermission,
  type UserDataPermission,
} from '@lumieducation/h5p-server';
import { isHvlH5pUser, type HvlH5pUser } from './HvlH5pUser.js';
import type { ContentAccessRepository, ContentFacts } from './permissions/ContentAccessRepository.js';
import { decideContent, decideGeneral, decideTemporaryFile } from './permissions/contentRules.js';
import { decideUserData } from './permissions/userDataRules.js';
import type { UserDataAccessAuditor } from './permissions/UserDataAccessAuditor.js';

/** What the permission system reads from and writes to. */
export interface HvlPermissionSystemDependencies {
  /** Owner, co-authors, status and visibility of activities. */
  readonly content: ContentAccessRepository;
  /** Records granted data-subject accesses. */
  readonly auditor: UserDataAccessAuditor;
}

/** The H5P-006 permission system. Every method accepts `undefined` (Lumi may pass it) and denies it. */
export class HvlPermissionSystem implements IPermissionSystem<HvlH5pUser> {
  /**
   * @param dependencies - The content facts repository and the data-subject access auditor.
   */
  constructor(private readonly dependencies: HvlPermissionSystemDependencies) {}

  /**
   * Checks a per-activity permission.
   * @param actingUser - The user Lumi passes; anything not issued by `HvlH5pUser.ts` is denied.
   * @param permission - The content permission.
   * @param contentId - The activity; `undefined` for `Create` and `List`.
   * @returns True when the matrix allows it.
   */
  async checkForContent(
    actingUser: HvlH5pUser | undefined,
    permission: ContentPermission,
    contentId: ContentId | undefined,
  ): Promise<boolean> {
    if (!isHvlH5pUser(actingUser)) return false;
    // WHY: Create and List concern no existing activity, so they need no database lookup.
    const needsFacts = permission !== ContentPermission.Create && permission !== ContentPermission.List;
    const facts = needsFacts ? await this.factsFor(contentId) : undefined;
    return decideContent(actingUser, permission, facts);
  }

  /**
   * Checks a permission on learner state; audit-logs a granted data-subject access before allowing it.
   * @param actingUser - The user Lumi passes; anything not issued by `HvlH5pUser.ts` is denied.
   * @param permission - The user-data permission.
   * @param contentId - The activity the state belongs to (Lumi passes `undefined` for "every activity").
   * @param affectedUserId - Whose state (a learnerKey); `undefined` means every learner.
   * @returns True when the matrix allows it.
   */
  async checkForUserData(
    actingUser: HvlH5pUser | undefined,
    permission: UserDataPermission,
    contentId: ContentId | undefined,
    affectedUserId?: string,
  ): Promise<boolean> {
    if (!isHvlH5pUser(actingUser)) return false;
    const facts = await this.factsFor(contentId);
    const canView = decideContent(actingUser, ContentPermission.View, facts);
    const decision = decideUserData(actingUser, permission, affectedUserId, canView);
    const request = actingUser.actor.dataSubjectRequest;
    if (decision === 'dataSubjectRequest' && request) {
      // PRIVACY: the audit row is written first; if it fails, this rejects and nothing is released (DATA-007).
      await this.dependencies.auditor.recordDataSubjectAccess({
        actorUserId: actingUser.actor.accountId,
        request,
        contentId,
        permission,
      });
      return true;
    }
    return decision === 'allow';
  }

  /**
   * Checks a permission on a temporary (editor upload) file.
   * @param actingUser - The user Lumi passes; anything not issued by `HvlH5pUser.ts` is denied.
   * @param permission - The temporary-file permission.
   * @param _filename - The file; ownership is enforced by the per-user storage key, not here.
   * @returns True when the matrix allows it.
   */
  async checkForTemporaryFile(
    actingUser: HvlH5pUser | undefined,
    permission: TemporaryFilePermission,
    _filename: string | undefined,
  ): Promise<boolean> {
    return isHvlH5pUser(actingUser) && decideTemporaryFile(actingUser, permission);
  }

  /**
   * Checks a permission that belongs to a role (library install and update, restricted content types).
   * @param actingUser - The user Lumi passes; anything not issued by `HvlH5pUser.ts` is denied.
   * @param permission - The general permission.
   * @returns True when the matrix allows it.
   */
  async checkForGeneralAction(
    actingUser: HvlH5pUser | undefined,
    permission: GeneralPermission,
  ): Promise<boolean> {
    return isHvlH5pUser(actingUser) && decideGeneral(actingUser, permission);
  }

  private async factsFor(contentId: ContentId | undefined): Promise<ContentFacts | undefined> {
    // SECURITY: Lumi may pass undefined or a non-string ID; both mean "no such activity".
    return typeof contentId === 'string' ? this.dependencies.content.factsFor(contentId) : undefined;
  }
}
