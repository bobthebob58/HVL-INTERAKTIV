/**
 * Tests for the mock Canvas's fault queues: which faults are valid, and that each one answers exactly its number
 * of requests, oldest first.
 *
 * Spec: LTI-012, LTI-008
 */
import { describe, expect, it } from 'vitest';
import { FAULT_TARGETS, createFaultQueues, normaliseFault } from '../canvasFaults.mjs';

describe('[LTI-012] mock Canvas fault queues', () => {
  it.each([
    ['no status and no delay', {}],
    ['a 302', { status: 302 }],
    ['count 0', { status: 503, count: 0 }],
    ['a fractional count', { status: 503, count: 1.5 }],
    ['a negative Retry-After', { status: 429, retryAfter: -1 }],
    ['a delay over two minutes', { delayMs: 120_001 }],
    ['an error code with spaces', { status: 400, error: 'invalid grant' }],
  ])('[LTI-012] refuses %s', (_name, spec) => {
    expect(() => normaliseFault(spec)).toThrow(RangeError);
  });

  it('[LTI-012] completes a fault with count 1 and no delay', () => {
    expect(normaliseFault({ status: 503 })).toEqual({
      count: 1,
      status: 503,
      retryAfter: undefined,
      delayMs: 0,
      error: undefined,
    });
  });

  it('[LTI-012] answers exactly count requests per fault, oldest fault first, per target', () => {
    // Arrange
    const queues = createFaultQueues();
    queues.add('scores', { status: 503, count: 2 });
    queues.add('scores', { status: 429, retryAfter: 1 });
    queues.add('token', { status: 500 });
    // Act
    const pendingBefore = queues.pending('scores');
    const taken = Array.from({ length: 4 }, () => queues.take('scores')?.status);
    // Assert
    expect(pendingBefore).toBe(3);
    expect(taken).toEqual([503, 503, 429, undefined]);
    expect(queues.pending('token')).toBe(1);
  });

  it('[LTI-008] clears every queue, and refuses an unknown target', () => {
    const queues = createFaultQueues();
    for (const target of FAULT_TARGETS) queues.add(target, { delayMs: 10 });
    queues.clear();
    expect(FAULT_TARGETS.map((target) => queues.pending(target))).toEqual([0, 0, 0, 0]);
    expect(() => queues.add('grades', { status: 503 })).toThrow(RangeError);
  });
});
