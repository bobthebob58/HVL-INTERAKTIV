/**
 * Unit tests for the cleanup of expired ltijs records: what it deletes, its 10-minute timer on a fake clock, and
 * that it logs only counts.
 *
 * Spec: LTI-002, DATA-002
 */
import { Writable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../../../src/logging/logger.js';
import {
  LTI_CLEANUP_INTERVAL_MS,
  LTI_CLEANUP_LEASE_KEY,
  LtiRecordCleanupJob,
  deleteExpiredLtiRecords,
} from '../../../src/lti/storage/LtiRecordCleanupJob.js';

const NOW = new Date('2026-10-23T10:00:00.000Z');
const TEN_MINUTES_AGO = new Date('2026-10-23T09:50:00.000Z');

/** Tables whose deleteMany records its filter and reports a fixed count. */
const fakeTables = () => {
  const table = (count: number) => ({ deleteMany: vi.fn(async (_args: unknown) => ({ count })) });
  return { ltiIdToken: table(3), ltiNonce: table(5), ltiAccessToken: table(1) };
};

describe('[LTI-002] cleanup of expired ltijs records', () => {
  afterEach(() => vi.useRealTimers());

  it('[LTI-002] deletes expired ID tokens and access tokens, and nonces older than 10 minutes', async () => {
    // Arrange
    const db = fakeTables();
    // Act
    const counts = await deleteExpiredLtiRecords(db as never, NOW);
    // Assert
    expect(counts).toEqual({ idTokens: 3, nonces: 5, accessTokens: 1 });
    expect(db.ltiIdToken.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lte: NOW } } });
    expect(db.ltiNonce.deleteMany).toHaveBeenCalledWith({ where: { createdAt: { lte: TEN_MINUTES_AGO } } });
    expect(db.ltiAccessToken.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lte: NOW } } });
  });

  it('[DATA-002] runs every 10 minutes on the injected clock and logs only the counts', async () => {
    // Arrange
    vi.useFakeTimers();
    const lines: Record<string, unknown>[] = [];
    const destination = new Writable({ write: (c, _e, done) => (lines.push(JSON.parse(String(c))), done()) });
    const db = fakeTables();
    const set = vi.fn(async (..._args: unknown[]) => 'OK');
    const job = new LtiRecordCleanupJob({
      db: db as never,
      redis: { set } as never,
      logger: createLogger({ level: 'info', destination }),
      now: () => NOW,
    });
    // Act
    job.start();
    await vi.advanceTimersByTimeAsync(LTI_CLEANUP_INTERVAL_MS - 1);
    const beforeFirstTick = db.ltiNonce.deleteMany.mock.calls.length;
    await vi.advanceTimersByTimeAsync(1);
    job.stop();
    // Assert
    expect(LTI_CLEANUP_INTERVAL_MS).toBe(10 * 60 * 1000);
    expect(beforeFirstTick).toBe(0);
    expect(db.ltiNonce.deleteMany).toHaveBeenCalledWith({ where: { createdAt: { lte: TEN_MINUTES_AGO } } });
    expect(set).toHaveBeenCalledWith(LTI_CLEANUP_LEASE_KEY, expect.any(String), { NX: true, PX: 594_000 });
    const { time: _time, ...logged } = lines[0]!;
    expect(logged).toEqual({
      level: 'info',
      service: 'hvl-interaktiv-server',
      job: 'lti-record-cleanup',
      idTokens: 3,
      nonces: 5,
      accessTokens: 1,
      msg: 'LTI record cleanup done',
    });
  });
});
