/**
 * Unit tests for the skeleton tokens: how `{{token}}`s are found and filled, and how a pattern text is written into
 * the parameters as H5P stores text (D-084 amendment).
 *
 * Spec: PED-010, PROD-001
 */
import { describe, expect, it } from 'vitest';
import {
  escapeTokenValue,
  hasStrayBraces,
  resolveSkeletonParams,
  resolveTokens,
  skeletonStrings,
  tokensIn,
} from '../../../src/learningDesign/patterns/skeletonTokens.js';

const texts: Record<string, string> = { question: '⟦Skriv: «Q&A» <b>⟧', title: 'Tittel & tekst' };
const values = (name: string) => texts[name];

describe('[PROD-001] skeleton tokens', () => {
  it('[PROD-001] finds every token in order and tells a valid name from one that is not', () => {
    // Act
    const tokens = tokensIn('{{a}} og {{b-2}} og {{ c }} og {{a}}');
    const stray = ['{{a}} }}', '{{{a}}', '{{a}}{{b}}'].map(hasStrayBraces);
    // Assert
    expect(tokens).toEqual([
      { name: 'a', valid: true },
      { name: 'b-2', valid: true },
      { name: ' c ', valid: false },
      { name: 'a', valid: true },
    ]);
    expect(stray).toEqual([true, true, false]);
  });

  it('[PROD-001] escapes & < > as Lumi stores text, and leaves quotes and the guidance marks raw', () => {
    expect(escapeTokenValue(`⟦Sjekk & "send" 'no' <i>⟧`)).toBe(`⟦Sjekk &amp; "send" 'no' &lt;i&gt;⟧`);
  });

  it('[PROD-001] fills parameters with escaped values in one pass, and a title as plain text', () => {
    // Arrange
    const params = Object.freeze({
      question: '<p>{{question}}</p>',
      list: ['{{title}}', { deep: '{{unknown}} {{title}}' }, 3, null],
    });
    // Act
    const filled = resolveSkeletonParams(params, values);
    // Assert
    expect(filled).toEqual({
      question: '<p>⟦Skriv: «Q&amp;A» &lt;b&gt;⟧</p>',
      list: ['Tittel &amp; tekst', { deep: '{{unknown}} Tittel &amp; tekst' }, 3, null],
    });
    expect(resolveTokens('{{title}}', values, false)).toBe('Tittel & tekst');
    expect(resolveTokens('{{question}}', () => '{{title}}')).toBe('{{title}}');
    expect(params.question).toBe('<p>{{question}}</p>');
  });

  it('[PROD-001] keeps a __proto__ key as data and refuses parameters nested too deep', () => {
    // Arrange
    const hostile = JSON.parse('{"__proto__": {"polluted": "{{title}}"}}') as object;
    let deep: unknown = '{{title}}';
    for (let i = 0; i < 150; i += 1) deep = [deep];
    // Act
    const filled = resolveSkeletonParams(hostile, values) as Record<string, unknown>;
    // Assert
    expect(Object.hasOwn(filled, '__proto__')).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(() => resolveSkeletonParams(deep, values)).toThrow(RangeError);
  });

  it('[PED-010] lists every string of a skeleton with its key path', () => {
    expect(skeletonStrings({ library: 'H5P.X 1.0', params: { a: ['x', { b: 'y' }], n: 1 } })).toEqual([
      { path: ['library'], text: 'H5P.X 1.0' },
      { path: ['params', 'a', 0], text: 'x' },
      { path: ['params', 'a', 1, 'b'], text: 'y' },
    ]);
  });
});
