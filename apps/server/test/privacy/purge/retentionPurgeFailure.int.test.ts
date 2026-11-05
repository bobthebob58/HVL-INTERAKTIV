/**
 * Integration tests for the purge CLI and for a run that fails part-way (DATA-003 as amended by D-107, DATA-007), in
 * the academic years 2016 (ended) and 2017: the CLI's usage, its refusal of a real run before 31 August, its audited
 * dry run; a run that fails after its snapshots, audited with what it did, and the next run finishing the rest
 * without writing the snapshots again.
 *
 * Spec: DATA-003, DATA-007
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { Database } from '../../../src/infra/prismaClient.js';
import { minimumGroupSize } from '../../../src/privacy/minimumGroupSize.js';
import { PURGE_RUN_ACTION } from '../../../src/privacy/purge/purgeAudit.js';
import { PURGE_USAGE, runPurgeCli } from '../../../src/privacy/purge/purgeCli.js';
import { runRetentionPurge } from '../../../src/privacy/purge/retentionPurge.js';
import { describeWithServices } from '../../support/services.js';
import { EXPECTED_COUNTS, openPurgeFixture, type PurgeFixture } from './support/purgeFixture.js';
import { withStatementDeletes } from './support/statementDeletes.js';

/** 30 August 2017, 23:00 in Oslo: the last hour before the default run date. */
const BEFORE_RUN_DATE = new Date('2017-08-30T21:00:00.000Z');

/** The database, except that deleting statements fails, as a lost connection would; reading them works. */
const failingAtStatementDeletes = (db: Database): Database =>
  withStatementDeletes(db, () => Promise.reject(new Error('connection lost')));

describeWithServices('[DATA-003] the purge CLI and a failed run', () => {
  let fx: PurgeFixture;
  const lines: string[] = [];
  const env = { MIN_GROUP_SIZE: 5, PSEUDONYM_SECRETS: new Map([[2016, Buffer.alloc(32, 7)]]) };
  const cli = (argv: string[], now: Date) =>
    runPurgeCli(argv, { env, db: fx.db, now, write: (line) => void lines.push(line) });
  const statementsOf2016 = () => fx.db.xapiStatement.count({ where: { academicYear: 2016 } });
  beforeAll(async () => {
    fx = await openPurgeFixture(2016);
  });
  afterAll(() => fx.close());

  it('[DATA-003] the CLI prints its usage and exits 2 unless given exactly --dry-run or --execute', async () => {
    // Act and assert
    expect(await cli([], fx.runsAt)).toBe(2);
    expect(await cli(['--dry-run', '--execute'], fx.runsAt)).toBe(2);
    expect(lines.splice(0)).toEqual([PURGE_USAGE, PURGE_USAGE]);
    expect(await statementsOf2016()).toBe(25);
  });

  it('[DATA-003] the CLI refuses a real run before 31 August in Oslo and deletes nothing', async () => {
    // Act
    const code = await cli(['--execute'], BEFORE_RUN_DATE);
    // Assert
    expect(code).toBe(1);
    expect(lines.splice(0)).toEqual([
      'refused: the purge of academic year 2016 may run from 2017-08-31 (PURGE_RUN_DATE, D-107)',
    ]);
    expect(await statementsOf2016()).toBe(25);
    expect(await fx.db.auditEvent.count({ where: { action: PURGE_RUN_ACTION, targetId: '2016' } })).toBe(0);
  });

  it('[DATA-003] the CLI’s dry run runs on any day, prints the counts and is audited as the CLI’s', async () => {
    // Act
    const code = await cli(['--dry-run'], BEFORE_RUN_DATE);
    // Assert
    expect(code).toBe(0);
    expect(lines.splice(0).map((line) => JSON.parse(line) as unknown)).toEqual([
      { endedYear: 2016, years: [2016], dryRun: true, counts: EXPECTED_COUNTS },
    ]);
    const event = await fx.db.auditEvent.findFirstOrThrow({
      where: { action: PURGE_RUN_ACTION, targetId: '2016' },
    });
    expect(event.details).toMatchObject({ trigger: 'cli', dryRun: true, outcome: 'completed' });
    expect(await statementsOf2016()).toBe(25);
  });

  it('[DATA-007] a run that fails part-way is audited as failed with what it did, then rethrows', async () => {
    // Arrange
    const deps = { db: failingAtStatementDeletes(fx.db), groupSize: minimumGroupSize(5) };
    // Act
    const failed = runRetentionPurge(deps, { now: fx.runsAt, dryRun: false, trigger: 'job' });
    // Assert
    await expect(failed).rejects.toThrow('connection lost');
    const event = await fx.db.auditEvent.findFirstOrThrow({
      where: { action: PURGE_RUN_ACTION, targetId: '2016', details: { path: ['outcome'], equals: 'failed' } },
    });
    expect(event.details).toEqual({
      trigger: 'job',
      dryRun: false,
      outcome: 'failed',
      years: [2016],
      counts: {
        snapshots: 3,
        gradeSyncJobs: 2,
        xapiStatements: 0,
        h5pUserData: 0,
        learnerIdentities: 0,
        learnerUsers: 0,
      },
    });
    expect(await statementsOf2016()).toBe(25);
  });

  it('[DATA-003] the CLI’s real run from 31 August finishes the rest and names the secret to destroy', async () => {
    // Act
    const code = await cli(['--execute'], fx.runsAt);
    // Assert: the snapshots and the grade jobs went in the failed run; the rest goes now, the snapshots stay as written.
    expect(code).toBe(0);
    const [result, reminder] = lines.splice(0).map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(result).toMatchObject({
      years: [2016],
      counts: { ...EXPECTED_COUNTS, snapshots: 0, gradeSyncJobs: 0 },
    });
    expect(reminder?.removePseudonymSecretsOfYears).toEqual([2016]);
    expect(await fx.db.insightSnapshot.count({ where: { contentId: fx.contentId } })).toBe(3);
  });
});
