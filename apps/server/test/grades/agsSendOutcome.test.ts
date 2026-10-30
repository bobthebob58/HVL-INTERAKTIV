/**
 * Unit tests for how the AGS client reads an answer (D-104): 429 and 5xx are retried, any other status fails at once,
 * `Retry-After` is read as seconds or an HTTP date, and reasons are fixed codes.
 *
 * Spec: LTI-012
 */
import { describe, expect, it } from 'vitest';
import {
  isRetryableStatus,
  networkOutcome,
  outcomeOfStatus,
  retryAfterMs,
} from '../../src/grades/agsSendOutcome.js';

const now = new Date('2026-10-30T10:00:00.000Z');

describe('[LTI-012] AGS answer outcomes', () => {
  it.each([
    [429, true],
    [500, true],
    [503, true],
    [599, true],
    [400, false],
    [403, false],
    [415, false],
    [422, false],
    [302, false],
  ])('[LTI-012] treats status %d as retryable: %s', (status, retryable) => {
    expect(isRetryableStatus(status)).toBe(retryable);
  });

  it.each([
    ['120', 120_000],
    [' 5 ', 5_000],
    ['Fri, 30 Oct 2026 10:01:00 GMT', 60_000],
    ['Fri, 30 Oct 2026 09:00:00 GMT', 0],
    ['soon', undefined],
    ['-3', undefined],
    ['1.5', undefined],
  ])('[LTI-012] reads Retry-After %j as %s ms', (header, expected) => {
    expect(retryAfterMs(header, now)).toBe(expected);
  });

  it('[LTI-012] gives fixed reason codes and carries the Retry-After delay into a retry', () => {
    expect(outcomeOfStatus(429, '30', now)).toEqual({
      kind: 'retry',
      reason: 'http-429',
      retryAfterMs: 30_000,
    });
    expect(outcomeOfStatus(503, null, now)).toEqual({ kind: 'retry', reason: 'http-503' });
    expect(outcomeOfStatus(400, '30', now, 'token-')).toEqual({ kind: 'failed', reason: 'token-http-400' });
    expect(networkOutcome('token-')).toEqual({ kind: 'retry', reason: 'token-network' });
    expect(retryAfterMs(null, now)).toBe(undefined);
  });
});
