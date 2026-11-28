/**
 * branchingChoices — INS-004: for each decision of a Branching Scenario, how many learners chose each option the
 * first time they met it, and how many chose there again.
 *
 * Why: a scenario lets the learner decide and shows what follows. Which option most learners take first, and how
 *      many come back to decide again, tells the teacher what to take up in the seminar (INS-004, `ea-diagnose`).
 * Spec: INS-004, INS-006
 * Invariants:
 *   - PEDAGOGY: each learner's first choice at a decision is counted, as for a choice question (INS-003): it shows
 *     what they thought before they saw the consequence.
 *   - A stored `answered` under a decision's ID is a choice only when its response is the whole-number index of one
 *     of the decision's options (D-154); anything else is no choice and counts nowhere, so the options' cells add
 *     up to the decision's learners.
 *   - «Chose again» is the learners with more than one choice at the decision in the view: through a loop, the back
 *     button or a new run (INS-004's retry path).
 *   - PRIVACY: a decision's options are one additive group over its learners (../suppression/additiveGroupCells.ts):
 *     below k suppressed, with complementary suppression (INS-006). «Chose again» is a count of learners,
 *     suppressed below k, and hidden with the group when the decision's learners are hidden. No figure joins two
 *     decisions, and none is about one learner's path (D-154).
 * Collaborators: ../content/branchingDecisions.ts, ../suppression/additiveGroupCells.ts, ../buildInsightReport.ts.
 * Tests: apps/server/test/insight/branchingChoices.test.ts,
 *   apps/server/test/insight/branchingSuppression.property.test.ts
 */
import type { MinimumGroupSize } from '../../privacy/minimumGroupSize.js';
import type { BranchingDecision } from '../content/branchingDecisions.js';
import type { InsightStatement } from '../data/insightStatements.js';
import type { BranchingDecisionInsight } from '../insightReport.js';
import { additiveGroupCells } from '../suppression/additiveGroupCells.js';
import {
  countCell,
  isShowableCount,
  SUPPRESSED_CELL,
  withinShownGroup,
} from '../suppression/insightCells.js';

/**
 * The option a stored response chooses.
 * @param response - The stored response, e.g. `1`.
 * @param optionCount - How many options the decision has.
 * @returns The index, or undefined when the response is not the index of one of the options.
 */
export function chosenOption(response: string | null, optionCount: number): number | undefined {
  if (response === null || !/^\d{1,4}$/.test(response)) return undefined;
  const index = Number(response);
  return index < optionCount ? index : undefined;
}

/**
 * INS-004 for a scenario's decisions.
 * @param size - The minimum group size.
 * @param decisions - The decisions, from the activity's parameters.
 * @param statements - The view's statements in stored order.
 * @returns One entry per decision, in the decisions' order, every number suppressed below *k*.
 * @spec INS-004
 */
export function branchingChoices(
  size: MinimumGroupSize,
  decisions: readonly BranchingDecision[],
  statements: readonly InsightStatement[],
): BranchingDecisionInsight[] {
  const known = new Map(decisions.map((decision) => [decision.item, decision]));
  /** Per decision, per learner: the options they chose, in stored order. */
  const chosen = new Map<string, Map<number, number[]>>();
  for (const statement of statements) {
    const decision = statement.item === null ? undefined : known.get(statement.item);
    if (statement.verb !== 'answered' || decision === undefined) continue;
    const index = chosenOption(statement.response, decision.options.length);
    if (index === undefined) continue;
    const learners = chosen.get(decision.item) ?? new Map<number, number[]>();
    chosen.set(decision.item, learners);
    learners.set(statement.learner, [...(learners.get(statement.learner) ?? []), index]);
  }
  return decisions.map((decision) => {
    const learners = [...(chosen.get(decision.item)?.values() ?? [])];
    const first = decision.options.map(() => 0);
    let again = 0;
    for (const choices of learners) {
      const index = choices[0] ?? 0;
      first[index] = (first[index] ?? 0) + 1;
      if (choices.length > 1) again += 1;
    }
    const cells = additiveGroupCells(size, learners.length, first);
    return {
      item: decision.item,
      questionText: decision.text,
      learners: countCell(size, learners.length),
      options: decision.options.map((text, index) => ({
        index,
        text,
        learners: cells[index] ?? SUPPRESSED_CELL,
      })),
      // PRIVACY: even a 0 says what each learner of a hidden small group did, so it is hidden with the group.
      choseAgain: withinShownGroup(countCell(size, again), isShowableCount(size, learners.length)),
    };
  });
}
