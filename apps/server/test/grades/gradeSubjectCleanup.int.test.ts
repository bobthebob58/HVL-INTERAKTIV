/**
 * Integration tests for the 30-day cleanup of the encrypted LTI `sub` on grade jobs (DATA-002 as amended by D-104):
 * cleared 30 days after `terminalAt` whether the job succeeded, failed or was orphaned; kept on a pending job and on
 * a job that stopped less than 30 days ago; and the leased job runs it.
 *
 * Spec: DATA-002, LTI-012
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  clearExpiredGradeSubjects,
  GRADE_SUBJECT_CLEANUP_LEASE_KEY,
  GradeSubjectCleanupJob,
} from '../../src/grades/GradeSubjectCleanupJob.js';
import { connectRedis, type Redis } from '../../src/infra/redisClient.js';
import { capturedLogger } from '../support/capturedLogger.js';
import { describeWithServices, serviceEnv } from '../support/services.js';
import { openGradeDbFixture, type FixturePlacement, type GradeDbFixture } from './support/gradeDbFixture.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describeWithServices('[DATA-002] grade subject cleanup', () => {
  let fx: GradeDbFixture;
  let redis: Redis;
  beforeAll(async () => {
    fx = await openGradeDbFixture();
    redis = await connectRedis(serviceEnv().REDIS_URL);
  });
  afterAll(async () => {
    await redis.quit();
    await fx.close();
  });

  /** A job of the placement in the given state, stopped `daysAgo` days before `now` (none for a pending job). */
  async function job(
    placement: FixturePlacement,
    status: 'pending' | 'succeeded' | 'failed' | 'orphaned',
    now: Date,
    daysAgo: number,
  ): Promise<string> {
    const stopped = new Date(now.getTime() - daysAgo * DAY_MS);
    const row = await fx.db.gradeSyncJob.create({
      data: {
        placementId: placement.id,
        learnerKey: randomUUID(),
        ltiSubEncrypted: new Uint8Array([1, 2, 3]),
        attemptId: `${randomUUID()}:1`,
        scoreGiven: 50,
        resultAt: stopped,
        status,
        idempotencyKey: randomUUID(),
        createdAt: stopped,
        terminalAt: status === 'pending' ? null : stopped,
        nextAttemptAt: status === 'pending' ? stopped : null,
      },
    });
    return row.id;
  }

  it('[DATA-002] clears the sub 30 days after a job stopped, whatever its outcome, and keeps the rest', async () => {
    // Arrange
    const now = new Date();
    const placement = await fx.placement();
    const cleared = [
      await job(placement, 'succeeded', now, 31),
      await job(placement, 'failed', now, 30),
      await job(placement, 'orphaned', now, 45),
    ];
    const kept = [await job(placement, 'succeeded', now, 29), await job(placement, 'pending', now, 60)];
    // Act
    const count = await clearExpiredGradeSubjects(fx.db, now);
    // Assert
    expect(count).toBeGreaterThanOrEqual(3);
    const rows = await fx.db.gradeSyncJob.findMany({ where: { placementId: placement.id } });
    const subOf = (id: string) => rows.find((row) => row.id === id)?.ltiSubEncrypted ?? null;
    expect(cleared.map(subOf)).toEqual([null, null, null]);
    expect(kept.map((id) => subOf(id) !== null)).toEqual([true, true]);
    expect(rows.every((row) => row.status !== 'pending' || row.terminalAt === null)).toBe(true);
  });

  it('[DATA-002] runs on its lease and logs only the count', async () => {
    // Arrange
    const now = new Date();
    const placement = await fx.placement();
    const id = await job(placement, 'orphaned', now, 31);
    const { logger, lines } = capturedLogger('debug');
    const cleanup = new GradeSubjectCleanupJob({ db: fx.db, redis, logger, clock: () => now });
    await redis.del(GRADE_SUBJECT_CLEANUP_LEASE_KEY);
    // Act
    const outcome = await cleanup.runOnce();
    // Assert
    expect(outcome).toBe('ran');
    expect((await fx.db.gradeSyncJob.findUniqueOrThrow({ where: { id } })).ltiSubEncrypted).toBe(null);
    const done = lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((l) => l.job === 'grade-subject-cleanup');
    const base = ['level', 'time', 'pid', 'hostname', 'service', 'msg', 'job'];
    expect(Object.keys(done ?? {}).filter((key) => !base.includes(key))).toEqual(['cleared']);
  });
});
