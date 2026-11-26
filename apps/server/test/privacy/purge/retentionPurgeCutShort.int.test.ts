/**
 * Integration tests for a real purge run that is cut short (DATA-007, DATA-003, D-144), in the academic years 1998
 * (ended) and 1999: the run's `started` event is in the audit log, with the plan's counts, before its first change;
 * a run whose process ends part-way leaves that event and no other; such a year does not count as purged; and the
 * next run's events show what the run before left.
 *
 * Spec: DATA-007, DATA-003
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Database } from '../../../src/infra/prismaClient.js';
import { minimumGroupSize } from '../../../src/privacy/minimumGroupSize.js';
import { hasCompletedPurge, PURGE_RUN_ACTION } from '../../../src/privacy/purge/purgeAudit.js';
import { runRetentionPurge } from '../../../src/privacy/purge/retentionPurge.js';
import { describeWithServices } from '../../support/services.js';
import { EXPECTED_COUNTS, openPurgeFixture, type PurgeFixture } from './support/purgeFixture.js';
import { withStatementDeletes } from './support/statementDeletes.js';

type AnyCall = (...args: unknown[]) => unknown;

const bound = (target: object, prop: string | symbol): unknown => {
  const value: unknown = Reflect.get(target, prop);
  return typeof value === 'function' ? (value as AnyCall).bind(target) : value;
};

/**
 * The database as a process sees it that ends at its first statement delete: that delete fails and no audit event
 * can be written after it. `atFirstChange` runs when the purge opens its first transaction (the snapshots).
 */
function endingAtStatementDeletes(db: Database, atFirstChange: () => Promise<void>): Database {
  let ended = false;
  let changed = false;
  const gone = (): Promise<never> => Promise.reject(new Error('the process ended'));
  const cut = withStatementDeletes(db, () => {
    ended = true;
    return gone();
  });
  return new Proxy(cut, {
    get(target, prop) {
      if (prop === '$transaction')
        return async (...args: unknown[]) => {
          if (!changed) await atFirstChange();
          changed = true;
          return (bound(target, prop) as AnyCall)(...args);
        };
      if (prop !== 'auditEvent') return bound(target, prop);
      return new Proxy(target.auditEvent, {
        get: (audit, method) => (method === 'create' && ended ? gone : bound(audit, method)),
      });
    },
  });
}

/** What the run before left: its snapshots are written and its grade jobs are gone. */
const REST = { ...EXPECTED_COUNTS, snapshots: 0, gradeSyncJobs: 0 };

describeWithServices('[DATA-007] a purge run that is cut short', () => {
  let fx: PurgeFixture;
  const groupSize = minimumGroupSize(5);
  const request = { dryRun: false, trigger: 'job' as const };
  const eventDetails = async () =>
    (
      await fx.db.auditEvent.findMany({
        where: { action: PURGE_RUN_ACTION, targetId: '1998' },
        orderBy: [{ at: 'asc' }, { id: 'asc' }],
      })
    ).map((event) => event.details);
  beforeAll(async () => {
    fx = await openPurgeFixture(1998);
  });
  afterAll(() => fx.close());

  it('[DATA-007] a real run records its start, with what it is about to do, before its first change', async () => {
    // Arrange
    let atFirstChange: unknown[] = [];
    const db = endingAtStatementDeletes(fx.db, async () => {
      atFirstChange = await eventDetails();
    });
    const started = { ...request, outcome: 'started', years: [1998], counts: EXPECTED_COUNTS };
    // Act: the process ends at the first statement delete
    const run = runRetentionPurge({ db, groupSize }, { ...request, now: fx.runsAt });
    // Assert: the start was on record before anything changed, and is all the cut run left in the log
    await expect(run).rejects.toThrow('the process ended');
    expect(atFirstChange).toEqual([started]);
    expect(await eventDetails()).toEqual([started]);
    expect(await fx.db.gradeSyncJob.count({ where: { academicYear: 1998 } })).toBe(0);
    expect(await fx.db.xapiStatement.count({ where: { academicYear: 1998 } })).toBe(25);
  });

  it('[DATA-003] a year whose run only started does not count as purged', async () => {
    // Act and assert
    expect(await hasCompletedPurge(fx.db, 1998)).toBe(false);
  });

  it('[DATA-007] the next run finishes, and its start shows what the run before left', async () => {
    // Act
    const result = await runRetentionPurge({ db: fx.db, groupSize }, { ...request, now: fx.runsAt });
    // Assert: the first start minus the second is what the cut run did (3 snapshots, 2 grade jobs)
    expect(result.counts).toEqual(REST);
    expect(await eventDetails()).toEqual([
      { ...request, outcome: 'started', years: [1998], counts: EXPECTED_COUNTS },
      { ...request, outcome: 'started', years: [1998], counts: REST },
      { ...request, outcome: 'completed', years: [1998], counts: REST },
    ]);
    expect(await hasCompletedPurge(fx.db, 1998)).toBe(true);
    expect(await fx.db.xapiStatement.count({ where: { academicYear: 1998 } })).toBe(0);
  });
});
