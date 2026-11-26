/**
 * Tests of the limits on what one activity's parameters may hold (D-126): each limit at and just past its
 * boundary, the refusal's shape, and that the measuring pass itself stays in step with the size of its input.
 *
 * Spec: SEC-005, PROD-012
 */
import { describe, expect, it } from 'vitest';
import {
  assertContentBudget,
  CONTENT_LIMITS,
  contentLimitPassed,
} from '../../../src/h5p/semantics/contentBudget.js';

const { characters, values, textLength, openTags, keyLength, libraryNameLength } = CONTENT_LIMITS;
/** Content as the editor writes it: a question set with one question. */
const genuine = () => ({
  introPage: {
    showIntroPage: true,
    title: 'Celler',
    introduction: '<p>Kva veit du om <strong>celler</strong>?</p>',
  },
  questions: [
    {
      library: 'H5P.MultiChoice 1.16',
      params: { question: '<p>Kva er ei celle?</p>', answers: [{ text: 'Ei eining', correct: true }] },
      subContentId: '5f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
    },
  ],
});

describe('[SEC-005] the limits on what one activity may hold', () => {
  it('[SEC-005] content as the editor writes it is inside every limit', () => {
    // Arrange
    const params = genuine();
    // Act
    const passed = contentLimitPassed(params);
    // Assert
    expect(passed).toBeUndefined();
    expect(() => assertContentBudget(params)).not.toThrow();
  });

  it('[SEC-005] one text may be as long as the limit and no longer', () => {
    // Arrange
    const atLimit = { ...genuine(), text: 'a'.repeat(textLength) };
    const pastLimit = { ...genuine(), text: 'a'.repeat(textLength + 1) };
    // Act
    const results = [contentLimitPassed(atLimit), contentLimitPassed(pastLimit)];
    // Assert
    expect(results).toEqual([undefined, 'text']);
  });

  it('[SEC-005] one text may have as many tags open at once as the limit and no more', () => {
    // Arrange
    const nested = (depth: number) => `${'<span>'.repeat(depth)}tekst${'</span>'.repeat(depth)}`;
    const atLimit = { questions: [{ params: { question: nested(openTags) } }] };
    const pastLimit = { questions: [{ params: { question: nested(openTags + 1) } }] };
    // Act
    const results = [contentLimitPassed(atLimit), contentLimitPassed(pastLimit)];
    // Assert
    expect(results).toEqual([undefined, 'markup']);
  });

  it('[SEC-005] all strings and keys together may hold as many characters as the limit and no more', () => {
    // Arrange: 20 texts of the longest length are exactly the limit, with one-character keys taken off the first
    const texts = Array.from({ length: characters / textLength }, () => 'a'.repeat(textLength));
    const atLimit = { t: [texts[0]?.slice(1), ...texts.slice(1)] };
    const pastLimit = { t: texts };
    // Act
    const results = [contentLimitPassed(atLimit), contentLimitPassed(pastLimit)];
    // Assert
    expect(results).toEqual([undefined, 'whole']);
  });

  it('[SEC-005] objects, lists and leaf values together may be as many as the limit and no more', () => {
    // Arrange: the list itself is one value, its items the rest
    const atLimit = Array.from({ length: values - 1 }, () => 0);
    const pastLimit = Array.from({ length: values }, () => 0);
    // Act
    const results = [contentLimitPassed(atLimit), contentLimitPassed(pastLimit)];
    // Assert
    expect(results).toEqual([undefined, 'whole']);
  });

  it('[SEC-005] a key may be as long as the limit and no longer', () => {
    // Arrange
    const atLimit = { [`k${'e'.repeat(keyLength - 1)}`]: 1 };
    const pastLimit = { [`k${'e'.repeat(keyLength)}`]: 1 };
    // Act
    const results = [contentLimitPassed(atLimit), contentLimitPassed(pastLimit)];
    // Assert
    expect(results).toEqual([undefined, 'whole']);
  });

  it('[H5P-002] a string under a key named library may be as long as the limit and no longer, at any depth', () => {
    // Arrange
    const holder = (length: number) => ({ a: [{ b: { library: `H5P.${'x'.repeat(length - 4)}` } }] });
    // Act
    const results = [
      contentLimitPassed(holder(libraryNameLength)),
      contentLimitPassed(holder(libraryNameLength + 1)),
    ];
    // Assert
    expect(results).toEqual([undefined, 'whole']);
  });

  it('[SEC-005] the paths of all values together may be as long as the limit and no longer', () => {
    // Arrange: a list under one long key; an item's path is the key, its index and their separators
    const key = 'k'.repeat(250);
    const pathOfItem = (index: number) => key.length + 1 + String(index).length + 2;
    let items = 0;
    for (let sum = key.length + 1; sum + pathOfItem(items) <= CONTENT_LIMITS.pathCharacters; items += 1)
      sum += pathOfItem(items);
    const list = (length: number) => ({ [key]: Array.from({ length }, () => 0) });
    // Act
    const results = [contentLimitPassed(list(items)), contentLimitPassed(list(items + 1))];
    // Assert
    expect(items).toBeLessThan(values - 2);
    expect(results).toEqual([undefined, 'whole']);
  });

  it('[PROD-012] a refusal is a 400 that names the kind of limit and nothing from the content', () => {
    // Arrange
    const params = { secret: 'hemmeleg', text: 'a'.repeat(textLength + 1) };
    // Act
    const refuse = () => assertContentBudget(params);
    // Assert
    expect(refuse).toThrow(
      expect.objectContaining({
        errorId: 'hvl:content-too-large',
        httpStatusCode: 400,
        replacements: { limit: 'text' },
      }),
    );
  });

  it('[SEC-005] values that are no objects, lists or strings are counted and otherwise left alone', () => {
    // Arrange
    const params = { a: null, b: 1.5, c: true, d: [null, false, 0] };
    const before = structuredClone(params);
    // Act
    const passed = contentLimitPassed(params);
    // Assert
    expect(passed).toBeUndefined();
    expect(params).toEqual(before);
  });

  it('[SEC-005] measuring stays in step with the size of the content: far past a limit, and just inside all', () => {
    // Arrange: three million values in one list, and nineteen of the longest texts with 100 tags open throughout
    const many = Array.from({ length: 3_000_000 }, () => 0);
    const pair = '</span><span>';
    const head = '<span>'.repeat(openTags);
    const dense = head + pair.repeat(Math.floor((textLength - head.length) / pair.length));
    const largest = { texts: Array.from({ length: 19 }, () => dense) };
    // Act
    const started = performance.now();
    const results = [contentLimitPassed(many), contentLimitPassed(largest)];
    const elapsed = performance.now() - started;
    // Assert
    expect(results).toEqual(['whole', undefined]);
    expect(elapsed).toBeLessThan(2000);
  });
});
