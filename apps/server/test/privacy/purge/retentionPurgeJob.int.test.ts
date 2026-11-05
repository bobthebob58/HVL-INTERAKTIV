/**
 * Integration tests for the leased yearly purge job (DATA-003 as amended by D-107), with the injectable moment, in the
 * academic years 2013 (ended) and 2014: nothing of 2013 goes on 31 July, 1 August or 30 August 2014; at midnight in
 * Oslo on 31 August the job logs its plan first and purges 2013 once, though a dry run and a failed run of 2013 are
 * already audited; and it names the secrets of purged years, and nothing when there are none.
 *
 * Spec: DATA-003, DATA-002
 */
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { minimumGroupSize } from '../../../src/privacy/minimumGroupSize.js';
import { auditPurgeRun } from '../../../src/privacy/purge/purgeAudit.js';
import { runRetentionPurge } from '../../../src/privacy/purge/retentionPurge.js';
import { RetentionPurgeJob } from '../../../src/privacy/purge/RetentionPurgeJob.js';
import { capturedLogger } from '../../support/capturedLogger.js';
import { describeWithServices } from '../../support/services.js';
import { EXPECTED_COUNTS, openPurgeFixture, type PurgeFixture } from './support/purgeFixture.js';

const HOUR_MS = 60 * 60 * 1000;
/** A secret per year; 2099's is never purged. Their text must never reach a log line. */
const SECRETS = new Map([2013, 2014, 2099].map((year) => [year, Buffer.alloc(32, year % 251)]));

describeWithServices('[DATA-003] the yearly purge job', () => {
  let fx: PurgeFixture;
  beforeAll(async () => {
    fx = await openPurgeFixture(2013);
  });
  afterAll(() => fx.close());

  /** A job on a lease that is always free, and the lines it logs. */
  const purgeJob = () => {
    const { logger, lines } = capturedLogger('info');
    // WHY: k = 6, not the default 5, so a job that ignored the configured k would write snapshots with the wrong one.
    const env = { MIN_GROUP_SIZE: 6, PSEUDONYM_SECRETS: SECRETS };
    const job = new RetentionPurgeJob({ db: fx.db, redis: { set: async () => 'OK' } as never, logger, env });
    const logged = () => lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    return { job, logged };
  };
  const statementsOf = (academicYear: number) => fx.db.xapiStatement.count({ where: { academicYear } });

  it('[DATA-003] purges nothing of 2013 on 31 July, 1 August or 30 August 2014, in Oslo time', async () => {
    // Arrange
    const { job, logged } = purgeJob();
    const moments = ['2014-07-31T21:59:59.999Z', '2014-07-31T22:00:00.000Z', '2014-08-30T21:59:59.999Z'];
    // Act
    for (const moment of moments) expect(await job.runOnce(new Date(moment))).toBe('ran');
    // Assert: on 31 July the ended year is 2012 (none of these rows); in August 2013's is not yet due.
    expect([await statementsOf(2013), await statementsOf(2014)]).toEqual([25, 2]);
    const checks = logged().filter((line) => line.msg === 'retention purge check done');
    expect(checks.map((line) => line.due)).toEqual([1, 0, 0]);
    expect(checks[0]).toMatchObject({ endedYear: 2012, xapiStatements: 0, snapshots: 0 });
    // PRIVACY: no secret of a purged year is configured (2012's purge took nothing), so nothing is named.
    expect(logged().filter((line) => line.level === 'warn')).toEqual([]);
  });

  it('[DATA-003] at midnight in Oslo on 31 August it logs the plan first, then purges 2013 once', async () => {
    // Arrange: the runbook's dry run before the day, and a run that failed; neither is the year's purge.
    const groupSize = minimumGroupSize(5);
    const dayBefore = new Date('2014-08-29T10:00:00.000Z');
    await runRetentionPurge({ db: fx.db, groupSize }, { now: dayBefore, dryRun: true, trigger: 'cli' });
    const nothing = { trigger: 'job', dryRun: false, outcome: 'failed', years: [2013], counts: {} } as const;
    await auditPurgeRun(fx.db, 2013, nothing);
    const { job, logged } = purgeJob();
    // Act
    await job.runOnce(fx.runsAt);
    const firstRun = logged();
    await job.runOnce(new Date(fx.runsAt.getTime() + HOUR_MS));
    const restarted = purgeJob();
    await restarted.job.runOnce(new Date(fx.runsAt.getTime() + 2 * HOUR_MS));
    // Assert
    expect(firstRun[0]).toMatchObject({
      msg: 'retention purge plan',
      job: 'retention-purge',
      dryRun: true,
      endedYear: 2013,
      ...EXPECTED_COUNTS,
    });
    expect(firstRun.at(-1)).toMatchObject({ msg: 'retention purge check done', due: 1, ...EXPECTED_COUNTS });
    // PRIVACY: right after the completed run it names 2013's secret, still configured, by year only (D-107).
    expect(firstRun.filter((line) => line.level === 'warn').map((line) => line.years)).toEqual([
      expect.arrayContaining([2013]),
    ]);
    expect([await statementsOf(2013), await statementsOf(2014)]).toEqual([0, 2]);
    expect(
      logged()
        .slice(firstRun.length)
        .map((line) => [line.msg, line.due]),
    ).toEqual([['retention purge check done', 0]]);
    expect(restarted.logged().map((line) => [line.msg, line.due])).toEqual([
      ['retention purge check done', 0],
    ]);
    const snapshots = await fx.db.insightSnapshot.findMany({ where: { contentId: fx.contentId } });
    expect(snapshots.map((snapshot) => snapshot.k)).toEqual([6, 6, 6]);
  });

  it('[DATA-002] names, by year only, the secrets still configured for purged years, also at start-up', async () => {
    // Arrange
    const { job, logged } = purgeJob();
    // Act
    const years = await job.warnAboutPurgedSecrets();
    job.start();
    await vi.waitFor(() => expect(logged().filter((line) => line.level === 'warn')).toHaveLength(2));
    job.stop();
    // Assert
    expect(years).toContain(2013);
    expect(years).not.toContain(2099);
    const warning = logged()[0];
    expect(warning).toMatchObject({ job: 'retention-purge', years });
    const text = JSON.stringify(logged());
    for (const secret of SECRETS.values()) expect(text).not.toContain(secret.toString('base64'));
  });
});
