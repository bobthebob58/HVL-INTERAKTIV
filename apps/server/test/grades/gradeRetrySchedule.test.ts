/**
 * Unit tests for the grade worker's retry schedule (D-104): exponential backoff with jitter, `Retry-After` as the
 * least delay, at most 8 attempts, none later than 24 hours after the job was created, and the settlement for each
 * outcome.
 *
 * Spec: LTI-012
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_SEND_ATTEMPTS,
  RETRY_WINDOW_MS,
  nextRetryAt,
  retryDelayMs,
  settlementFor,
} from '../../src/grades/gradeRetrySchedule.js';

const MINUTE = 60_000;
const created = new Date('2026-10-30T10:00:00.000Z');
const later = (ms: number): Date => new Date(created.getTime() + ms);

describe('[LTI-012] grade retry schedule', () => {
  it.each([
    [1, 0.5, MINUTE],
    [2, 0.5, 3 * MINUTE],
    [7, 0.5, 729 * MINUTE],
    [1, 0, 0.8 * MINUTE],
    [1, 0.999999, 1.2 * MINUTE],
  ])('[LTI-012] waits after attempt %d (jitter %d) about %d ms', (attempts, random, expected) => {
    expect(retryDelayMs(attempts, random)).toBeCloseTo(expected, -1);
  });

  it('[LTI-012] fits the seven delays within 24 hours, even at the largest jitter', () => {
    // Act
    const total = [1, 2, 3, 4, 5, 6, 7].reduce((sum, n) => sum + retryDelayMs(n, 0.999999), 0);
    // Assert
    expect(total).toBeLessThan(22 * 60 * MINUTE);
    expect(total).toBeLessThan(RETRY_WINDOW_MS);
  });

  it('[LTI-012] makes no ninth attempt', () => {
    expect(
      nextRetryAt({ attempts: MAX_SEND_ATTEMPTS - 2, createdAt: created }, created, undefined, 0.5),
    ).toEqual(later(729 * MINUTE));
    expect(
      nextRetryAt({ attempts: MAX_SEND_ATTEMPTS - 1, createdAt: created }, created, undefined, 0.5),
    ).toBe(undefined);
  });

  it('[LTI-012] honours a Retry-After longer than the backoff, and ignores a shorter one', () => {
    const job = { attempts: 0, createdAt: created };
    expect(nextRetryAt(job, created, 10 * MINUTE, 0.5)).toEqual(later(10 * MINUTE));
    expect(nextRetryAt(job, created, 1000, 0.5)).toEqual(later(MINUTE));
  });

  it('[LTI-012] makes no attempt later than 24 hours after the job was created', () => {
    // Arrange: a send at 23 h 58 min; the next would fall at 23 h 59 min or at 24 h 01 min
    const job = { attempts: 0, createdAt: created };
    const now = later(RETRY_WINDOW_MS - 2 * MINUTE);
    // Act
    const inside = nextRetryAt(job, now, undefined, 0.5);
    const outside = nextRetryAt(job, now, 3 * MINUTE, 0.5);
    // Assert
    expect(inside).toEqual(later(RETRY_WINDOW_MS - MINUTE));
    expect(outside).toBe(undefined);
  });

  it('[LTI-012] settles each outcome as D-104 says', () => {
    // Arrange
    const job = { attempts: 2, createdAt: created };
    const now = later(10 * MINUTE);
    const settle = (outcome: Parameters<typeof settlementFor>[1]) => settlementFor(job, outcome, now, 0.5);
    // Act and assert
    expect(settle({ kind: 'sent' })).toEqual({ kind: 'succeeded' });
    expect(settle({ kind: 'orphaned' })).toEqual({ kind: 'orphaned' });
    expect(settle({ kind: 'failed', reason: 'http-422' })).toEqual({ kind: 'failed', reason: 'http-422' });
    expect(settle({ kind: 'retry', reason: 'http-503' })).toEqual({
      kind: 'retry',
      reason: 'http-503',
      nextAttemptAt: later(19 * MINUTE),
    });
    const exhausted = settlementFor(
      { attempts: 7, createdAt: created },
      { kind: 'retry', reason: 'network' },
      now,
      0.5,
    );
    expect(exhausted).toEqual({ kind: 'failed', reason: 'network' });
  });
});
