/**
 * purgeTables — counts and deletes, in batches, the learner rows the yearly purge removes: the grade jobs, xAPI
 * statements and H5P states of the years before the current one (by their stored `academicYear`), the learner
 * identities created before the current year began, and the learner accounts then left without one.
 *
 * Why: DATA-003 deletes `XapiStatement`, `H5PUserData`, `GradeSyncJob` and learner `Identity` rows, then learner `User`
 *      rows without an `Identity` (D-034). D-107 selects the first three by the year stored with each row, never by a
 *      timestamp, and deletes in batched transactions; its amendment of 2026-11-04 fixes the order, the batches and
 *      the accounts a run leaves alone.
 * Spec: DATA-003, DATA-002
 * Invariants:
 *   - SPEC-DEVIATION: D-107 — rows go by their stored `academicYear` (every year before the current one), not by "older
 *     than the academic-year boundary plus 30 days"; a row of the current year is never selected.
 *   - Order: `GradeSyncJob`, `XapiStatement`, `H5PUserData`, learner `Identity`, learner `User`; each table in
 *     transactions of at most `PURGE_BATCH_SIZE` rows, each counted in the tally as soon as it is committed, so a run
 *     that fails part-way reports what it did.
 *   - A table is done only when a page comes back empty or short; a batch that deletes fewer rows than it found
 *     (another writer took them) goes on to the next page, and the same page found twice with nothing deleted fails
 *     the run instead of looping.
 *   - Only learner identities and accounts are touched (`User.kind = learner`); an account goes only when it has no
 *     identity left, was created before the current year began, and owns no activity.
 *   - Each delete repeats the filter its page was read with, so a row that stopped matching in between (a learner a
 *     login made staff) is left alone and not counted.
 *   - The dry-run count is exactly what a deletion at the same moment would remove, an account included when the
 *     only identities it has would go first.
 *   - PRIVACY: returns counts only; no row, key or ID leaves this module.
 * Collaborators: ./purgeCalendar.ts (`PurgeScope`), ./retentionPurge.ts (the caller), ../../infra/prismaClient.ts.
 * Tests: apps/server/test/privacy/purge/retentionPurge.int.test.ts,
 *   apps/server/test/privacy/purge/purgeBatches.int.test.ts, apps/server/test/privacy/purge/purgeRaces.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';
import type { PurgeScope } from './purgeCalendar.js';

/** The most rows one delete transaction removes. */
export const PURGE_BATCH_SIZE = 1000;

/** The tables the purge deletes from, in the order it deletes them. */
export const PURGED_TABLES = [
  'gradeSyncJobs',
  'xapiStatements',
  'h5pUserData',
  'learnerIdentities',
  'learnerUsers',
] as const;

/** How many rows of each purged table a run deleted, or a dry run would delete. */
export type PurgeTableCounts = Record<(typeof PURGED_TABLES)[number], number>;

/** The tables a purge reads and writes. */
export type PurgeDatabase = Pick<
  Database,
  'gradeSyncJob' | 'xapiStatement' | 'h5PUserData' | 'identity' | 'user'
>;

/**
 * A count of zero for every purged table.
 * @returns A fresh tally.
 */
export const emptyTableCounts = (): PurgeTableCounts => ({
  gradeSyncJobs: 0,
  xapiStatements: 0,
  h5pUserData: 0,
  learnerIdentities: 0,
  learnerUsers: 0,
});

/** The `where` of each table's rows that a purge in `scope` removes, as Prisma takes it. */
function filtersOf(scope: PurgeScope) {
  // SPEC-DEVIATION: D-107 — by the stored year of the secret behind each row's learnerKey, never by a timestamp.
  const endedYears = { academicYear: { lt: scope.currentYear } };
  const learnerBefore = { kind: 'learner' as const, createdAt: { lt: scope.cutoff } };
  return {
    endedYears,
    learnerIdentities: { createdAt: { lt: scope.cutoff }, user: { kind: 'learner' as const } },
    // WHY: an account made in the current year belongs to it, and the purge leaves the current year alone (D-107
    //      amendment); `ownedContent` would refuse the delete (Restrict), so an owner is never selected.
    learnerUsers: { ...learnerBefore, identities: { none: {} }, ownedContent: { none: {} } },
    // WHY: before the identities go, an account counts when only identities that will go are left on it.
    learnerUsersAfterIdentities: {
      ...learnerBefore,
      identities: { none: { createdAt: { gte: scope.cutoff } } },
      ownedContent: { none: {} },
    },
  };
}

