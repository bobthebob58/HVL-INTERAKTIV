/**
 * subjectRows — finds a data subject's rows by their derived keys: the learner rows under their `learnerKey`s, the
 * matched identities and accounts, and counts what an erasure would delete.
 *
 * Why: D-108 scopes a request to the learner's `XapiStatement`, `H5PUserData` and `GradeSyncJob` rows, their learner
 *      `Identity` rows and the learner `User` rows then left without one (D-034). Export, dry run and erasure must
 *      agree on exactly these rows, so one module states the filters and the counts.
 * Spec: DATA-008, DATA-002
 * Invariants:
 *   - Learner rows are selected by `learnerKey IN (derived keys)` only; an empty key list selects nothing.
 *   - Identities are matched by provider and keyed hash; only those of `learner` accounts are in scope. Staff accounts
 *     are counted (`staffAccounts`) and left alone (D-108: staff data is handled by hand).
 *   - An account counts for deletion only when it is a learner's, owns no content and every identity it has is one
 *     the request matched: the dry-run count is what an erasure at the same moment deletes.
 *   - PRIVACY: returns IDs and counts for the CLI's own use; no identifier or key leaves through a log (DATA-009).
 * Collaborators: ./subjectKeys.ts, ./subjectExport.ts, ./subjectErasure.ts, ./dataSubjectRequest.ts,
 *   ../../infra/prismaClient.ts.
 * Tests: apps/server/test/privacy/dsr/dataSubjectRequest.int.test.ts,
 *   apps/server/test/privacy/dsr/dataSubjectErasure.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';
import type { SubjectKeys } from './subjectKeys.js';

/** The tables a request covers, in the order an erasure deletes them. */
export const SUBJECT_TABLES = [
  'gradeSyncJobs',
  'xapiStatements',
  'h5pUserData',
  'learnerIdentities',
  'learnerUsers',
] as const;

/** Rows per covered table: found, deleted, or that a dry run would delete. */
export type SubjectCounts = Record<(typeof SUBJECT_TABLES)[number], number>;

/**
 * A count of zero for every covered table.
 * @returns A fresh tally.
 */
export const emptySubjectCounts = (): SubjectCounts => ({
  gradeSyncJobs: 0,
  xapiStatements: 0,
  h5pUserData: 0,
  learnerIdentities: 0,
  learnerUsers: 0,
});

/** The accounts the request's identifiers match. */
export interface SubjectAccounts {
  /** Matched identities of learner accounts. */
  readonly learnerIdentityIds: readonly string[];
  /** The learner accounts those identities belong to. */
  readonly learnerUserIds: readonly string[];
  /** Staff accounts the identifiers match: out of scope, left alone. */
  readonly staffAccounts: number;
  /** Identities on the matched learner accounts that no identifier given matches (they keep the account). */
  readonly otherIdentities: number;
}

/**
 * The `where` of the learner rows under the request's keys, as Prisma takes it.
 * @param keys - The derived keys.
 * @returns A filter on `learnerKey`.
 */
export const byLearnerKeys = (keys: Pick<SubjectKeys, 'learnerKeys'>) => ({
  learnerKey: { in: [...keys.learnerKeys] },
});

/**
 * Finds the identities and accounts the request's identifiers match.
 * @param db - The database.
 * @param keys - The derived hashes.
 * @returns The learner identities and accounts, and the staff and other identities counted.
 * @spec DATA-008
 */
export async function findSubjectAccounts(db: Database, keys: SubjectKeys): Promise<SubjectAccounts> {
  const { feide, lti } = keys.identityHashes;
  const matches = [
    ...(feide.length > 0 ? [{ provider: 'feide' as const, subjectHash: { in: [...feide] } }] : []),
    ...(lti.length > 0 ? [{ provider: 'lti' as const, subjectHash: { in: [...lti] } }] : []),
  ];
  const found =
    matches.length === 0
      ? []
      : await db.identity.findMany({
          where: { OR: matches },
          select: { id: true, userId: true, user: { select: { kind: true } } },
          orderBy: { id: 'asc' },
        });
  const learner = found.filter((row) => row.user.kind === 'learner');
  const learnerIdentityIds = learner.map((row) => row.id);
  const learnerUserIds = [...new Set(learner.map((row) => row.userId))];
  const staffAccounts = new Set(found.filter((row) => row.user.kind === 'staff').map((row) => row.userId))
    .size;
  const otherIdentities =
    learnerUserIds.length === 0
      ? 0
      : await db.identity.count({
          where: { userId: { in: learnerUserIds }, id: { notIn: learnerIdentityIds } },
        });
  return { learnerIdentityIds, learnerUserIds, staffAccounts, otherIdentities };
}

/**
 * The `where` of the matched learner accounts that an erasure deletes once their matched identities are gone.
 * @param accounts - The matched accounts.
 * @param identitiesGone - True after the identities are deleted (then the account must have none left).
 * @returns A filter on `User`.
 */
export const erasableUsers = (accounts: SubjectAccounts, identitiesGone: boolean) => ({
  id: { in: [...accounts.learnerUserIds] },
  kind: 'learner' as const,
  ownedContent: { none: {} },
  identities: identitiesGone ? { none: {} } : { every: { id: { in: [...accounts.learnerIdentityIds] } } },
});

/**
 * Counts the rows an erasure at this moment would delete, deleting nothing.
 * @param db - The database.
 * @param keys - The derived keys.
 * @param accounts - The matched accounts.
 * @returns The rows per covered table.
 * @spec DATA-008
 */
export async function countSubjectRows(
  db: Database,
  keys: SubjectKeys,
  accounts: SubjectAccounts,
): Promise<SubjectCounts> {
  const where = byLearnerKeys(keys);
  const [gradeSyncJobs, xapiStatements, h5pUserData, learnerIdentities, learnerUsers] = await Promise.all([
    db.gradeSyncJob.count({ where }),
    db.xapiStatement.count({ where }),
    db.h5PUserData.count({ where }),
    db.identity.count({ where: { id: { in: [...accounts.learnerIdentityIds] }, user: { kind: 'learner' } } }),
    db.user.count({ where: erasableUsers(accounts, false) }),
  ]);
  return { gradeSyncJobs, xapiStatements, h5pUserData, learnerIdentities, learnerUsers };
}

/**
 * The academic years stored on learner rows for which no secret is configured: no identifier can find those rows.
 * @param db - The database.
 * @param years - The configured secrets' years.
 * @returns Those years, oldest first.
 * @spec DATA-008
 */
export async function unreachableYears(db: Database, years: readonly number[]): Promise<number[]> {
  // WHY: GROUP BY runs in the database on the indexed column; Prisma's `distinct` would read every row.
  const stored = await Promise.all([
    db.xapiStatement.groupBy({ by: ['academicYear'] }),
    db.h5PUserData.groupBy({ by: ['academicYear'] }),
    db.gradeSyncJob.groupBy({ by: ['academicYear'] }),
  ]);
  const found = new Set(stored.flat().map((row) => row.academicYear));
  return [...found].filter((year) => !years.includes(year)).sort((a, b) => a - b);
}
