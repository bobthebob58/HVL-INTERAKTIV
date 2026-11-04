/**
 * Tests for the semesters the pedagogisk mappe groups results by: they start where insight's `semester` period starts
 * (midnight Oslo time on 1 January or 1 August, D-106), and the windows over a span hold every moment exactly once.
 *
 * Spec: MAPPE-003, INS-006
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { insightPeriodRange } from '../../../src/insight/scope/insightPeriod.js';
import { semesterStartOf, semesterWindows } from '../../../src/learningDesign/mappe/resultSemesters.js';

// WHY: fast-check 4 also draws invalid dates unless told not to; a stored timestamp is always a valid date.
const moment = fc.date({
  min: new Date('2024-01-01T00:00:00Z'),
  max: new Date('2032-12-31T23:59:59Z'),
  noInvalidDate: true,
});

describe('[MAPPE-003] the semesters of the mappe’s groups', () => {
  it('[MAPPE-003] a semester starts where insight’s semester view starts, at midnight Oslo time', () => {
    // Act and assert
    expect(semesterStartOf(new Date('2026-07-31T21:59:59.999Z')).toISOString()).toBe(
      '2025-12-31T23:00:00.000Z',
    );
    expect(semesterStartOf(new Date('2026-07-31T22:00:00.000Z')).toISOString()).toBe(
      '2026-07-31T22:00:00.000Z',
    );
    expect(semesterStartOf(new Date('2026-12-31T22:59:59.999Z')).toISOString()).toBe(
      '2026-07-31T22:00:00.000Z',
    );
    expect(semesterStartOf(new Date('2026-12-31T23:00:00.000Z')).toISOString()).toBe(
      '2026-12-31T23:00:00.000Z',
    );
    fc.assert(
      fc.property(moment, (at) => {
        expect(semesterStartOf(at)).toEqual(insightPeriodRange('semester', at).start);
      }),
    );
  });

  it('[MAPPE-003] the windows over a span follow each other and hold every moment in it exactly once', () => {
    fc.assert(
      fc.property(moment, moment, moment, (a, b, probe) => {
        // Arrange
        const [first, last] = a <= b ? [a, b] : [b, a];
        // Act
        const windows = semesterWindows(first, last);
        // Assert
        expect(windows[0]?.start).toEqual(semesterStartOf(first));
        expect(windows.at(-1)?.start).toEqual(semesterStartOf(last));
        windows.slice(1).forEach((window, i) => expect(window.start).toEqual(windows[i]?.end));
        windows.forEach(({ start, end }) =>
          expect(semesterStartOf(new Date(end.getTime() - 1))).toEqual(start),
        );
        const from = windows[0]?.start ?? first;
        const to = windows.at(-1)?.end ?? last;
        const holding = windows.filter(({ start, end }) => start <= probe && probe < end);
        expect(holding).toHaveLength(from <= probe && probe < to ? 1 : 0);
      }),
    );
  });
});