/**
 * Counts what a purge at the scope's moment would delete, deleting nothing.
 * @param db - The database.
 * @param scope - What the purge covers (`purgeScopeAt`).
 * @returns The rows per table.
 * @spec DATA-003
 */
export async function countPurgeRows(db: PurgeDatabase, scope: PurgeScope): Promise<PurgeTableCounts> {
  const where = filtersOf(scope);
  const [gradeSyncJobs, xapiStatements, h5pUserData, learnerIdentities, learnerUsers] = await Promise.all([
    db.gradeSyncJob.count({ where: where.endedYears }),
    db.xapiStatement.count({ where: where.endedYears }),
    db.h5PUserData.count({ where: where.endedYears }),
    db.identity.count({ where: where.learnerIdentities }),
    db.user.count({ where: where.learnerUsersAfterIdentities }),
  ]);
  return { gradeSyncJobs, xapiStatements, h5pUserData, learnerIdentities, learnerUsers };
}

/**
 * Deletes one table's rows in batches, adding each committed batch to the tally, until a page comes back short.
 * @throws Error when the same page is found twice and deletes nothing, so the run fails (and is audited) instead of
 *   looping.
 */
async function inBatches(
  next: () => Promise<readonly { id: string }[]>,
  remove: (ids: string[]) => Promise<{ count: number }>,
  add: (count: number) => void,
): Promise<void> {
  let stalled: string | undefined;
  for (;;) {
    const ids = (await next()).map((row) => row.id);
    if (ids.length === 0) return;
    const { count } = await remove(ids);
    add(count);
    if (ids.length < PURGE_BATCH_SIZE) return;
    // WHY: a batch whose rows another writer took (an activity deleted, a state reset, a second run) deletes fewer or
    //      none; stopping there would leave the rest a year under a completed audit (D-107 amendment, step 5 review).
    const page = [...ids].sort().join(',');
    if (count === 0 && page === stalled) throw new Error('the yearly purge made no progress on a table');
    stalled = count === 0 ? page : undefined;
  }
}

/**
 * Deletes what a purge at the scope's moment removes, table by table in the documented order.
 * @param db - The database.
 * @param scope - What the purge covers (`purgeScopeAt`).
 * @param tally - Receives each table's count as its batches commit, also when a later batch fails.
 * @returns When every table is done.
 * @throws Whatever the database throws; `tally` then holds what was deleted before.
 * @spec DATA-003
 */
export async function deletePurgeRows(
  db: PurgeDatabase,
  scope: PurgeScope,
  tally: PurgeTableCounts,
): Promise<void> {
  const where = filtersOf(scope);
  const page = { select: { id: true }, take: PURGE_BATCH_SIZE } as const;
  // SECURITY: each delete repeats its page's filter, so a row that stopped matching after the page was read stays: a
  //           learner a login made staff meanwhile keeps their identity (D-107 amendment, second step 5 review).
  const ofYears = (ids: string[]) => ({ where: { id: { in: ids }, ...where.endedYears } });
  await inBatches(
    () => db.gradeSyncJob.findMany({ where: where.endedYears, ...page }),
    (ids) => db.gradeSyncJob.deleteMany(ofYears(ids)),
    (count) => (tally.gradeSyncJobs += count),
  );
  await inBatches(
    () => db.xapiStatement.findMany({ where: where.endedYears, ...page }),
    (ids) => db.xapiStatement.deleteMany(ofYears(ids)),
    (count) => (tally.xapiStatements += count),
  );
  await inBatches(
    () => db.h5PUserData.findMany({ where: where.endedYears, ...page }),
    (ids) => db.h5PUserData.deleteMany(ofYears(ids)),
    (count) => (tally.h5pUserData += count),
  );
  await inBatches(
    () => db.identity.findMany({ where: where.learnerIdentities, ...page }),
    (ids) => db.identity.deleteMany({ where: { id: { in: ids }, ...where.learnerIdentities } }),
    (count) => (tally.learnerIdentities += count),
  );
  // PRIVACY: a learner account without an identity can no longer be linked to anyone; it goes too (D-034).
  await inBatches(
    () => db.user.findMany({ where: where.learnerUsers, ...page }),
    (ids) => db.user.deleteMany({ where: { id: { in: ids }, ...where.learnerUsers } }),
    (count) => (tally.learnerUsers += count),
  );
}
