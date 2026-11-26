/**
 * learnerStateWrites — one learner-state write (save or delete), made within the learner's limits and, when the
 * page names its version, only while the activity still has it.
 *
 * Why: a learner's page that was opened before a structural save must not write its old state afterwards (D-093,
 *      ./stateWriteVersion.ts). The check and the write share one transaction, and the check holds the activity's
 *      row in share mode, so a reset (./PrismaContentStorage.ts with the save's parameters, or
 *      ../../learningDesign/safeEditing/PrismaLearnerStateStore.ts; both update that row first) either waits for the
 *      write and then deletes its row, or makes the write wait and see the new version. A check outside the
 *      transaction could pass just before a reset and write just after it.
 * Spec: PROD-013, H5P-005, DATA-002, DATA-003
 * Invariants:
 *   - The state is validated before anything touches the database (a string, storable text), as before.
 *   - `data=0` deletes exactly the key's row; any other state upserts it (D-038).
 *   - A version-checked write writes nothing when the activity's version differs, and marks the expectation stale.
 *   - Every write runs in one transaction that first takes a lock for the learner, activity and course
 *     (`pg_advisory_xact_lock`), then counts what the learner has stored there and refuses a state that would be
 *     one too many or take the total past its limit (./learnerStateLimits.ts, D-120). So writes at the same moment
 *     cannot pass the limits together. Replacing a stored state counts only the difference; a delete is never
 *     refused.
 *   - An upsert inside `withLearnerKeyYear` stores that year as `academicYear`, on insert and on update (one key has
 *     one year), so the yearly purge deletes the row with its key's year (D-107); outside it the database default
 *     stays.
 * Collaborators: ./PrismaContentUserDataStorage.ts, ./stateWriteVersion.ts, ./learnerStateRows.ts,
 *   ./learnerStateYear.ts, ./learnerStateLimits.ts, ./storableText.ts, ../../infra/prismaClient.ts.
 * Tests: apps/server/test/h5p/PrismaContentUserDataStorage.int.test.ts,
 *   apps/server/test/learningDesign/safeEditing/staleStateWrites.int.test.ts,
 *   apps/server/test/privacy/purge/learnerStateYear.int.test.ts, apps/server/test/http/userDataLimits.int.test.ts
 */
import type { IContentUserData } from '@lumieducation/h5p-server';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Database } from '../../infra/prismaClient.js';
import { LEARNER_STATE_LIMITS, stateTooLarge } from './learnerStateLimits.js';
import { isDeleteSignal, type StateKey } from './learnerStateRows.js';
import { learnerKeyYearOfWrite } from './learnerStateYear.js';
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
  const academicYear = learnerKeyYearOfWrite();
  const values = {
    data: userData.userState,
    preload: userData.preload,
    invalidate: userData.invalidate,
    // PRIVACY: the year of the learner's key, not of the write, so the yearly purge takes the row with its key (DATA-003).
    ...(academicYear === undefined ? {} : { academicYear }),
  };
  return (client) =>
    client.h5PUserData.upsert({
      where: { contentId_subContentId_dataType_learnerKey_contextId: key },
      update: values,
      create: { ...key, ...values },
    });
}

/** One state write and what its limits and its version check need. */
export interface LimitedStateWrite {
  readonly key: StateKey;
  /** From `stateWrite`. */
  readonly write: StateWrite;
  /** The bytes the state takes when stored (`storedStateBytes`); absent for a delete. */
  readonly bytes?: number;
  /** The version of the learner's page, when the write is version-checked; `stale` is set when it is dropped. */
  readonly expectation?: StateWriteExpectation | undefined;
}

/** Refuses a state that would be one too many, or take the learner's total past its limit. */
async function assertRoom(tx: Prisma.TransactionClient, key: StateKey, bytes: number): Promise<void> {
  const [stored] = await tx.$queryRaw<{ rows: number; bytes: number; own: number | null }[]>`
    SELECT count(*)::int AS "rows",
           coalesce(sum(octet_length("data"::text)), 0)::int AS "bytes",
           (sum(octet_length("data"::text))
              FILTER (WHERE "subContentId" = ${key.subContentId} AND "dataType" = ${key.dataType}))::int AS "own"
    FROM "H5PUserData"
    WHERE "contentId" = ${key.contentId}::uuid AND "learnerKey" = ${key.learnerKey}
      AND "contextId" = ${key.contextId}`;
  const { rows = 0, bytes: total = 0, own = null } = stored ?? {};
  const oneTooMany = own === null && rows >= LEARNER_STATE_LIMITS.rows;
  if (oneTooMany || total - (own ?? 0) + bytes > LEARNER_STATE_LIMITS.totalBytes) {
    throw stateTooLarge(LEARNER_STATE_LIMITS.totalBytes);
  }
}

/**
 * Makes a state write within the learner's limits, and only while the activity has the expected version.
 * @param db - Database client.
 * @param limited - The key (its content ID a UUID, checked by the caller), the write, its size and the expectation.
 * @returns When the transaction is committed.
 * @throws HttpError 413 `error.tooLarge` for a state past a limit; nothing is stored then.
 */
export async function writeWithinLimits(db: Database, limited: LimitedStateWrite): Promise<void> {
  const { key, bytes, expectation } = limited;
  if (bytes !== undefined && bytes > LEARNER_STATE_LIMITS.rowBytes) {
    throw stateTooLarge(LEARNER_STATE_LIMITS.rowBytes);
  }
  const scope = `${key.contentId.toLowerCase()}:${key.learnerKey}:${key.contextId}`;
  await db.$transaction(async (tx) => {
    // SECURITY: one write at a time per learner, activity and course, so two cannot both count and then both store.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${scope}, 0))`;
    if (expectation) {
      // SECURITY: FOR SHARE serialises this write with a reset of the activity's state (D-093), see the header.
      const versions = await tx.$queryRaw<{ version: number }[]>`
        SELECT "version" FROM "H5PContent" WHERE "id" = ${key.contentId}::uuid FOR SHARE`;
      if (versions[0]?.version !== expectation.version) {
        expectation.stale = true;
        return;
      }
    }
    if (bytes !== undefined) await assertRoom(tx, key, bytes);
    await limited.write(tx);
  });
}
