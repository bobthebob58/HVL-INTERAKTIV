/**
 * Integration test for the leased yearly purge job after a failed run (DATA-003 as amended by D-107, DATA-007), in the
 * academic years 2004 (ended) and 2005: a check whose run fails is logged and audited as failed, and the same job's
 * next check plans and runs the purge again, without the snapshots the failed run wrote, and finishes it; only then
 * does it count the year as purged.
 *
 * Spec: DATA-003, DATA-007
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PURGE_RUN_ACTION } from '../../../src/privacy/purge/purgeAudit.js';
import { RetentionPurgeJob } from '../../../src/privacy/purge/RetentionPurgeJob.js';
import { capturedLogger } from '../../support/capturedLogger.js';
import { describeWithServices } from '../../support/services.js';
import { openPurgeFixture, type PurgeFixture } from './support/purgeFixture.js';
import { withStatementDeletes } from './support/statementDeletes.js';

const HOUR_MS = 60 * 60 * 1000;

describeWithServices('[DATA-003] the yearly purge job after a failed run', () => {
  let fx: PurgeFixture;
  beforeAll(async () => {
    fx = await openPurgeFixture(2004);
  });
  afterAll(() => fx.close());

  it('[DATA-003] retries at its next check a run that failed, and only then counts the year as purged', async () => {
    // Arrange: the first statement delete fails, as a lost connection would; later ones work.
    let failures = 0;
    const db = withStatementDeletes(fx.db, (args, real) =>
      failures++ === 0 ? Promise.reject(new Error('connection lost')) : real(args),
    );
    const { logger, lines } = capturedLogger('info');
    const env = { MIN_GROUP_SIZE: 5, PSEUDONYM_SECRETS: new Map([[2005, Buffer.alloc(32, 5)]]) };
    const job = new RetentionPurgeJob({ db, redis: { set: async () => 'OK' } as never, logger, env });
    const checks = () =>
      lines
        .map((line) => JSON.parse(line) as Record<string, unknown>)
        .filter((line) => String(line.msg).startsWith('retention purge check'))
        .map((line) => [line.msg, line.due]);
    // Act
    await job.runOnce(fx.runsAt);
    await job.runOnce(new Date(fx.runsAt.getTime() + HOUR_MS));
    await job.runOnce(new Date(fx.runsAt.getTime() + 2 * HOUR_MS));
    // Assert
    expect(checks()).toEqual([
      ['retention purge check failed', undefined],
      ['retention purge check done', 1],
      ['retention purge check done', 0],
    ]);
    // WHY: the failed run wrote the snapshots, so the second plan, like the run it announces, writes none (D-107).
    const plans = lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .filter((line) => line.msg === 'retention purge plan');
    expect(plans.map((plan) => plan.snapshots)).toEqual([3, 0]);
    expect(await fx.db.xapiStatement.count({ where: { academicYear: 2004 } })).toBe(0);
    const events = await fx.db.auditEvent.findMany({
      where: { action: PURGE_RUN_ACTION, targetId: '2004' },
      orderBy: [{ at: 'asc' }, { id: 'asc' }],
    });
    expect(events.map((event) => event.details)).toMatchObject([
      { trigger: 'job', dryRun: false, outcome: 'failed' },
      { trigger: 'job', dryRun: false, outcome: 'completed' },
    ]);
  });
});
