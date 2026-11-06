/**
 * subjectErasure — deletes a data subject's learner rows and matched learner accounts, table by table, deleting the
 * H5P learner state through our own storage rather than through Lumi's manager.
 *
 * Why: DATA-008's erasure. Lumi 10.0.4's `ContentUserDataManager.deleteAllContentUserDataByUser` checks the permission
 *      for the user named but deletes the acting user's state (`ContentUserDataManager.js:39-43`), so D-108 deletes
 *      `H5PUserData` through `PrismaContentUserDataStorage` with the learner's state view (D-036). Its amendment of
 *      2026-11-04 fixes the order (the purge's, D-107) and how a failure part-way is reported.
 * Spec: DATA-008, H5P-005, DATA-002
 * Invariants:
 *   - Order: `GradeSyncJob`, `XapiStatement`, `H5PUserData` (one learnerKey at a time, through the storage), the
 *     matched learner `Identity` rows, then the matched learner `User` rows left without an identity and owning no
 *     content (D-034). A staff account or identity is never deleted.
 *   - Each table's count is added to the tally as soon as its delete returns, so a run that fails part-way reports
 *     what it deleted; a second run deletes the rest.
 *   - PRIVACY: returns counts only; no row, key or identifier is logged (DATA-009).
 * Collaborators: ../../h5p/storage/PrismaContentUserDataStorage.ts, ../../h5p/HvlH5pUser.ts (the state view),
 *   ./subjectRows.ts, ./dataSubjectRequest.ts.
 * Tests: apps/server/test/privacy/dsr/dataSubjectErasure.int.test.ts
 */
import { asStateUser } from '../../h5p/HvlH5pUser.js';
import { PrismaContentUserDataStorage } from '../../h5p/storage/PrismaContentUserDataStorage.js';
import type { Database } from '../../infra/prismaClient.js';
import type { SubjectKeys } from './subjectKeys.js';
import { byLearnerKeys, erasableUsers, type SubjectAccounts, type SubjectCounts } from './subjectRows.js';

/** Who acts and for which request: the state view names them (D-036). */
export interface ErasureRequest {
  /** The random request ID, as audited. */
  readonly requestId: string;
  /** The operator's `User.id`. */
  readonly operatorUserId: string;
}

/**
 * The state view of an admin acting on one learner's state for a data-subject request (D-036).
 * @param request - The request and its operator.
 * @param learnerKey - The learner's pseudonym, which the storage reads as `user.id`.
 * @returns A frozen H5P user whose `id` is the learnerKey.
 */
const stateViewOf = (request: ErasureRequest, learnerKey: string) =>
  asStateUser({
    accountId: request.operatorUserId,
    role: 'admin',
    learnerKey,
    contextId: '',
    locale: 'nn',
    hvlMember: true,
    feideAuthenticated: true,
    studentAuthor: false,
    ltiLaunchContentIds: [],
    dataSubjectRequest: { requestId: request.requestId, learnerKey },
  });

/** Deletes the learner state under each key through the storage, adding what went to the tally. */
async function eraseLearnerState(
  db: Database,
  keys: SubjectKeys,
  request: ErasureRequest,
  tally: SubjectCounts,
): Promise<void> {
  const storage = new PrismaContentUserDataStorage(db);
  for (const learnerKey of keys.learnerKeys) {
    const before = await db.h5PUserData.count({ where: { learnerKey } });
    if (before === 0) continue;
    // UPSTREAM: https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-server/src/ContentUserDataManager.ts
    // deleteAllContentUserDataByUser deletes the acting user's state instead of the named user's (D-108, D-112), so
    // the storage's own method, which deletes by the key it is given, is called directly. Keep it so while Lumi's
    // manager has the bug.
    await storage.deleteAllContentUserDataByUser(stateViewOf(request, learnerKey));
    tally.h5pUserData += before - (await db.h5PUserData.count({ where: { learnerKey } }));
  }
}

/**
 * Deletes everything the request covers, in the documented order.
 * @param db - The database.
 * @param keys - The derived keys.
 * @param accounts - The matched accounts (./subjectRows.ts).
 * @param request - The request ID and the operator.
 * @param tally - Receives each table's count as its delete returns, also when a later step fails.
 * @returns When every table is done.
 * @throws Whatever the database throws; `tally` then holds what was deleted before.
 * @spec DATA-008
 */
export async function eraseSubject(
  db: Database,
  keys: SubjectKeys,
  accounts: SubjectAccounts,
  request: ErasureRequest,
  tally: SubjectCounts,
): Promise<void> {
  const where = byLearnerKeys(keys);
  tally.gradeSyncJobs += (await db.gradeSyncJob.deleteMany({ where })).count;
  tally.xapiStatements += (await db.xapiStatement.deleteMany({ where })).count;
  await eraseLearnerState(db, keys, request, tally);
  // SECURITY: only learner identities and accounts; a staff account owns content colleagues rely on (D-108).
  tally.learnerIdentities += (
    await db.identity.deleteMany({
      where: { id: { in: [...accounts.learnerIdentityIds] }, user: { kind: 'learner' } },
    })
  ).count;
  // PRIVACY: an account without an identity can no longer be linked to anyone; it goes too (D-034).
  tally.learnerUsers += (await db.user.deleteMany({ where: erasableUsers(accounts, true) })).count;
}
