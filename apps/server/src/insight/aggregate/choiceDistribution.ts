/**
 * choiceDistribution — INS-003 for a choice question: how the learners' first answers are spread over its options,
 * with the teacher's own feedback text next to each wrong option.
 *
 * Why: a misconception shows as many learners choosing the same wrong option; seeing that option with the feedback
 *      the teacher wrote for it lets the teacher decide what to take up in the seminar (INS-003, `ea-diagnose`).
 * Spec: INS-003, INS-006
 * Invariants:
 *   - PEDAGOGY: each learner's first answer is counted, since it shows what they thought before H5P's feedback and
 *     retries (spec 04 §3, "Using pre-work in class": Novak, Patterson, Gavrin & Christian 1999).
 *   - The response is H5P's choice indices joined by `[,]`, in the stored order of the options (MultiChoice reports
 *     `originalOrder`, D-115). A learner is counted once per option they chose; an answer that names no option of the
 *     current parameters counts as «no answer», so the cells add up to the learners for a single-answer question.
 *   - PRIVACY: the options and «no answer» are one additive group over the question's learners
 *     (../suppression/additiveGroupCells.ts): below k suppressed, with complementary suppression (INS-006). When
 *     every first answer names at most one option, INS-002's share correct times the learners tells how many chose a
 *     right option, so the right options and the rest (wrong options and «no answer») are protected as two groups,
 *     each with its own total; otherwise a hidden wrong option could be worked out through INS-002.
 * Collaborators: ./learnerAnswers.ts, ../content/questionShapes.ts, ../suppression/additiveGroupCells.ts,
 *   ../buildInsightReport.ts.
 * Tests: apps/server/test/insight/thirtyLearners.test.ts, apps/server/test/insight/misconceptions.test.ts
 */
import { XAPI_GAP_SEPARATOR } from '@hvl-interaktiv/api-contract';
import type { MinimumGroupSize } from '../../privacy/minimumGroupSize.js';
import type { ChoiceOptionText } from '../content/questionShapes.js';
import type { ChoiceMisconception } from '../insightReport.js';
import { partitionedGroupCells } from '../suppression/additiveGroupCells.js';
import { countCell, SUPPRESSED_CELL } from '../suppression/insightCells.js';
import type { LearnerItemAnswers } from './learnerAnswers.js';

/**
 * The options a choice response names.
 * @param response - The stored response, e.g. `0[,]2`.
 * @param optionCount - How many options the question has now.
 * @returns The distinct option indices within range.
 */
export function chosenOptions(response: string | null, optionCount: number): Set<number> {
  const chosen = new Set<number>();
  for (const part of (response ?? '').split(XAPI_GAP_SEPARATOR)) {
    const index = /^\d+$/.test(part.trim()) ? Number(part.trim()) : Number.NaN;
    if (Number.isInteger(index) && index < optionCount) chosen.add(index);
  }
  return chosen;
}

/**
 * INS-003 for one choice question.
 * @param size - The minimum group size.
 * @param question - The question's ID and text.
 * @param options - Its options from the parameters.
 * @param answers - Its learners with their first and latest answer.
 * @returns The suppressed distribution of the first answers.
 * @spec INS-003
 */
export function choiceDistribution(
  size: MinimumGroupSize,
  question: { readonly item: string | null; readonly text: string },
  options: readonly ChoiceOptionText[],
  answers: readonly LearnerItemAnswers[],
): ChoiceMisconception {
  const perOption = options.map(() => 0);
  let noAnswer = 0;
  let singleAnswer = true;
  for (const { first } of answers) {
    const chosen = chosenOptions(first.response, options.length);
    if (chosen.size === 0) noAnswer += 1;
    if (chosen.size > 1) singleAnswer = false;
    for (const index of chosen) perOption[index] = (perOption[index] ?? 0) + 1;
  }
  const every = [...options.keys(), options.length];
  const right = every.filter((index) => options[index]?.correct === true);
  // PRIVACY: INS-002 reveals the right options' total for a single-answer question; each part is a group (INS-006).
  const parts =
    singleAnswer && right.length > 0 ? [right, every.filter((index) => !right.includes(index))] : [every];
  const cells = partitionedGroupCells(size, answers.length, [...perOption, noAnswer], parts);
  return {
    kind: 'choice',
    item: question.item,
    questionText: question.text,
    learners: countCell(size, answers.length),
    options: options.map((option, index) => ({
      index,
      text: option.text,
      correct: option.correct,
      feedback: option.feedback,
      learners: cells[index] ?? SUPPRESSED_CELL,
    })),
    noAnswer: cells[options.length] ?? SUPPRESSED_CELL,
  };
}
