/**
 * yearSnapshots — the yearly purge's *k*-suppressed snapshots: one `InsightSnapshot` per ended year, activity, context
 * and content version, with the pedagogisk mappe's figures for that year, written before anything is deleted.
 *
 * Why: DATA-003 keeps only aggregate snapshots that already satisfy *k*-suppression, for the mappe. D-107 writes them
 *      per activity, context (D-103) and content version, and has the values follow the mappe's rules (D-095, the
 *      two-sided rate rule included); its amendment of 2026-11-04 makes them the mappe's own figures (`MAPPE-002`)
 *      computed with the mappe's code, so a snapshot can never show what the mappe would hide.
 * Spec: DATA-003, MAPPE-003, INS-006
 * Invariants:
 *   - PRIVACY: a snapshot holds aggregates only: `participants`, `completionRate`, `medianAttempts` and `changePoints`
 *     as `activityAggregates` gives them (a hidden value is absent; below *k*, only `suppressed: true`), with
 *     `source`, `academicYear` and `suppressed`. No learner key, count of a group below *k* or answer is stored.
 *   - Groups inside a snapshot are the mappe's (context, version and semester), and a group below *k* is left out
 *     (../../learningDesign/mappe/learnerSummaries.ts), so the year's figures and insight's semester views of the same
 *     rows obey the same rules.
 *   - The period is the academic year: from 1 August of the year to the next 1 August, midnight in Oslo; `k` is the
 *     configured size.
 *   - A year's snapshots are written in one transaction, under a PostgreSQL advisory lock, and only when the year has
 *     none, so a second run (or a second node) writes none and a failed run leaves either all or none.
 * Collaborators: ./yearSnapshotInputs.ts, ./purgeCalendar.ts (`academicYearStart`), ./retentionPurge.ts (the caller),
 *   ../../learningDesign/mappe/activityResults.ts, ../../learningDesign/mappe/learnerSummaries.ts,
 *   ../minimumGroupSize.ts, ../../infra/prismaClient.ts.
 * Tests: apps/server/test/privacy/purge/yearSnapshots.test.ts,
 *   apps/server/test/privacy/purge/retentionPurge.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';
import { activityAggregates } from '../../learningDesign/mappe/activityResults.js';
import { learnerSummaries } from '../../learningDesign/mappe/learnerSummaries.js';
import type { MinimumGroupSize } from '../minimumGroupSize.js';
import { academicYearStart } from './purgeCalendar.js';
import {
  readYearActivityRows,
  yearActivities,
  yearPlaces,
  type YearActivityRows,
} from './yearSnapshotInputs.js';

/** `aggregates.source` of a snapshot the yearly purge wrote. */
export const SNAPSHOT_SOURCE = 'yearly-purge';

/** WHY: one fixed advisory-lock key serialises the snapshot writes of every node and of the CLI. */
const SNAPSHOT_LOCK_KEY = 2026_1107;
/** How long one year's snapshot transaction, its wait for the lock included, may take. */
const SNAPSHOT_TRANSACTION_MS = 120_000;

/** What a purge snapshot's `aggregates` holds. */
export interface YearSnapshotAggregates {
  readonly source: typeof SNAPSHOT_SOURCE;
  /** The stored academic year the figures are of. */
  readonly academicYear: number;
  /** True when no group of the place had *k* learners, so nothing else is shown. */
  readonly suppressed: boolean;
  readonly participants?: number;
  readonly completionRate?: number;
  readonly medianAttempts?: number;
  readonly changePoints?: number;
}

/** One snapshot as it is written. */
export interface YearSnapshotRow {
  readonly contentId: string;
  /** `<platformId>:<contextId>` (D-103), or null for the portal's plays. */
  readonly contextId: string | null;
  readonly contentVersion: number;
  readonly periodStart: Date;
  readonly periodEnd: Date;
  readonly k: number;
  readonly aggregates: YearSnapshotAggregates;
}

const placeKey = (place: { contextId: string | null; contentVersion: number }): string =>
  JSON.stringify([place.contextId, place.contentVersion]);

/**
 * The snapshots of one activity's stored year: one per context and version it was played in.
 * @param size - The configured *k*.
 * @param year - The stored academic year.
 * @param contentId - The activity.
 * @param rows - Its presences and root results of that year (`readYearActivityRows`).
 * @returns The snapshots, the portal's first, then by context and version.
 * @spec DATA-003
 */
