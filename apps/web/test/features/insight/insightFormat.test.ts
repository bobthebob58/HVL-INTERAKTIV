/**
 * Tests for how the Innsikt tab writes values: «< k» for a suppressed cell and nothing derived from a value, «Ikkje
 * tilgjengeleg» for one the type cannot send (never 0), percentages, medians and minutes in each locale, video times
 * and a gap's accepted answers.
 *
 * Spec: INS-006, INS-001, INS-008, PROD-012
 */
import { describe, expect, it } from 'vitest';
import {
  acceptedAnswerParts,
  cellText,
  formatValue,
  shownValue,
  suppressedText,
  videoTime,
} from '../../../src/features/insight/insightFormat';
import { HIDDEN, plain, shown } from './insightAnswers';

describe('[INS-006] insight values as text', () => {
  it('[INS-006] writes a suppressed cell as «< k» with the view’s k, and gives it no value', () => {
    expect(cellText(HIDDEN, 'percent', 5, 'nn')).toBe('< 5');
    expect(cellText(HIDDEN, 'count', 7, 'en')).toBe('< 7');
    expect(suppressedText(3)).toBe('< 3');
    expect(shownValue(HIDDEN)).toBeUndefined();
  });

  it('[INS-001] writes a value the type cannot send as not available, never as 0', () => {
    expect(cellText(null, 'count', 5, 'nn')).toBe('Ikkje tilgjengeleg');
    expect(cellText(null, 'count', 5, 'nb')).toBe('Ikke tilgjengelig');
    expect(cellText(null, 'count', 5, 'en')).toBe('Not available');
    expect(shownValue(null)).toBeUndefined();
    expect(cellText(shown(0), 'count', 5, 'nn')).toBe('0');
  });

  it('[PROD-012] writes shares, medians and minutes in the reader’s locale', () => {
    expect(plain(formatValue(0.375, 'percent', 'nn'))).toBe('38 %');
    expect(formatValue(0.375, 'percent', 'en')).toBe('38%');
    expect(formatValue(1.25, 'median', 'nb')).toBe('1,3');
    expect(formatValue(4.5, 'minutes', 'nn')).toBe('4,5 min');
    expect(formatValue(4.5, 'minutes', 'en')).toBe('4.5 min');
    expect(formatValue(1, 'percent', 'en')).toBe('100%');
  });

  it('[INS-008] writes video times as minutes and seconds, and the summary task as the end', () => {
    expect(videoTime(45, 'nn')).toBe('0:45');
    expect(videoTime(310.4, 'nn')).toBe('5:10');
    expect(videoTime(3605, 'nn')).toBe('60:05');
    expect(videoTime(null, 'nb')).toBe('Slutten');
    expect(videoTime(null, 'en')).toBe('The end');
  });

  it('[INS-008] joins a gap’s accepted answers with the locale’s «or», marking which parts are answers', () => {
    // Arrange
    const joined = (answers: string[], locale: 'nn' | 'nb' | 'en') =>
      acceptedAnswerParts(answers, locale)
        .map((part) => part.text)
        .join('');
    // Act
    const parts = acceptedAnswerParts(['a', 'b'], 'en');
    // Assert
    expect(joined(['mitokondrie', 'mitokondria'], 'nn')).toBe('«mitokondrie» eller «mitokondria»');
    expect(joined(['a', 'b'], 'en')).toBe('«a» or «b»');
    expect(joined(['celle'], 'nb')).toBe('«celle»');
    expect(parts).toEqual([
      { text: '«a»', answer: true },
      { text: ' or ', answer: false },
      { text: '«b»', answer: true },
    ]);
  });
});
