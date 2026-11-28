/**
 * Unit tests of the decisions insight reads from a Branching Scenario's parameters (INS-004): the real example's two
 * decisions with their options in stored order, what is no decision, and that a reworded, moved, added or removed
 * option is a changed answer key, so the save starts a new version (D-154).
 *
 * Spec: INS-004, PROD-013
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { answerKeys, answerKeysDiffer } from '../../src/insight/content/answerKeys.js';
import { branchingDecisions } from '../../src/insight/content/branchingDecisions.js';
import { questionCatalogue } from '../../src/insight/content/questionCatalogue.js';
import { BRANCHING_SCENARIO_ACTIVITY, D1, D2 } from './fixtures/twentyDeciders.js';

const example = JSON.parse(
  readFileSync(
    new URL('../../../../tools/h5p-libraries/examples/H5P.BranchingScenario.json', import.meta.url),
    'utf8',
  ),
) as { params: { branchingScenario: { content: Record<string, unknown>[] } } };
const SCENARIO = 'H5P.BranchingScenario';
type Alternative = { text: string; nextContentId: number };
/** The fixture's parameters with D1's options changed. */
const withOptions = (change: (options: Alternative[]) => Alternative[]) => {
  const params = structuredClone(BRANCHING_SCENARIO_ACTIVITY.params);
  const question = params.branchingScenario.content[1]?.type.params as {
    branchingQuestion: { alternatives: Alternative[] };
  };
  question.branchingQuestion.alternatives = change(question.branchingQuestion.alternatives);
  return params;
};
const keys = (params: unknown) => answerKeys('H5P.BranchingScenario 1.10', params);

describe('[INS-004] the decisions of a Branching Scenario', () => {
  it('[INS-004] the real example has two decisions, each with its question and its options in stored order', () => {
    // Act
    const decisions = branchingDecisions(SCENARIO, example.params);
    // Assert
    expect(decisions.map(({ item, text, options }) => [item.slice(-2), text, options.length])).toEqual([
      ['02', 'Korleis vil du bruke tida før samlinga?', 2],
      ['05', 'Korleis gjer du materiellet til samlinga tilgjengeleg for alle studentane?', 3],
    ]);
    expect(decisions[0]?.options[1]).toBe(
      'Eg sender ut ei lang pensumliste og går gjennom stoffet i ei førelesing på samlinga.',
    );
    expect(JSON.stringify(decisions)).not.toMatch(/[<>]/);
  });

  it('[INS-004] a decision is no question, and only a scenario’s own branching questions with an ID are decisions', () => {
    // Arrange
    const [text, first] = example.params.branchingScenario.content as [
      Record<string, unknown>,
      { type: Record<string, unknown> },
    ];
    const withoutId = { type: { ...first.type, subContentId: undefined } };
    const emptyId = { type: { ...first.type, subContentId: '' } };
    const content = [text, withoutId, emptyId, first, first, null, 'text', { type: 7 }];
    // Act
    const found = branchingDecisions(SCENARIO, { branchingScenario: { content } });
    const elsewhere = [
      branchingDecisions('H5P.CoursePresentation', example.params),
      branchingDecisions(SCENARIO, null),
      branchingDecisions(SCENARIO, { branchingScenario: { content: 'none' } }),
    ];
    // Assert
    expect(found.map(({ item }) => item.slice(-2))).toEqual(['02']);
    expect(elsewhere).toEqual([[], [], []]);
    expect(questionCatalogue(SCENARIO, example.params)).toEqual([]);
  });

  it('[PROD-013] a decision’s options are its answer key: reworded, swapped, added or removed is a new version', () => {
    // Arrange
    const before = keys(BRANCHING_SCENARIO_ACTIVITY.params);
    const changed = [
      withOptions(([a, b]) => [a!, { ...b!, text: '<p>Ei kort pensumliste</p>' }]),
      withOptions(([a, b]) => [b!, a!]),
      withOptions((options) => [...options, { text: '<p>Ingenting</p>', nextContentId: 2 }]),
      withOptions(([a]) => [a!]),
    ];
    // WHY: the same text in other markup is the same option to a reader; the key compares plain text.
    const sameText = withOptions(([a, b]) => [a!, { ...b!, text: '<div>Ei lang  pensumliste</div>' }]);
    // Act
    const differs = changed.map((params) => answerKeysDiffer(before, keys(params)));
    // Assert
    expect([...before.keys()]).toEqual([D1, D2]);
    expect(differs).toEqual([true, true, true, true]);
    expect(answerKeysDiffer(before, keys(sameText))).toBe(false);
    expect(answerKeysDiffer(before, keys(structuredClone(BRANCHING_SCENARIO_ACTIVITY.params)))).toBe(false);
  });
});
