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
import { nodesOnCycles } from '../../../src/validation/graphCycles.js';
import { asArray, fieldAt } from '../../../src/validation/paramReaders.js';
import { branchingStructureHint } from '../../../src/validation/rules/branchingStructureHint.js';
import { fixturesOf, hitsOf } from '../support/ruleFixtures.js';

const range = (from: number, to: number): number[] => Array.from({ length: to - from }, (_, k) => from + k);
const question = (next: readonly number[]) => ({
  type: {
    library: 'H5P.BranchingQuestion 1.0',
    params: { branchingQuestion: { alternatives: next.map((nextContentId) => ({ nextContentId })) } },
  },
});
const text = (nextContentId: number) => ({
  type: { library: 'H5P.AdvancedText 1.1', params: { text: '<p>Tekst</p>' } },
  nextContentId,
});

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

  it('[PED-020][PED-H06] counts exactly in a graph without loops, however many paths it has', () => {
    // Arrange: 40 questions, each leading to every later one (2^40 paths)
    const graph = branchingGraphOf(Array.from({ length: 40 }, (_, i) => question(range(i + 1, 40))));
    // Act and assert
    expect(decisionPointsOnMainPath(graph)).toBe(40);
    expect(hasLoopFromStart(graph)).toBe(false);
  });

  it('[PED-020][PED-H06] counts a long case whose choices meet again after their feedback, with a loop back', () => {
    // Arrange: 14 questions with two choices each. Each choice goes to its own text node, which leads on to the
    // next question; the first text node loops back to the start. There are 2^14 ways through.
    const content = Array.from({ length: 14 }, (_, q) => [
      question([3 * q + 1, 3 * q + 2]),
      text(q === 0 ? 0 : 3 * q + 3),
      text(3 * q + 3),
    ]).flat();
    const graph = branchingGraphOf([...content, text(-1)]);
    // Act and assert
    expect(decisionPointsOnMainPath(graph)).toBe(14);
    expect(hasLoopFromStart(graph)).toBe(true);
  });

  it('[PED-020][PED-H06] gives up on a pathological graph instead of searching for ever', () => {
    // Arrange: 40 questions, each leading to every other one (every order of them is a path)
    const graph = branchingGraphOf(
      Array.from({ length: 40 }, (_, i) => question(range(0, 40).filter((k) => k !== i))),
    );
    // Act and assert
    expect(decisionPointsOnMainPath(graph)).toBeUndefined();
    expect(hasLoopFromStart(graph)).toBe(true);
  });

  it.each([
    [
      [[1], [2], [1, 3], []],
      [false, true, true, false],
    ],
    [[[0]], [false]],
    [
      [[1, 9], [0], [0]],
      [true, true, false],
    ],
  ])('[PED-020][PED-H06] finds the nodes on a cycle in %j', (edges, onCycle) => {
    expect(nodesOnCycles(edges)).toEqual(onCycle);
  });

  it('[PED-020][PED-H06] treats alternatives that lead to the same node as one way on', () => {
    // Act
    const graph = branchingGraphOf([question([1, 1, 2, 1]), text(-1), text(-1)]);
    // Assert
    expect(graph.edges[0]).toEqual([1, 2]);
  });
});
