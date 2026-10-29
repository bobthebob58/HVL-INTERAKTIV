/**
 * Tests for the pattern availability memo of the public studio routes: one build per pattern within its lifetime,
 * shared while it runs, asked again after it, and never a kept failure.
 *
 * Spec: PED-001, PROD-001
 */
import { describe, expect, it } from 'vitest';
import { memoizePatternAvailability } from '../../../src/learningDesign/http/patternAvailabilityMemo.js';
import type { PatternAvailabilityLookup } from '../../../src/learningDesign/http/studioContentAnswers.js';

type Availability = Awaited<ReturnType<PatternAvailabilityLookup['availability']>>;

/** A lookup that counts its calls and answers what the test sets. */
function countingLookup(answer: () => Promise<Availability>) {
  const calls: string[] = [];
  const lookup: PatternAvailabilityLookup = {
    availability: (patternId) => {
      calls.push(patternId);
      return answer();
    },
  };
  return { calls, lookup };
}

const AVAILABLE: Availability = {
  available: true,
  contentTypes: [{ contentType: 'H5P.Blanks', available: true }],
};

describe('[PED-001] the public routes’ pattern availability memo', () => {
  it('[PED-001] builds a pattern once within the lifetime, per pattern, and again after it', async () => {
    // Arrange
    let clock = 0;
    const { calls, lookup } = countingLookup(() => Promise.resolve(AVAILABLE));
    const memo = memoizePatternAvailability(lookup, { ttlMs: 1_000, now: () => clock });
    // Act
    await memo.availability('a');
    await memo.availability('a');
    await memo.availability('b');
    clock = 999;
    await memo.availability('a');
    clock = 1_000;
    const later = await memo.availability('a');
    // Assert
    expect(calls).toEqual(['a', 'b', 'a']);
    expect(later).toEqual(AVAILABLE);
  });

  it('[PED-001] lets requests that arrive while a build runs share it', async () => {
    // Arrange
    let finish: (value: Availability) => void = () => undefined;
    const { calls, lookup } = countingLookup(() => new Promise((resolve) => (finish = resolve)));
    const memo = memoizePatternAvailability(lookup);
    // Act
    const answers = Promise.all([memo.availability('a'), memo.availability('a'), memo.availability('a')]);
    finish(AVAILABLE);
    // Assert
    expect(await answers).toEqual([AVAILABLE, AVAILABLE, AVAILABLE]);
    expect(calls).toEqual(['a']);
  });

  it('[PROD-001] never keeps a failure: the next request asks again', async () => {
    // Arrange
    let fail = true;
    const { calls, lookup } = countingLookup(() =>
      fail ? Promise.reject(new Error('disk')) : Promise.resolve(AVAILABLE),
    );
    const memo = memoizePatternAvailability(lookup);
    // Act
    const first = await memo.availability('a').catch((error: unknown) => error);
    fail = false;
    const second = await memo.availability('a');
    // Assert
    expect(first).toBeInstanceOf(Error);
    expect(second).toEqual(AVAILABLE);
    expect(calls).toEqual(['a', 'a']);
  });
});
