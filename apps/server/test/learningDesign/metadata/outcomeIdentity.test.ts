/**
 * Unit tests for learning-outcome identity and order: the same outcome typed again with other spacing or capitals is
 * recognised, and outcomes are shown by NKR category, then text.
 *
 * Spec: PED-030, PED-031
 */
import type { LearningOutcome } from '@hvl-interaktiv/api-contract';
import { describe, expect, it } from 'vitest';
import {
  compareNorwegian,
  distinctOutcomes,
  outcomeKey,
} from '../../../src/learningDesign/metadata/outcomeIdentity.js';

const kunnskap = (text: string): LearningOutcome => ({ text, category: 'kunnskap' });

describe('[PED-030] outcome identity', () => {
  it('[PED-030] the same category and the same text after NFC, trimming, collapsed spaces and case are one outcome', () => {
    // Arrange: «å» written as «a» plus a combining ring is the same letter after NFC
    const typed = kunnskap('Forklare  blodtrykk og å måle');
    const again = kunnskap('  forklare blodtrykk og å måle ');
    // Act and assert
    expect(outcomeKey(typed)).toBe(outcomeKey(again));
    expect(outcomeKey(typed)).not.toBe(outcomeKey({ ...typed, category: 'ferdigheiter' }));
    expect(outcomeKey(typed)).not.toBe(outcomeKey(kunnskap('Forklare blodtrykket og å måle')));
  });

  it('[PED-031] distinct outcomes are ordered kunnskap, ferdigheiter, generell kompetanse, then by text', () => {
    // Arrange
    const outcomes: LearningOutcome[] = [
      { text: 'Reflektere over eiga rolle', category: 'generell-kompetanse' },
      { text: 'Måle puls', category: 'ferdigheiter' },
      kunnskap('Øve'),
      kunnskap('Beskrive'),
      kunnskap('beskrive'),
      kunnskap('Åtvare'),
      { text: 'Gjere ei vurdering', category: 'ferdigheiter' },
    ];
    // Act
    const distinct = distinctOutcomes(outcomes);
    // Assert: Norwegian order puts Ø before Å, both after the other letters
    expect(distinct.map(({ category, text }) => [category, text.toLowerCase()])).toEqual([
      ['kunnskap', 'beskrive'],
      ['kunnskap', 'øve'],
      ['kunnskap', 'åtvare'],
      ['ferdigheiter', 'gjere ei vurdering'],
      ['ferdigheiter', 'måle puls'],
      ['generell-kompetanse', 'reflektere over eiga rolle'],
    ]);
  });

  it('[PED-031] keeps the text of the first outcome of each identity, whatever order the list came in', () => {
    // Act
    const one = distinctOutcomes([kunnskap('beskrive'), kunnskap('Beskrive')]);
    const other = distinctOutcomes([kunnskap('Beskrive'), kunnskap('beskrive')]);
    // Assert
    expect(one).toEqual(other);
    expect(one).toHaveLength(1);
  });

  it('[PED-030] course codes sort in Norwegian order with numbers by value', () => {
    expect(['SYK1100', 'ÅRS100', 'SYK110', 'ØKO100', 'ABC100'].sort(compareNorwegian)).toEqual([
      'ABC100',
      'SYK110',
      'SYK1100',
      'ØKO100',
      'ÅRS100',
    ]);
  });
});
