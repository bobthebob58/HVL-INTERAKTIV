/**
 * Tests for the grade-sync panel's words: a placement's heading (numbered only when two share a course and Canvas,
 * with a fallback for a course without a code), the score rule of each policy, and what a retry did.
 *
 * Spec: LTI-012, UD-006
 */
import type { GradeSyncPlacement } from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import { placementHeading, policyText, retryMessage } from '../../../src/features/gradeSync/gradeSyncTexts';

const placement = (id: string, overrides: Partial<GradeSyncPlacement> = {}): GradeSyncPlacement => ({
  placementId: id,
  platformName: 'HVL Canvas',
  contextLabel: 'SYK110',
  graded: true,
  attemptPolicy: 'best',
  masteryThreshold: null,
  counts: { sent: 0, pending: 0, failed: 0, orphaned: 0 },
  ...overrides,
});

describe('[LTI-012] the grade-sync panel’s words', () => {
  it('[UD-006] names a placement by its course and Canvas, and numbers two links in the same course', () => {
    // Arrange
    const a = placement('a');
    const b = placement('b', { platformName: 'HVL Canvas test' });
    const c = placement('c');
    const noCode = placement('d', { contextLabel: null });
    // Act and assert
    expect(placementHeading(b, [a, b], 'nn')).toBe('SYK110 i HVL Canvas test');
    expect(placementHeading(a, [a, b, c], 'nn')).toBe('SYK110 i HVL Canvas (lenkje 1)');
    expect(placementHeading(c, [a, b, c], 'nn')).toBe('SYK110 i HVL Canvas (lenkje 2)');
    expect(placementHeading(noCode, [noCode], 'en')).toBe('Course without a course code in HVL Canvas');
  });

  it('[LTI-012] says which attempt each policy sends, with the mastery threshold in per cent', () => {
    expect(policyText(placement('a'), 'nn')).toBe('Det beste forsøket blir sendt.');
    expect(policyText(placement('a', { attemptPolicy: 'latest' }), 'nb')).toBe(
      'Det siste forsøket blir sendt.',
    );
    expect(policyText(placement('a', { attemptPolicy: 'mastery', masteryThreshold: 0.8 }), 'nn')).toBe(
      '100 blir sendt når eit forsøk når 80 %, elles det siste forsøket.',
    );
  });

  it.each([
    [{ requeued: 1, stillFailed: 0 }, '1 poeng ventar no på å bli sendt på nytt.'],
    [{ requeued: 3, stillFailed: 0 }, '3 poeng ventar no på å bli sende på nytt.'],
    [{ requeued: 0, stillFailed: 0 }, 'Det var ingen feila poeng å sende på nytt.'],
  ])('[LTI-012] reports a retry of %o in words', (result, expected) => {
    expect(retryMessage(result, 'nn')).toBe(expected);
  });

  it('[LTI-012] says why scores whose Canvas ID is gone cannot be sent again, in English with plurals', () => {
    // Act
    const both = retryMessage({ requeued: 2, stillFailed: 1 }, 'en');
    const onlyGone = retryMessage({ requeued: 0, stillFailed: 3 }, 'en');
    // Assert
    expect(both).toBe(
      '2 scores are now waiting to be sent again. 1 score cannot be sent again: the student’s Canvas ID is ' +
        'deleted 30 days after sending stopped. The student’s next score in the activity is sent as usual.',
    );
    expect(onlyGone.startsWith('3 scores cannot be sent again')).toBe(true);
  });
});
