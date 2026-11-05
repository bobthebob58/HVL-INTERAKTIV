/**
 * retentionPurge — one run of the yearly purge, dry or real, from the job or the CLI: the years it covers, the plan
 * (rows per table and snapshots), the snapshots, the deletions and the audit event.
 *
 * Why: DATA-003 deletes the ended academic year's learner rows, keeps only *k*-suppressed snapshots for the mappe, and
 *      offers a dry run that reports counts; every run writes an audit event with the counts (DATA-007). D-107 has a
 *      leased job and a CLI run the same code; its amendment of 2026-11-04 fixes the order and the audit's shape.
 * Spec: DATA-003, DATA-007
 * Invariants:
 *   - A dry run deletes and writes nothing but its audit event; its counts are what a real run at the same moment
 *     would delete and write.
 *   - A real run writes the snapshots first (./yearSnapshots.ts), then deletes (./purgeTables.ts); the current
 *     academic year's rows are never selected.
 *   - Every run writes one `purge.run` event: `completed` with its counts, or `failed` with the counts of what it did
 *     before the error, which it then rethrows (./purgeAudit.ts).
 *   - Idempotent: a second real run deletes nothing and writes no snapshot; it is audited like any run.
 *   - It does not decide whether the date allows a run: the job and the CLI check the run date (./purgeCalendar.ts).
 *   - PRIVACY: returns and audits counts and years only; nothing is logged here.
 * Collaborators: ./purgeCalendar.ts, ./purgeTables.ts, ./yearSnapshots.ts, ./purgeAudit.ts, ./RetentionPurgeJob.ts,
 *   ./purgeCli.ts, ../minimumGroupSize.ts, ../../infra/prismaClient.ts.
 * Tests: apps/server/test/privacy/purge/retentionPurge.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';
import type { MinimumGroupSize } from '../minimumGroupSize.js';
import { purgeScopeAt, type PurgeScope } from './purgeCalendar.js';
import { auditPurgeRun, type PurgeTrigger } from './purgeAudit.js';
import { countPurgeRows, deletePurgeRows, emptyTableCounts, type PurgeTableCounts } from './purgeTables.js';
import { plannedSnapshots, writeYearSnapshots } from './yearSnapshots.js';

/** What a run needs. */
export interface RetentionPurgeDeps {
  readonly db: Database;
  /** The configured *k* (`minimumGroupSize(env.MIN_GROUP_SIZE)`), for the snapshots. */
  readonly groupSize: MinimumGroupSize;
}

/** One run's request. */
export interface RetentionPurgeRequest {
  /** The run's moment; it decides the current and the ended academic year. */
  readonly now: Date;
  /** True to count only. */
  readonly dryRun: boolean;
  readonly trigger: PurgeTrigger;
}

/** Snapshots written and rows deleted per table (or, in a dry run, that would be). */
export type PurgeCounts = { snapshots: number } & PurgeTableCounts;

/** What one run did. */
export interface RetentionPurgeResult {
  /** The year that had ended last at the run's moment, which the audit event names. */
  readonly endedYear: number;
  /** The stored academic years whose rows the run covered, oldest first. */
  readonly years: readonly number[];
  readonly dryRun: boolean;
  readonly counts: PurgeCounts;
}

/**
 * The stored academic years before the current one that still have learner rows.
 * @param db - The database.
 * @param currentYear - The current academic year.
 * @returns The years, oldest first.
 * @spec DATA-003
 */
export async function yearsWithRows(db: Database, currentYear: number): Promise<number[]> {
  const before = { academicYear: { lt: currentYear } };
  const groups = await Promise.all([
    db.xapiStatement.groupBy({ by: ['academicYear'], where: before }),
    db.h5PUserData.groupBy({ by: ['academicYear'], where: before }),
    db.gradeSyncJob.groupBy({ by: ['academicYear'], where: before }),
  ]);
  return [...new Set(groups.flat().map((group) => group.academicYear))].sort((a, b) => a - b);
}

/**
 * What a real run at the scope's moment would do, changing nothing.
 * @param db - The database.
 * @param scope - What the run covers (`purgeScopeAt`).
 * @returns The years and the counts.
 * @spec DATA-003
 */
export async function planRetentionPurge(
  db: Database,
  scope: PurgeScope,
): Promise<{ readonly years: number[]; readonly counts: PurgeCounts }> {
  const [years, snapshots, tables] = await Promise.all([
    yearsWithRows(db, scope.currentYear),
    plannedSnapshots(db, scope.currentYear),
    countPurgeRows(db, scope),
  ]);
  return { years, counts: { snapshots, ...tables } };
}

/**
 * Runs the purge once, dry or real, and audits the run.
 * @param deps - The database and *k*.
 * @param request - The moment, whether to count only, and who started it.
 * @returns What the run did (or, dry, would do).
 * @throws Whatever the database throws during a real run, after the failed run is audited.
 * @example
 * const plan = await runRetentionPurge({ db, groupSize }, { now: new Date(), dryRun: true, trigger: 'cli' });
 * @spec DATA-003
 */
export async function runRetentionPurge(
  deps: RetentionPurgeDeps,
  request: RetentionPurgeRequest,
): Promise<RetentionPurgeResult> {
  const { db } = deps;
  const { trigger, dryRun } = request;
  const scope = purgeScopeAt(request.now);
  if (dryRun) {
    const plan = await planRetentionPurge(db, scope);
    await auditPurgeRun(db, scope.endedYear, { trigger, dryRun, outcome: 'completed', ...plan });
    return { endedYear: scope.endedYear, dryRun, ...plan };
  }
  const years = await yearsWithRows(db, scope.currentYear);
  const counts: PurgeCounts = { snapshots: 0, ...emptyTableCounts() };
  try {
    // PRIVACY: the k-suppressed snapshots are written before anything is deleted, and are all that remains (DATA-003).
    counts.snapshots = await writeYearSnapshots(db, deps.groupSize, scope.currentYear);
    await deletePurgeRows(db, scope, counts);
  } catch (error) {
    // WHY: a failed run is audited with what it did; if even that write fails, the run's own error is reported.
    await auditPurgeRun(db, scope.endedYear, { trigger, dryRun, outcome: 'failed', years, counts }).catch(
      () => undefined,
    );
    throw error;
  }
  await auditPurgeRun(db, scope.endedYear, { trigger, dryRun, outcome: 'completed', years, counts });
  return { endedYear: scope.endedYear, years, dryRun, counts };
}
