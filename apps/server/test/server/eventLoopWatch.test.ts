/**
 * Tests of the standstill watch (D-144): a standstill of the event loop that reaches the limit is written as one
 * warning line with numbers only, normal work writes none, the timer finds a standstill by itself, the first check
 * after a standstill finds it even before anything else has run (D-153), and a stopped watch writes nothing.
 *
 * Spec: NFR-002
 */
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { EventLoopWatch, STANDSTILL_CHECK_MS, STANDSTILL_WARN_MS } from '../../src/server/eventLoopWatch.js';
import { capturedLogger } from '../support/capturedLogger.js';

/** Holds the thread for `ms` milliseconds, as one long synchronous piece of work does. */
const standStill = (ms: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

const parsed = (lines: string[]): Record<string, unknown>[] =>
  lines.map((line) => JSON.parse(line) as Record<string, unknown>);

describe('[NFR-002] the server says when it stood still', () => {
  let watch: EventLoopWatch | undefined;
  afterEach(() => watch?.stop());

  it('[NFR-002] a standstill of a second or more is one warning line with its length, and numbers only', async () => {
    // Arrange
    const { logger, lines } = capturedLogger('info');
    watch = new EventLoopWatch(logger);
    watch.start();
    await delay(50);
    // Act: hold the thread, let the loop run once more, then check twice
    standStill(STANDSTILL_WARN_MS + 300);
    await delay(50);
    const longest = watch.check();
    const next = watch.check();
    // Assert
    const [line, ...others] = parsed(lines);
    expect(longest).toBeGreaterThanOrEqual(STANDSTILL_WARN_MS);
    expect(next).toBeLessThan(STANDSTILL_WARN_MS);
    expect(others).toEqual([]);
    expect(line).toMatchObject({
      level: 'warn',
      msg: 'the server stood still: its event loop did not run',
      standstillMs: longest,
      withinMs: STANDSTILL_CHECK_MS,
    });
    // PRIVACY: beside the logger's own fields the line holds the two numbers and nothing else (DATA-009).
    expect(Object.keys(line ?? {}).sort()).toEqual([
      'level',
      'msg',
      'service',
      'standstillMs',
      'time',
      'withinMs',
    ]);
  });

  it('[NFR-002] normal work, and a pause below the limit, write no line', async () => {
    // Arrange
    const { logger, lines } = capturedLogger('info');
    watch = new EventLoopWatch(logger);
    watch.start();
    await delay(50);
    // Act
    standStill(150);
    await delay(100);
    const longest = watch.check();
    // Assert
    expect(longest).toBeGreaterThanOrEqual(100);
    expect(lines).toEqual([]);
  });

  it('[NFR-002] the first check after a standstill finds it, before any other timer has run, and only once', async () => {
    // Arrange
    const { logger, lines } = capturedLogger('info');
    watch = new EventLoopWatch(logger);
    watch.start();
    await delay(50);
    watch.check();
    // Act: hold the thread and check at once, as when the check's timer is the first to run afterwards
    standStill(STANDSTILL_WARN_MS + 200);
    const atOnce = watch.check();
    await delay(50);
    const later = watch.check();
    // Assert
    expect(atOnce).toBeGreaterThanOrEqual(STANDSTILL_WARN_MS);
    expect(later).toBeLessThan(STANDSTILL_WARN_MS);
    expect(parsed(lines)).toEqual([expect.objectContaining({ level: 'warn', standstillMs: atOnce })]);
  });

  it('[NFR-002] the timer finds a standstill by itself; a stopped watch writes nothing more', async () => {
    // Arrange: a low limit and a short time between checks, so the test stays short
    const { logger, lines } = capturedLogger('info');
    watch = new EventLoopWatch(logger, { warnMs: 200, checkMs: 100 });
    watch.start();
    watch.start();
    await delay(50);
    // Act
    standStill(400);
    await delay(300);
    const whileRunning = parsed(lines).length;
    watch.stop();
    standStill(400);
    await delay(300);
    // Assert
    expect(whileRunning).toBe(1);
    expect(parsed(lines)).toHaveLength(1);
    expect(parsed(lines)[0]).toMatchObject({ withinMs: 100 });
    expect(watch.check()).toBe(0);
  });
});
