/**
 * Tests for PED-H06 (branchingStructureHint): keep cases short, explained and open to a second try. Each fixture in apps/server/test/fixtures/content/PED-H06/ is a whole
 * activity with exactly the hits it must give.
 *
 * Spec: PED-020
 */
import { describe, expect, it } from 'vitest';
import {
  branchingGraphOf,
  decisionPointsOnMainPath,
  hasLoopFromStart,
} from '../../../src/validation/branchingGraph.js';
import { asArray, fieldAt } from '../../../src/validation/paramReaders.js';
import { branchingStructureHint } from '../../../src/validation/rules/branchingStructureHint.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

describe('PED-H06', () => {
  it.each(fixturesOf('PED-H06'))('[PED-020][PED-H06] $name: $description', (fixture) => {
    expect(hitsOf(branchingStructureHint, fixture)).toEqual(fixture.expected);
  });

  it('[PED-020][PED-H06] counts the decisions on the path that meets the most of them', () => {
    // Arrange: 0 → question 1 → (2 → question 4) or (3 → back to 1)
    const content = fixturesOf('PED-H06').find((f) => f.name === 'negative-two-decisions-with-loop');
    const graph = branchingGraphOf(asArray(fieldAt(content?.params, 'branchingScenario', 'content')));
    // Act and assert
    expect(decisionPointsOnMainPath(graph)).toBe(2);
    expect(hasLoopFromStart(graph)).toBe(true);
  });

  it('[PED-020][PED-H06] gives up on a pathological graph instead of searching for ever', () => {
    // Arrange: 40 questions, each leading to every later one (2^40 paths)
    const node = (i: number) => ({
      type: {
        library: 'H5P.BranchingQuestion 1.0',
        params: {
          branchingQuestion: {
            alternatives: Array.from({ length: 40 - i }, (_, k) => ({ nextContentId: i + k + 1 })),
          },
        },
      },
    });
    const graph = branchingGraphOf(Array.from({ length: 40 }, (_, i) => node(i)));
    // Act and assert
    expect(decisionPointsOnMainPath(graph)).toBeUndefined();
    expect(hasLoopFromStart(graph)).toBe(false);
  });
});
