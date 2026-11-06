/**
 * learnerAnswers — the per-learner facts every insight aggregate starts from: each learner's first and latest answer
 * to each question, whether an answer is correct, and the median of a list.
 *
 * Why: INS-002 compares the first and the latest attempt per question, INS-003 groups the first answers, and INS-005
 *      counts who answered at all. H5P marks no attempts (D-115), so an item's "first attempt" is the learner's
 *      first stored `answered` for it in the view, and the "latest" their last one, by the stored order.
 * Spec: INS-002, INS-003, INS-005
 * Invariants:
 *   - Only `answered` statements are answers; the item is the `subContentId`, or null for the activity itself (a
 *     stored root `answered` is a single question's root result, D-115).
 *   - Statements arrive in stored order (../data/insightStatements.ts), so the first seen is the first answer.
 *   - An answer is correct when `success` is true, or, where H5P sends no `success`, when it has full marks
 *     (`scoreRaw` equals a positive `scoreMax`); with neither it cannot be judged (D-115).
 *   - PRIVACY: learners are the reader's numbers; nothing here leaves the aggregators except through suppressed
 *     cells (INS-006).
 * Collaborators: ../data/insightStatements.ts, ./itemDifficulty.ts, ./choiceDistribution.ts,
 *   ./gapMisconceptions.ts, ./videoEngagement.ts, ./participation.ts.
 * Tests: apps/server/test/insight/insightStatements.test.ts
 */
import type { InsightStatement } from '../data/insightStatements.js';

/** One learner's first and latest answer to one question. */
export interface LearnerItemAnswers {
  readonly first: InsightStatement;
  readonly latest: InsightStatement;
}

/** Per question (null for the activity itself), per learner, their first and latest answer. */
export type AnswersByItem = ReadonlyMap<string | null, ReadonlyMap<number, LearnerItemAnswers>>;

/**
 * Groups the answers by question and learner.
 * @param statements - The view's statements in stored order.
 * @returns Each question's learners with their first and latest answer, questions in order of first answer.
 * @spec INS-002
 */
export function answersByItem(statements: readonly InsightStatement[]): AnswersByItem {
  const items = new Map<string | null, Map<number, LearnerItemAnswers>>();
  for (const statement of statements) {
    if (statement.verb !== 'answered') continue;
    const learners = items.get(statement.item) ?? new Map<number, LearnerItemAnswers>();
    items.set(statement.item, learners);
    const known = learners.get(statement.learner);
    learners.set(statement.learner, { first: known?.first ?? statement, latest: statement });
  }
  return items;
}

/**
 * Whether an answer is correct.
 * @param answer - A stored `answered`.
 * @returns True or false, or undefined when it carries neither `success` nor a positive maximum.
 * @spec INS-002
 */
export function isCorrectAnswer(
  answer: Pick<InsightStatement, 'success' | 'scoreRaw' | 'scoreMax'>,
): boolean | undefined {
  if (answer.success !== null) return answer.success;
  if (answer.scoreMax === null || answer.scoreMax <= 0 || answer.scoreRaw === null) return undefined;
  // WHY: Blanks and DragText inside containers send no `success`; full marks is H5P's own "correct" (D-115).
  return answer.scoreRaw >= answer.scoreMax;
}

/**
 * The median of a list.
 * @param values - Numbers.
 * @returns The middle value, the mean of the two middle values for an even count, or NaN for an empty list.
 */
export function medianOf(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? Number.NaN)
    : ((sorted[middle - 1] ?? Number.NaN) + (sorted[middle] ?? Number.NaN)) / 2;
}

/**
 * The distinct learners of a list of statements.
 * @param statements - Statements.
 * @returns The learners' numbers.
 */
export const learnersOf = (statements: readonly InsightStatement[]): ReadonlySet<number> =>
  new Set(statements.map(({ learner }) => learner));
