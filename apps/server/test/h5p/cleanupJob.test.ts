/**
 * Unit tests for the cleanup job's failure handling: Redis errors and cleanup errors never escape.
 *
 * Spec: H5P-004
 */
import { describe, it, expect, vi } from 'vitest';
import { TemporaryFileCleanupJob } from '../../src/h5p/jobs/TemporaryFileCleanupJob.js';
import { capturedLogger } from '../support/capturedLogger.js';

describe('[H5P-004] temporary file cleanup job', () => {
  it('[H5P-004] skips and logs when the Redis lease cannot be taken, instead of rejecting', async () => {
    const { lines, logger } = capturedLogger();
    const cleanUp = vi.fn(async () => {});
    const redis = { set: vi.fn(async () => Promise.reject(new Error('socket closed'))) };
    const job = new TemporaryFileCleanupJob({ redis: redis as never, cleanUp, logger });
    await expect(job.runOnce()).resolves.toBe('skipped');
    expect(cleanUp).not.toHaveBeenCalled();
    expect(lines.join('')).toContain('cleanup lease failed');
  });

  it('[H5P-004] logs a failing cleanup and still reports that this node ran it', async () => {
    const { lines, logger } = capturedLogger();
    const redis = { set: vi.fn(async () => 'OK') };
    const cleanUp = async () => Promise.reject(new Error('S3 unavailable'));
    const job = new TemporaryFileCleanupJob({ redis: redis as never, cleanUp, logger });
    await expect(job.runOnce()).resolves.toBe('ran');
    expect(lines.join('')).toContain('temporary file cleanup failed');
  });

  it('[H5P-004] the timer keeps running after a failed tick and can be stopped', async () => {
    // Arrange: fake timers and a job whose Redis lease always fails
    vi.useFakeTimers();
    try {
      const { logger } = capturedLogger();
      const set = vi.fn(async () => Promise.reject(new Error('down')));
      const job = new TemporaryFileCleanupJob({
        redis: { set } as never,
        cleanUp: async () => {},
        logger,
        intervalMs: 1000,
      });
      // Act and assert: every tick runs, although each one fails
      job.start();
      await vi.advanceTimersByTimeAsync(3000);
      expect(set).toHaveBeenCalledTimes(3);
      // Act and assert: no tick runs after stop()
      job.stop();
      await vi.advanceTimersByTimeAsync(3000);
      expect(set).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
