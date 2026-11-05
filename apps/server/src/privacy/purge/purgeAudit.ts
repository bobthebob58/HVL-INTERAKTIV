/**
 * purgeAudit — the audit event of a yearly purge run (`purge.run`), and what the audit log says about which ended
 * years a real run has completed.
 *
 * Why: DATA-007 audits purge runs, and DATA-003 asks each run, dry or real, to write an event with the counts. The job
 *      also reads the log: it starts no second real run for a year whose purge has completed, and D-107 names at
 *      start-up the pseudonym secrets still configured for years the purge has completed (its amendment of
 *      2026-11-04 gives the event's shape).
 * Spec: DATA-007, DATA-003
 * Invariants:
 *   - PRIVACY: the target is the ended academic year (`AcademicYear`); `details` hold only `trigger`, `dryRun`,
 *     `outcome`, `years` and `counts`: numbers and fixed words, never a learner key, ID or free text (DATA-007).
 *   - No actor: `actorUserId` is null for the job and for the CLI (the schema's rule for scheduled jobs).
 *   - A year counts as purged only through an event of a real run whose outcome is `completed`.
 * Collaborators: ./retentionPurge.ts (writes), ./RetentionPurgeJob.ts (reads), ../../infra/prismaClient.ts.
 * Tests: apps/server/test/privacy/purge/retentionPurge.int.test.ts,
 *   apps/server/test/privacy/purge/retentionPurgeJob.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';

/** The audit action of a purge run (DATA-007). */
export const PURGE_RUN_ACTION = 'purge.run';
/** The audit target type of a purge run: the ended academic year, as its four digits. */
export const PURGE_TARGET_TYPE = 'AcademicYear';

/** Who started a run: the leased job or the operations CLI. */
export type PurgeTrigger = 'job' | 'cli';

/** How a run ended. */
export type PurgeOutcome = 'completed' | 'failed';

/** The details of a `purge.run` event. */
export interface PurgeAuditDetails {
  readonly trigger: PurgeTrigger;
  readonly dryRun: boolean;
  readonly outcome: PurgeOutcome;
  /** The stored academic years whose rows the run covered, oldest first. */
  readonly years: readonly number[];
  /** Rows deleted (or, in a dry run, that would be) per table, and snapshots written. */
  readonly counts: Readonly<Record<string, number>>;
}

/** The audit table. */
type AuditTable = Pick<Database, 'auditEvent'>;

/** Only a real run that completed marks a year as purged. */
const COMPLETED_REAL_RUN = [
  { details: { path: ['dryRun'], equals: false } },
  { details: { path: ['outcome'], equals: 'completed' } },
];

/**
 * Writes the audit event of one run.
 * @param db - The database.
 * @param endedYear - The academic year that ended last when the run started.
 * @param details - The trigger, the kind of run, its outcome, the years and the counts.
 * @returns When the event is stored.
 * @spec DATA-007
 */
export async function auditPurgeRun(
  db: AuditTable,
  endedYear: number,
  details: PurgeAuditDetails,
): Promise<void> {
  await db.auditEvent.create({
    data: {
      actorUserId: null,
      action: PURGE_RUN_ACTION,
      targetType: PURGE_TARGET_TYPE,
      targetId: String(endedYear),
      // PRIVACY: counts, years and fixed words only (DATA-007).
      details: { ...details, years: [...details.years], counts: { ...details.counts } },
    },
  });
}

/**
 * Tells whether a real run for an ended year has completed.
 * @param db - The database.
 * @param endedYear - The year.
 * @returns True when the audit log holds a completed real run whose target is that year.
 * @spec DATA-003
 */
export async function hasCompletedPurge(db: AuditTable, endedYear: number): Promise<boolean> {
  const found = await db.auditEvent.findFirst({
    where: {
      action: PURGE_RUN_ACTION,
      targetType: PURGE_TARGET_TYPE,
      targetId: String(endedYear),
      AND: COMPLETED_REAL_RUN,
    },
    select: { id: true },
  });
  return found !== null;
}

/**
 * The latest ended year whose purge has completed; a real run takes every year up to its own, so that year and all
 * before it are purged.
 * @param db - The database.
 * @returns The year, or undefined when no real run has completed.
 * @spec DATA-003
 */
export async function latestPurgedYear(db: AuditTable): Promise<number | undefined> {
  const found = await db.auditEvent.findFirst({
    // WHY: the target is four digits, so its text order is the years' order.
    where: { action: PURGE_RUN_ACTION, targetType: PURGE_TARGET_TYPE, AND: COMPLETED_REAL_RUN },
    orderBy: { targetId: 'desc' },
    select: { targetId: true },
  });
  return found ? Number(found.targetId) : undefined;
}

/**
 * The configured secrets' years that a completed purge has made stale (D-107: operations destroy them).
 * @param secretYears - The years in `PSEUDONYM_SECRETS`.
 * @param purgedThrough - The latest purged year, if any.
 * @returns The secret years up to and including it, oldest first.
 * @spec DATA-003
 */
export const staleSecretYears = (
  secretYears: Iterable<number>,
  purgedThrough: number | undefined,
): number[] =>
  purgedThrough === undefined
    ? []
    : [...secretYears].filter((year) => year <= purgedThrough).sort((a, b) => a - b);
