/**
 * Property tests of INS-004 under INS-006 (fast-check, D-114): for random plays of a Branching Scenario and any k
 * from 3, no figure of a decision shows a group smaller than k, no hidden option follows from the decision's
 * learners, every shown figure is the true one, and the CSV rows carry the same cells.
 *
 * Spec: INS-004, INS-006, INS-009
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { insightCsvRows } from '../../src/insight/export/insightCsvRows.js';
import { minimumGroupSize } from '../../src/privacy/minimumGroupSize.js';
import type { FixtureRow } from './fixtures/thirtyLearners.js';
import { BRANCHING_SCENARIO_ACTIVITY, D1, D2 } from './fixtures/twentyDeciders.js';
import { reportOf } from './support/insightFixtureReport.js';
import { cellsIn, insightInvariantViolations } from './support/reportInvariants.js';

const OPTIONS = { [D1]: 2, [D2]: 3 } as const;
type Decision = keyof typeof OPTIONS;
/** One learner's play: whether the page was opened, and the answers sent under the decisions, some of them no choice. */
const learnerPlay = fc.record({
  opened: fc.boolean(),
  answers: fc.array(
    fc.tuple(fc.constantFrom<Decision>(D1, D2), fc.constantFrom('0', '1', '2', '3', '', 'x', '0[,]1')),
    { maxLength: 6 },
  ),
});
type Play = typeof learnerPlay extends fc.Arbitrary<infer T> ? T : never;
const dataset = fc.record({
  k: fc.integer({ min: 3, max: 7 }),
  learners: fc.array(learnerPlay, { maxLength: 45 }),
});

/** The rows of one learner's play, one page load, a second apart. */
function rowsOf(n: number, play: Play): FixtureRow[] {
  const steps: [FixtureRow['verb'], string | null, string | null][] = [
    ...(play.opened ? [['attempted', null, null] as [FixtureRow['verb'], null, null]] : []),
    ...play.answers.map(([item, response]): [FixtureRow['verb'], string, string] => [
      'answered',
      item,
      response,
    ]),
  ];
  return steps.map(([verb, subContentId, response], i) => ({
    verb,
    subContentId,
    response,
    scoreRaw: null,
    scoreMax: null,
    success: null,
    learnerKey: `property-decider-${n}`,
    attemptId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}:1`,
    timestamp: new Date(Date.UTC(2026, 10, 2, 8, n, i)),
  }));
}

/** Worked out from the plays, not from the code under test: per option the first choices, and who chose again. */
function expected(learners: readonly Play[], decision: Decision) {
  const first = Array.from({ length: OPTIONS[decision] }, () => 0);
  let [choosers, again] = [0, 0];
  for (const play of learners) {
    const choices = play.answers
      .filter(([item, response]) => item === decision && ['0', '1', '2'].includes(response))
      .map(([, response]) => Number(response))
      .filter((index) => index < OPTIONS[decision]);
    if (choices.length === 0) continue;
    choosers += 1;
    first[choices[0] ?? 0] = (first[choices[0] ?? 0] ?? 0) + 1;
    if (choices.length > 1) again += 1;
  }
  return { first, choosers, again };
}

describe('[INS-006] suppression properties of a scenario’s decisions', () => {
  it('[INS-006] for random plays no figure of a decision shows a group smaller than k and no hidden option follows from the total', () => {
    fc.assert(
      fc.property(dataset, ({ k, learners }) => {
        // Arrange
        const rows = learners.flatMap((play, n) => rowsOf(n, play));
        // Act
        const report = reportOf(BRANCHING_SCENARIO_ACTIVITY, rows, { size: minimumGroupSize(k) });
        // Assert
        expect(insightInvariantViolations(report)).toEqual([]);
        expect(JSON.stringify(report)).not.toContain('property-decider');
        expect(report.items).toEqual([]);
      }),
    );
  });

  it('[INS-004] for random plays every shown figure is the true one: first choices, learners and «chose again»', () => {
    fc.assert(
      fc.property(dataset, ({ k, learners }) => {
        // Arrange
        const rows = learners.flatMap((play, n) => rowsOf(n, play));
        // Act
        const report = reportOf(BRANCHING_SCENARIO_ACTIVITY, rows, { size: minimumGroupSize(k) });
        // Assert
        const started = learners.filter((play) => play.opened || play.answers.length > 0).length;
        for (const entry of report.branching ?? []) {
          const truth = expected(learners, entry.item as Decision);
          const figures: [{ suppressed: true } | { suppressed: false; value: number }, number][] = [
            [entry.learners, truth.choosers],
            [entry.choseAgain, truth.again],
            ...entry.options.map((option): [typeof option.learners, number] => [
              option.learners,
              truth.first[option.index] ?? -1,
            ]),
          ];
          for (const [cell, value] of figures) expect(cell.suppressed || cell.value === value).toBe(true);
          // WHY: the decision's learners are hidden only when they, or the learners who started, number 1 to k − 1.
          const small = (count: number) => count > 0 && count < k;
          expect(entry.learners.suppressed).toBe(small(truth.choosers) || small(started));
        }
      }),
    );
  });

  it('[INS-009] for random plays the CSV rows carry «< k» for each suppressed cell and no count below k', () => {
    fc.assert(
      fc.property(dataset, ({ k, learners }) => {
        // Arrange
        const rows = learners.flatMap((play, n) => rowsOf(n, play));
        const report = reportOf(BRANCHING_SCENARIO_ACTIVITY, rows, { size: minimumGroupSize(k) });
        // Act
        const decisions = insightCsvRows(report).filter(({ section }) => section === 'decisions');
        // Assert
        expect(decisions.map(({ measure }) => measure)).toEqual([
          ...['choosers', 'firstChoice', 'firstChoice', 'choseAgain'],
          ...['choosers', 'firstChoice', 'firstChoice', 'firstChoice', 'choseAgain'],
        ]);
        const hidden = cellsIn(report.branching).filter((cell) => cell.suppressed).length;
        expect(decisions.filter(({ value }) => value === `< ${k}`)).toHaveLength(hidden);
        for (const { value } of decisions.filter((row) => row.value !== `< ${k}`))
          expect(value === '0' || Number(value) >= k).toBe(true);
      }),
    );
  });
});
