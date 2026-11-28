/**
 * Unit tests of INS-004 on the 20-learner scenario fixture: each decision's first choices per option and who chose
 * again, against the hand calculation in fixtures/README.md; what is no choice; the suppression of a decision's
 * options as one additive group; and where the section is left out (another type, an older version).
 *
 * Spec: INS-004, INS-006, INS-002
 */
import { describe, expect, it } from 'vitest';
import { chosenOption } from '../../src/insight/aggregate/branchingChoices.js';
import { minimumGroupSize } from '../../src/privacy/minimumGroupSize.js';
import { QUESTION_SET } from './fixtures/insightActivities.js';
import { questionSetRows } from './fixtures/thirtyLearners.js';
import { BRANCHING_SCENARIO_ACTIVITY, D1, D2, deciderRows } from './fixtures/twentyDeciders.js';
import { reportOf, shown } from './support/insightFixtureReport.js';
import { cellsIn } from './support/reportInvariants.js';

/** A decision of a report, compactly: `[learners, [option cells], choseAgain]`. */
const figures = (report: ReturnType<typeof reportOf>, item: string) => {
  const entry = report.branching?.find((decision) => decision.item === item);
  return (
    entry && [shown(entry.learners), entry.options.map((o) => shown(o.learners)), shown(entry.choseAgain)]
  );
};
const learnersOf = (n: number) => (key: string) => Number(key.slice(-2)) <= n;

describe('[INS-004] the choices at each decision', () => {
  it('[INS-004] match the hand calculation: first choice per option, and who chose again', () => {
    // Act
    const report = reportOf(BRANCHING_SCENARIO_ACTIVITY, deciderRows());
    // Assert
    expect(report.branching?.map(({ item, questionText }) => [item, questionText])).toEqual([
      [D1, 'Korleis vil du bruke tida før samlinga?'],
      [D2, 'Korleis gjer du materiellet tilgjengeleg?'],
    ]);
    expect(report.branching?.[0]?.options.map(({ index, text }) => [index, text])).toEqual([
      [0, 'Ein kort video og ein quiz'],
      [1, 'Ei lang pensumliste'],
    ]);
    expect(figures(report, D1)).toEqual([19, [10, 9], 8]);
    // WHY: 4 and 1 are hidden; two hidden cells that are not alike need no third (INS-006).
    expect(figures(report, D2)).toEqual([16, [11, '<k', '<k'], 0]);
    expect(shown(report.participation.started)).toBe(20);
  });

  it('[INS-002] a decision is no question: its choices are in no row of the question list', () => {
    // Act
    const report = reportOf(BRANCHING_SCENARIO_ACTIVITY, deciderRows());
    // Assert: 19 and 16 learners answered under D1 and D2, enough for a row of an unlisted question
    expect(report.items).toEqual([]);
    expect(report.misconceptions).toEqual([]);
  });

  it('[INS-004] only the whole-number index of one of the decision’s options is a choice', () => {
    // Arrange
    const none = ['3', '12', ' 1', '1 ', '-1', '1.0', '01x', '', '0[,]1', null];
    // Act
    const chosen = ['0', '1', '2'].map((response) => chosenOption(response, 3));
    const notChosen = [...none.map((response) => chosenOption(response, 3)), chosenOption('0', 0)];
    // Assert
    expect(chosen).toEqual([0, 1, 2]);
    expect(notChosen.every((index) => index === undefined)).toBe(true);
    // WHY: an index has at most four digits, however many options the parameters claim.
    expect(chosenOption('99999', 100_000)).toBeUndefined();
  });

  it('[INS-006] one option below k hides a second cell, and a decision with fewer than k learners hides all', () => {
    // Arrange: L01–L14 without L07 and L08, so D2's options hold 11, 0 and 1; and L01–L03 alone
    const fourteen = deciderRows().filter(
      ({ learnerKey }) => learnersOf(14)(learnerKey) && !['07', '08'].includes(learnerKey.slice(-2)),
    );
    const three = deciderRows().filter(({ learnerKey }) => learnersOf(3)(learnerKey));
    // Act
    const [one, few, k3] = [
      reportOf(BRANCHING_SCENARIO_ACTIVITY, fourteen),
      reportOf(BRANCHING_SCENARIO_ACTIVITY, three),
      reportOf(BRANCHING_SCENARIO_ACTIVITY, three, { size: minimumGroupSize(3) }),
    ];
    // Assert: the single hidden 1 would follow from the total 12, so the 0 is hidden with it
    expect(figures(one, D2)).toEqual([12, [11, '<k', '<k'], 0]);
    // WHY: three learners started: every cell about them is hidden, a 0 too.
    expect(cellsIn(few.branching).every((cell) => cell.suppressed)).toBe(true);
    expect(figures(k3, D1)).toEqual([3, [3, 0], 0]);
  });

  it('[INS-006] a decision whose learners are hidden hides «chose again» too, although it is 0', () => {
    // Arrange: all twenty start, but only L17, L18 and L19's first page load choose at D1, and nobody reaches D2
    const rows = deciderRows().filter(
      ({ verb, learnerKey, attemptId }) =>
        verb === 'attempted' ||
        (['17', '18', '19'].includes(learnerKey.slice(-2)) && !attemptId.includes('1902:')),
    );
    // Act
    const report = reportOf(BRANCHING_SCENARIO_ACTIVITY, rows);
    // Assert
    expect(figures(report, D1)).toEqual(['<k', ['<k', '<k'], '<k']);
    expect(figures(report, D2)).toEqual([0, [0, 0, 0], 0]);
  });

  it('[INS-004] the section is for a Branching Scenario’s current version only', () => {
    // Act
    const older = reportOf(BRANCHING_SCENARIO_ACTIVITY, deciderRows(), { scope: { currentVersion: 2 } });
    const other = reportOf(QUESTION_SET, questionSetRows());
    const empty = reportOf({ mainLibrary: 'H5P.BranchingScenario', params: {} }, deciderRows());
    // Assert
    expect([older.branching, other.branching, empty.branching]).toEqual([[], null, []]);
    // WHY: without decisions in the parameters every stored answer under D1 and D2 (L20's three too) is one nobody
    // can place: a row of an unlisted question.
    expect(empty.items.map(({ library, learners }) => [library, shown(learners)])).toEqual([
      [null, 20],
      [null, 16],
    ]);
  });
});
