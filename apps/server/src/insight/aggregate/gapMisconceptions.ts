/**
 * gapMisconceptions — INS-003 for a Blanks or DragText task: per gap, how many learners' first answer was right, the
 * most frequent wrong answers (normalised, at most five, each given by at least k learners), the other wrong answers
 * and the empty gaps.
 *
 * Why: the wrong words learners write or drop show their misconceptions; INS-003 lists the most frequent ones per
 *      gap, "normalised (trimmed, case-folded) and limited to the top 5", and shows a free-text answer only if at
 *      least k distinct learners gave it, so a rare and identifiable answer is never shown.
 * Spec: INS-003, INS-006
 * Invariants:
 *   - PRIVACY: a wrong answer's text is shown only when at least k distinct learners gave it as their first answer
 *     to that gap; every other wrong answer is only counted, in «other wrong answers» (INS-003, INS-006).
 *   - PEDAGOGY: each learner's first answer is counted, as for choices (spec 04 §3, "Using pre-work in class":
 *     Novak, Patterson, Gavrin & Christian 1999).
 *   - The response's gaps are split on `[,]` in the order the library numbers them (../content/gapSolutions.ts); a
 *     missing gap, and every gap of a response that was not stored (D-115's 1 000-character cap), counts as empty.
 *   - A gap answer is right when it equals one of the accepted answers after normalising (case kept for a
 *     case-sensitive Blanks); answers H5P accepts for a small spelling error (Blanks' `acceptSpellingErrors`) are
 *     counted as wrong here, an accepted limitation.
 *   - PRIVACY: a listed answer's count is always shown, never hidden as a complement: the public rule says it holds k
 *     or more, and a hidden cell with that bound let a reader pin the other hidden counts (found by an exhaustive
 *     check in the privacy review of 2026-11-04). Per gap, right, «other wrong» and «empty» form one additive group
 *     whose total is the question's learners less the listed answers (../suppression/additiveGroupCells.ts). Ties
 *     among listed answers are in alphabetical order.
 *   - PRIVACY: in a task with one gap, INS-002's share correct times the learners tells how many got the gap right
 *     (full marks), so «right» and the rest are protected as two groups, each with its own total (INS-006).
 * Collaborators: ./learnerAnswers.ts, ../content/gapSolutions.ts, ../suppression/additiveGroupCells.ts,
 *   ../buildInsightReport.ts.
 * Tests: apps/server/test/insight/thirtyLearners.test.ts, apps/server/test/insight/misconceptions.test.ts,
 *   apps/server/test/insight/additiveGroupExhaustive.test.ts
 */
import { XAPI_GAP_SEPARATOR } from '@hvl-interaktiv/api-contract';
import type { MinimumGroupSize } from '../../privacy/minimumGroupSize.js';
import { normaliseGapAnswer, type GapSolution } from '../content/gapSolutions.js';
import type { GapInsight, GapMisconception } from '../insightReport.js';
import { partitionedGroupCells } from '../suppression/additiveGroupCells.js';
import { countCell, SUPPRESSED_CELL } from '../suppression/insightCells.js';
import type { LearnerItemAnswers } from './learnerAnswers.js';

/** How many wrong answers per gap are listed (INS-003). */
export const LISTED_WRONG_ANSWERS = 5;

/** The tally of one gap's first answers. */
interface GapTally {
  correct: number;
  empty: number;
  readonly wrong: Map<string, number>;
}

function tallyGap(gap: GapSolution, caseSensitive: boolean, given: readonly string[]): GapTally {
  const accepted = new Set(gap.answers.map((answer) => normaliseGapAnswer(answer, caseSensitive)));
  const tally: GapTally = { correct: 0, empty: 0, wrong: new Map() };
  for (const raw of given) {
    const folded = normaliseGapAnswer(raw);
    if (folded === '') tally.empty += 1;
    else if (accepted.has(normaliseGapAnswer(raw, caseSensitive))) tally.correct += 1;
    else tally.wrong.set(folded, (tally.wrong.get(folded) ?? 0) + 1);
  }
  return tally;
}

function gapInsight(
  size: MinimumGroupSize,
  index: number,
  gap: GapSolution,
  tally: GapTally,
  group: { readonly learners: number; readonly onlyGap: boolean },
): GapInsight {
  // PRIVACY: only an answer that k or more learners gave may be listed with its text (INS-003).
  const listed = [...tally.wrong]
    .filter(([, count]) => count >= size.k)
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b, 'nb'))
    .slice(0, LISTED_WRONG_ANSWERS);
  const wrong = [...tally.wrong.values()].reduce((sum, count) => sum + count, 0);
  const listedTotal = listed.reduce((sum, [, count]) => sum + count, 0);
  // PRIVACY: a listed answer has k or more learners, which the public rule tells, so hiding one as a complement
  // would leave a hidden cell with a known lower bound that can pin the others (INS-006). Listed answers are always
  // shown, and the rest of the gap is one group whose total is the learners less the listed answers.
  const rest = [tally.correct, wrong - listedTotal, tally.empty];
  // PRIVACY: INS-002 reveals the right answers of a task's only gap, so «right» is a part of its own (INS-006).
  const parts = group.onlyGap ? [[0], [1, 2]] : [[0, 1, 2]];
  const cells = partitionedGroupCells(size, group.learners - listedTotal, rest, parts);
  return {
    index,
    correctAnswers: gap.answers,
    correct: cells[0] ?? SUPPRESSED_CELL,
    wrongAnswers: listed.map(([answer, count]) => ({ answer, learners: countCell(size, count) })),
    otherWrong: cells[1] ?? SUPPRESSED_CELL,
    empty: cells[2] ?? SUPPRESSED_CELL,
  };
}

/**
 * INS-003 for one gap task.
 * @param size - The minimum group size.
 * @param question - The question's ID and text.
 * @param shape - Its gaps from the parameters, and whether it is case-sensitive.
 * @param answers - Its learners with their first and latest answer.
 * @returns The suppressed per-gap view of the first answers.
 * @spec INS-003
 */
export function gapMisconceptions(
  size: MinimumGroupSize,
  question: { readonly item: string | null; readonly text: string },
  shape: { readonly gaps: readonly GapSolution[]; readonly caseSensitive: boolean },
  answers: readonly LearnerItemAnswers[],
): GapMisconception {
  const responses = answers.map(({ first }) => (first.response ?? '').split(XAPI_GAP_SEPARATOR));
  return {
    kind: 'gaps',
    item: question.item,
    questionText: question.text,
    learners: countCell(size, answers.length),
    gaps: shape.gaps.map((gap, index) => {
      const given = responses.map((parts) => parts[index] ?? '');
      const group = { learners: answers.length, onlyGap: shape.gaps.length === 1 };
      return gapInsight(size, index, gap, tallyGap(gap, shape.caseSensitive, given), group);
    }),
  };
}
