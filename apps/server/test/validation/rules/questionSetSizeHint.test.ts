/**
 * Tests for PED-H04 (questionSetSizeHint): keep question sets short. Each fixture in apps/server/test/fixtures/content/PED-H04/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: PED-020
 */
import { describe, expect, it } from 'vitest';
import { walkContent } from '../../../src/validation/contentWalker.js';
import { questionSetSizeHint } from '../../../src/validation/rules/questionSetSizeHint.js';
import { fixturesOf, hitsOf, TEST_CONTEXT } from '../support/ruleFixtures.js';

describe('PED-H04', () => {
  it.each(fixturesOf('PED-H04'))('[PED-020][PED-H04] $name: $description', (fixture) => {
    expect(hitsOf(questionSetSizeHint, fixture)).toEqual(fixture.expected);
  });

  it('[PED-020][PED-H04] uses the threshold from the context, not a constant', () => {
    // Arrange
    const fixture = fixturesOf('PED-H04').find((f) => f.name === 'positive-sixteen-questions');
    const context = { ...TEST_CONTEXT, thresholds: { ...TEST_CONTEXT.thresholds, maxQuestionsPerSet: 20 } };
    const nodes = walkContent(fixture?.mainLibrary ?? '', fixture?.params);
    // Act
    const hits = questionSetSizeHint.check({ nodes, metadata: {}, context });
    // Assert
    expect(hits).toEqual([]);
  });
});