export function yearSnapshotRows(
  size: MinimumGroupSize,
  year: number,
  contentId: string,
  rows: YearActivityRows,
): YearSnapshotRow[] {
  const places = new Map<string, { contextId: string | null; contentVersion: number }>();
  for (const presence of rows.presences) places.set(placeKey(presence), presence);
  const context = (place: { contextId: string | null }): string => place.contextId ?? '';
  const ordered = [...places.values()].sort(
    (a, b) =>
      Number(a.contextId !== null) - Number(b.contextId !== null) ||
      (context(a) < context(b) ? -1 : context(a) > context(b) ? 1 : 0) ||
      a.contentVersion - b.contentVersion,
  );
  return ordered.map(({ contextId, contentVersion }) => {
    const key = placeKey({ contextId, contentVersion });
    const summaries = learnerSummaries(
      size,
      rows.presences.filter((presence) => placeKey(presence) === key),
      rows.results.filter((result) => placeKey(result) === key),
    ).get(contentId);
    // PRIVACY: the mappe's own rules decide what may be shown (D-095); below k only `suppressed` is kept (DATA-003).
    const { recorded: _recorded, ...figures } = activityAggregates(size, summaries ?? []);
    return {
      contentId,
      contextId,
      contentVersion,
      periodStart: academicYearStart(year),
      periodEnd: academicYearStart(year + 1),
      k: size.k,
      aggregates: { source: SNAPSHOT_SOURCE, academicYear: year, ...figures },
    };
  });
}

/** The snapshot table, read or written inside a transaction or not. */
type SnapshotTable = Pick<Database, 'insightSnapshot'>;

/**
 * Tells whether the purge has already written a stored year's snapshots.
 * @param db - The database or a transaction.
 * @param year - The stored academic year.
 * @returns True when a purge snapshot of that year exists.
 * @spec DATA-003
 */
export async function yearHasSnapshots(db: SnapshotTable, year: number): Promise<boolean> {
  const found = await db.insightSnapshot.findFirst({
    where: {
      periodStart: academicYearStart(year),
      periodEnd: academicYearStart(year + 1),
      aggregates: { path: ['source'], equals: SNAPSHOT_SOURCE },
    },
    select: { id: true },
  });
  return found !== null;
}

/**
 * Counts the snapshots a purge before `currentYear` would write, writing none.
 * @param db - The database.
 * @param currentYear - The current academic year.
 * @returns One per stored year, activity, context and version, for the years without snapshots.
 * @spec DATA-003
 */
export async function plannedSnapshots(
  db: Pick<Database, 'xapiStatement' | 'insightSnapshot'>,
  currentYear: number,
): Promise<number> {
  const places = await yearPlaces(db, currentYear);
  const years = [...new Set(places.map((place) => place.year))];
  const done = new Set<number>();
  for (const year of years) if (await yearHasSnapshots(db, year)) done.add(year);
  return places.filter((place) => !done.has(place.year)).length;
}

/**
 * Writes the snapshots of every stored year before `currentYear` that has none yet.
 * @param db - The database.
 * @param size - The configured *k*.
 * @param currentYear - The current academic year; its rows are never read.
 * @returns How many snapshots were written.
 * @spec DATA-003
 */
export async function writeYearSnapshots(
  db: Database,
  size: MinimumGroupSize,
  currentYear: number,
): Promise<number> {
  const activities = await yearActivities(db, currentYear);
  let written = 0;
  for (const year of [...new Set(activities.map((activity) => activity.year))]) {
    if (await yearHasSnapshots(db, year)) continue;
    const rows: YearSnapshotRow[] = [];
    for (const { contentId } of activities.filter((activity) => activity.year === year)) {
      rows.push(...yearSnapshotRows(size, year, contentId, await readYearActivityRows(db, contentId, year)));
    }
    written += await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SNAPSHOT_LOCK_KEY}::bigint)`;
        if (await yearHasSnapshots(tx, year)) return 0;
        const { count } = await tx.insightSnapshot.createMany({
          data: rows.map((row) => ({ ...row, aggregates: { ...row.aggregates } })),
        });
        return count;
      },
      // WHY: the wait for another writer's lock counts against the transaction's time, 5 s by default in Prisma.
      { timeout: SNAPSHOT_TRANSACTION_MS },
    );
  }
  return written;
}
