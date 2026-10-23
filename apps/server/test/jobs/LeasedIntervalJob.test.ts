/**
 * Unit tests for the leased interval job: the Redis lease per interval, what is logged, and the timer.
 *
 * Spec: H5P-004, LTI-002
 */
import { Writable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LeasedIntervalJob, type LeasedIntervalJobOptions } from '../../src/jobs/LeasedIntervalJob.js';
import { createLogger } from '../../src/logging/logger.js';

const capture = () => {
  const lines: Record<string, unknown>[] = [];
  const logger = createLogger({
    level: 'info',
    destination: new Writable({
      write: (chunk, _e, done) => (lines.push(JSON.parse(String(chunk))), done()),
    }),
  });
  return { lines, logger };
};

const testJob = (overrides: Partial<LeasedIntervalJobOptions> = {}) => {
  const { lines, logger } = capture();
  const set = vi.fn(async (..._args: unknown[]) => 'OK' as string | null);
  const run = vi.fn(async () => ({ deleted: 2 }));
  const options = { name: 'test-job', label: 'test job', leaseKey: 'hvli:test:lease', intervalMs: 1000 };
  const job = new LeasedIntervalJob({ ...options, redis: { set } as never, run, logger, ...overrides });
  return { job, set, run, lines };
};

describe('[LTI-002] leased interval job', () => {
  afterEach(() => vi.useRealTimers());

  it('[LTI-002] takes the lease with SET NX PX for 99 % of the interval, with one node ID per instance', async () => {
    // Arrange
    const first = testJob();
    const second = testJob({ redis: { set: first.set } as never });
    // Act
    await first.job.runOnce();
    await first.job.runOnce();
    await second.job.runOnce();
    // Assert
    const calls = first.set.mock.calls;
    expect(calls.map(([key, , options]) => [key, options])).toEqual(
      Array(3).fill(['hvli:test:lease', { NX: true, PX: 990 }]),
    );
    expect(calls[0]![1]).toBe(calls[1]![1]);
    expect(calls[2]![1]).not.toBe(calls[0]![1]);
  });

  it('[LTI-002] skips the work when another node already holds the lease for this interval', async () => {
    // Arrange
    const { job, set, run, lines } = testJob();
    set.mockResolvedValue(null);
    // Act
    const outcome = await job.runOnce();
    // Assert
    expect(outcome).toBe('skipped');
    expect(run).not.toHaveBeenCalled();
    expect(lines).toEqual([]);
  });

  it('[LTI-002] logs the counts the work reports under the job name, and nothing from the work itself', async () => {
    // Arrange: a run that also returns data by mistake, and a count named like the job field
    const leaky = { deleted: 2, job: 9, learner: 'Kari Nordmann', rows: [{ sub: 'canvas-user-1' }] };
    const { job, lines } = testJob({ run: async () => leaky as never });
    // Act
    const outcome = await job.runOnce();
    // Assert
    expect(outcome).toBe('ran');
    expect(lines).toHaveLength(1);
    const { time, ...fields } = lines[0]!;
    expect(typeof time).toBe('string');
    expect(fields).toEqual({
      level: 'info',
      service: 'hvl-interaktiv-server',
      job: 'test-job',
      deleted: 2,
      msg: 'test job done',
    });
  });

  it('[H5P-004] a failed run still counts as this node’s run; a failed lease skips; neither rejects', async () => {
    // Arrange
    const failingRun = testJob({ run: async () => Promise.reject(new Error('database down')) });
    const failingLease = testJob();
    failingLease.set.mockRejectedValue(new Error('socket closed'));
    // Act
    const outcomes = [await failingRun.job.runOnce(), await failingLease.job.runOnce()];
    // Assert
    expect(outcomes).toEqual(['ran', 'skipped']);
    expect(failingRun.lines.map((line) => [line.level, line.msg])).toEqual([['error', 'test job failed']]);
    expect(failingLease.lines.map((line) => [line.level, line.msg])).toEqual([
      ['error', 'test job lease failed'],
    ]);
    expect(failingLease.run).not.toHaveBeenCalled();
  });

  it('[H5P-004] ticks once per interval, starting twice adds no second timer, and stop ends it', async () => {
    // Arrange
    vi.useFakeTimers();
    const { job, set } = testJob();
    // Act and assert: one tick per interval, even after two starts
    job.start();
    job.start();
    await vi.advanceTimersByTimeAsync(999);
    expect(set).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(2001);
    expect(set).toHaveBeenCalledTimes(3);
    // Act and assert: nothing after stop
    job.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(set).toHaveBeenCalledTimes(3);
  });

  it('[H5P-004] a very short interval still gets a lease of at least one millisecond', async () => {
    // Arrange
    const { job, set } = testJob({ intervalMs: 1 });
    // Act
    await job.runOnce();
    // Assert
    expect(set.mock.calls[0]![2]).toEqual({ NX: true, PX: 1 });
  });
});
