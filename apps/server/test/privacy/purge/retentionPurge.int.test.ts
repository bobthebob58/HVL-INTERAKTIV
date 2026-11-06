/**
 * Integration tests for the yearly purge on PostgreSQL (DATA-003 as amended by D-107, DATA-007), travelling in time
 * to midnight in Oslo on 31 August 2011: a dry run counts and deletes nothing; a real run writes the year's
 * k-suppressed snapshots, then deletes 2010's rows by their stored year and the accounts D-107 names; the current
 * year stays; a second run changes nothing; every run is audited with counts only.
 *
 * Spec: DATA-003, DATA-007, DATA-002, MAPPE-003
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { minimumGroupSize } from '../../../src/privacy/minimumGroupSize.js';
import { PURGE_RUN_ACTION } from '../../../src/privacy/purge/purgeAudit.js';
import { runRetentionPurge } from '../../../src/privacy/purge/retentionPurge.js';
import { SNAPSHOT_SOURCE } from '../../../src/privacy/purge/yearSnapshots.js';
import { describeWithServices } from '../../support/services.js';
import { EXPECTED_COUNTS, openPurgeFixture, type PurgeFixture } from './support/purgeFixture.js';

const NOTHING = {
  snapshots: 0,
  gradeSyncJobs: 0,
  xapiStatements: 0,
  h5pUserData: 0,
  learnerIdentities: 0,
  learnerUsers: 0,
};

describeWithServices('[DATA-003] the yearly purge on PostgreSQL', () => {
  let fx: PurgeFixture;
  beforeAll(async () => {
    fx = await openPurgeFixture(2010);
  });
  afterAll(() => fx.close());

  const run = (dryRun: boolean) =>
    runRetentionPurge(
      { db: fx.db, groupSize: minimumGroupSize(5) },
      { now: fx.runsAt, dryRun, trigger: 'job' },
    );
  /** The fixture's rows per table and year, and its snapshots. */
  const left = async () => {
    const byYear = async (count: (year: number) => Promise<number>) => [await count(2010), await count(2011)];
    return {
      statements: await byYear((academicYear) => fx.db.xapiStatement.count({ where: { academicYear } })),
      states: await byYear((academicYear) => fx.db.h5PUserData.count({ where: { academicYear } })),
      jobs: await byYear((academicYear) => fx.db.gradeSyncJob.count({ where: { academicYear } })),
      snapshots: await fx.db.insightSnapshot.count({ where: { contentId: fx.contentId } }),
    };
  };

  // WHY: these tests are one scenario in order. The runs below also carry [DATA-007], so that a run of that ID alone
  // (`-t '\[DATA-007\]'`) makes the four runs whose audit events the last test reads.
  it('[DATA-003][DATA-007] a dry run reports the counts per table and changes nothing', async () => {
    // Act
    const result = await run(true);
    // Assert
    expect(result).toEqual({ endedYear: 2010, years: [2010], dryRun: true, counts: EXPECTED_COUNTS });
    expect(await left()).toEqual({ statements: [25, 2], states: [3, 1], jobs: [2, 1], snapshots: 0 });
    expect(await fx.db.user.count({ where: { id: { in: Object.values(fx.accounts) } } })).toBe(6);
  });

  it('[DATA-003][DATA-007] a real run writes the year’s k-suppressed snapshots, then deletes 2010’s rows by their stored year', async () => {
    // Act
    const result = await run(false);
    // Assert: the statement stored on 1 August 2011 with 2010's key went with 2010 (D-107); the test student's went
    // too but counts in no snapshot (6 participants, not 7).
    expect(result).toEqual({ endedYear: 2010, years: [2010], dryRun: false, counts: EXPECTED_COUNTS });
    expect(await left()).toEqual({ statements: [0, 2], states: [0, 1], jobs: [0, 1], snapshots: 3 });
    const snapshots = await fx.db.insightSnapshot.findMany({
      where: { contentId: fx.contentId },
      orderBy: [{ contentVersion: 'asc' }, { contextId: { sort: 'asc', nulls: 'first' } }],
    });
    expect(snapshots.map((row) => [row.contextId, row.contentVersion, row.k])).toEqual([
      [null, 1, 5],
      [fx.course, 1, 5],
      [fx.course, 2, 5],
    ]);
    expect(snapshots.map((row) => [row.periodStart.toISOString(), row.periodEnd.toISOString()])).toEqual(
      Array(3).fill(['2010-07-31T22:00:00.000Z', '2011-07-31T22:00:00.000Z']),
    );
    expect(snapshots.map((row) => row.aggregates)).toEqual([
      { source: SNAPSHOT_SOURCE, academicYear: 2010, suppressed: true },
      {
        source: SNAPSHOT_SOURCE,
        academicYear: 2010,
        suppressed: false,
        participants: 6,
        medianAttempts: 2,
        changePoints: expect.closeTo(32, 9) as number,
      },
      { source: SNAPSHOT_SOURCE, academicYear: 2010, suppressed: true },
    ]);
  });

  it('[DATA-003] keeps the current year’s accounts and removes learner accounts left without an identity (D-034)', async () => {
    // Act
    const users = await fx.db.user.findMany({
      where: { id: { in: Object.values(fx.accounts) } },
      select: { id: true, identities: { select: { createdAt: true } } },
    });
    // Assert
    const identitiesOf = (id: string) => users.find((user) => user.id === id)?.identities.length;
    const { old, linked, fresh, bare, bareFresh, staff } = fx.accounts;
    expect([old, bare].map(identitiesOf)).toEqual([undefined, undefined]);
    expect([linked, fresh, bareFresh, staff].map(identitiesOf)).toEqual([1, 1, 0, 1]);
    const cutoff = new Date('2011-07-31T22:00:00.000Z');
    const orphans = { kind: 'learner' as const, createdAt: { lt: cutoff }, identities: { none: {} } };
    expect(await fx.db.user.count({ where: orphans })).toBe(0);
  });

  it('[DATA-003][DATA-007] is idempotent: a second run deletes nothing and writes no snapshot', async () => {
    // Act
    const dry = await run(true);
    const real = await run(false);
    // Assert
    expect(dry.counts).toEqual(NOTHING);
    expect(real).toEqual({ endedYear: 2010, years: [], dryRun: false, counts: NOTHING });
    expect(await left()).toEqual({ statements: [0, 2], states: [0, 1], jobs: [0, 1], snapshots: 3 });
  });

  it('[DATA-007] audits every run, dry or real, with counts, years and fixed words only, and no actor', async () => {
    // Act
    const events = await fx.db.auditEvent.findMany({
      where: { action: PURGE_RUN_ACTION, targetId: '2010' },
      orderBy: [{ at: 'asc' }, { id: 'asc' }],
    });
    // Assert
    expect(events.map((event) => [event.actorUserId, event.targetType, event.targetId])).toEqual(
      Array(4).fill([null, 'AcademicYear', '2010']),
    );
    expect(events.map((event) => event.details)).toEqual([
      { trigger: 'job', dryRun: true, outcome: 'completed', years: [2010], counts: EXPECTED_COUNTS },
      { trigger: 'job', dryRun: false, outcome: 'completed', years: [2010], counts: EXPECTED_COUNTS },
      { trigger: 'job', dryRun: true, outcome: 'completed', years: [], counts: NOTHING },
      { trigger: 'job', dryRun: false, outcome: 'completed', years: [], counts: NOTHING },
    ]);
  });
});
