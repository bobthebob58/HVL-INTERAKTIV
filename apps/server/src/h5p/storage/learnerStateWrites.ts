/**
 * learnerStateWrites — one learner-state write (save or delete), and the version-checked way to make it.
 *
 * Why: a learner's page that was opened before a structural save must not write its old state afterwards (D-093,
 *      ./stateWriteVersion.ts). The check and the write share one transaction, and the check holds the activity's
 *      row in share mode, so a reset (../../learningDesign/safeEditing/PrismaLearnerStateStore.ts, which updates
 *      that row first) either waits for the write and then deletes its row, or makes the write wait and see the
 *      new version. A check outside the transaction could pass just before a reset and write just after it.
 * Spec: PROD-013, H5P-005, DATA-002
 * Invariants:
 *   - The state is validated before anything touches the database (a string, storable text), as before.
 *   - `data=0` deletes exactly the key's row; any other state upserts it (D-038).
 *   - A version-checked write writes nothing when the activity's version differs, and marks the expectation stale.
 * Collaborators: ./PrismaContentUserDataStorage.ts, ./stateWriteVersion.ts, ./learnerStateRows.ts,
 *   ./storableText.ts, ../../infra/prismaClient.ts.
 * Tests: apps/server/test/h5p/PrismaContentUserDataStorage.int.test.ts,
 *   apps/server/test/learningDesign/safeEditing/staleStateWrites.int.test.ts
 */
import type { IContentUserData } from '@lumieducation/h5p-server';
import type { Database } from '../../infra/prismaClient.js';
import { isDeleteSignal, type StateKey } from './learnerStateRows.js';
import type { StateWriteExpectation } from './stateWriteVersion.js';
import { assertStorableText } from './storableText.js';

/** A write of one state row, on the client given (the database, or a transaction). */
export type StateWrite = (client: Pick<Database, 'h5PUserData'>) => Promise<unknown>;

/**
 * Prepares the write of one state: a delete for H5P's `data=0`, else an upsert of the JSON string.
 * @param key - The row's unique key.
 * @param userData - What Lumi passed.
 * @returns The write, not yet made.
 * @throws TypeError when the state is not a string; H5pError `hvl:unstorable-text` (400) when it is not storable.
 */
export function stateWrite(key: StateKey, userData: IContentUserData): StateWrite {
  if (isDeleteSignal(userData.userState)) return (client) => client.h5PUserData.deleteMany({ where: key });
  // WHY: h5p.js always posts a JSON string; storing it as one JSON string value needs no migration (D-038).
  if (typeof userData.userState !== 'string') throw new TypeError('content user state must be a string');
  assertStorableText(userData.userState);
  const values = { data: userData.userState, preload: userData.preload, invalidate: userData.invalidate };
  return (client) =>
    client.h5PUserData.upsert({
      where: { contentId_subContentId_dataType_learnerKey_contextId: key },
      update: values,
      create: { ...key, ...values },
    });
}

/**
 * Makes a write only while the activity still has the version the learner's page was rendered with.
 * @param db - Database client.
 * @param contentId - The activity (a UUID, checked by the caller).
 * @param expectation - The page's version; `stale` is set when the write is dropped.
 * @param write - From `stateWrite`.
 * @returns When the transaction is committed.
 */
export async function writeIfVersion(
  db: Database,
  contentId: string,
  expectation: StateWriteExpectation,
  write: StateWrite,
): Promise<void> {
  await db.$transaction(async (tx) => {
    // SECURITY: FOR SHARE serialises this write with a reset of the activity's state (D-093), see the header.
    const rows = await tx.$queryRaw<{ version: number }[]>`
      SELECT "version" FROM "H5PContent" WHERE "id" = ${contentId}::uuid FOR SHARE`;
    if (rows[0]?.version !== expectation.version) {
      expectation.stale = true;
      return;
    }
    await write(tx);
  });
}
