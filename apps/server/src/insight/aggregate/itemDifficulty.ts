/**
 * itemDifficulty — INS-002's list: for each question, the learners who answered it and the share correct on their
 * first and on their latest answer, hardest first, with the question text from the activity's parameters.
 *
 * Why: a teacher preparing a seminar wants to see at a glance which questions most learners got wrong at first, and
 *      whether they got there in the end (INS-002). The question text is shown next to each item so the teacher does
 *      not need to open the editor.
 * Spec: INS-002, INS-006, PROD-013
 * Invariants:
 *   - The items are every question of the current parameters (./../content/questionCatalogue.ts), then any other
 *     question answered in the view (a question of an older version), with no text.
 *   - PRIVACY: the learner count is suppressed from 1 to k − 1; each share is suppressed when its learners are
 *     (INS-006); D-095's two-sided rule is not applied, so 0 % and 100 % over k or more learners are shown (D-106).
 *   - A share is null when none of the question's answers can be judged (no `success`, no positive maximum).
 *   - Sorted by the shown first-answer share, lowest first, then the shown latest share, then document order; items
 *     whose first share is suppressed or null follow in document order, so the order reveals no hidden value.
 * Collaborators: ./learnerAnswers.ts, ../content/questionCatalogue.ts, ../suppression/insightCells.ts,
 *   ../buildInsightReport.ts.
 * Tests: apps/server/test/insight/thirtyLearners.test.ts, apps/server/test/insight/videoLearners.test.ts
 */
import type { InsightRateCell } from '@hvl-interaktiv/api-contract';
import type { MinimumGroupSize } from '../../privacy/minimumGroupSize.js';
import type { CatalogueQuestion } from '../content/questionCatalogue.js';
import type { ItemDifficultyInsight } from '../insightReport.js';
import { countCell, rateCell, shownValue } from '../suppression/insightCells.js';
import { isCorrectAnswer, type AnswersByItem, type LearnerItemAnswers } from './learnerAnswers.js';

/** The share correct of one kind of answer, or null when none can be judged. */
function shareCorrect(
  size: MinimumGroupSize,
  answers: readonly LearnerItemAnswers[],
  which: 'first' | 'latest',
): InsightRateCell | null {
  const verdicts = answers.map((answer) => isCorrectAnswer(answer[which]));
  const judged = verdicts.filter((verdict) => verdict !== undefined);
  if (answers.length > 0 && judged.length === 0) return null;
  const correct = judged.filter(Boolean).length;
  // PRIVACY: the judged answers are at most the question's learners, so a share is never shown for fewer than k.
  return rateCell(size, judged.length === 0 ? Number.NaN : correct / judged.length, judged.length);
}

/** A sort key from a shown share only; anything hidden or unknown sorts after every shown share. */
const shownShare = (cell: InsightRateCell | null): number =>
  cell === null ? Number.POSITIVE_INFINITY : (shownValue(cell) ?? Number.POSITIVE_INFINITY);

/**
 * INS-002's items.
 * @param size - The minimum group size.
 * @param questions - The activity's questions in document order.
 * @param answers - Each question's learners with their first and latest answer.
 * @returns One entry per question, hardest first.
 * @spec INS-002
 */
export function itemDifficultyInsights(
  size: MinimumGroupSize,
  questions: readonly CatalogueQuestion[],
  answers: AnswersByItem,
): ItemDifficultyInsight[] {
  const known = new Set(questions.map(({ item }) => item));
  const older = [...answers.keys()].filter((item) => !known.has(item));
  const rows = [
    ...questions.map(({ item, library, text }) => ({ item, library, questionText: text })),
    ...older.map((item) => ({ item, library: null, questionText: null })),
  ].map((question, order) => {
    const learners = [...(answers.get(question.item)?.values() ?? [])];
    const insight: ItemDifficultyInsight = {
      ...question,
      learners: countCell(size, learners.length),
      firstCorrect: shareCorrect(size, learners, 'first'),
      latestCorrect: shareCorrect(size, learners, 'latest'),
    };
    return { insight, order };
  });
  // PRIVACY: the order uses shown values only, so a hidden share cannot be inferred from an item's place (INS-006).
  rows.sort(
    (a, b) =>
      shownShare(a.insight.firstCorrect) - shownShare(b.insight.firstCorrect) ||
      shownShare(a.insight.latestCorrect) - shownShare(b.insight.latestCorrect) ||
      a.order - b.order,
  );
  return rows.map(({ insight }) => insight);
}
