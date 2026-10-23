/**
 * questionSetSizeHint (PED-H04) — a QuestionSet shows more than `maxQuestionsPerSet` (15) questions.
 *
 * Why: several focused sets of about ten questions keep each practice session short and its purpose clear
 *      (segmenting, Mayer 2009); spec 04 §5.
 * Spec: PED-020
 * Invariants:
 *   - Counts what a learner meets: the number of questions, or the pool size when the set draws a random pool
 *     (`poolSize`) smaller than that.
 *   - Applies to every `H5P.QuestionSet`, also nested ones.
 * Collaborators: ../hintThresholds.ts.
 * Tests: apps/server/test/validation/rules/questionSetSizeHint.test.ts
 */
import { pathOf } from '../contentPath.js';
import { thresholdOf } from '../hintThresholds.js';
import { asArray, asNumber, fieldAt } from '../paramReaders.js';
import { nodesOf, type RuleHit, type ValidationRule } from '../rule.js';

/** PED-H04: keep question sets short. */
export const questionSetSizeHint: ValidationRule = {
  id: 'PED-H04',
  requirement: 'PED-020',
  severity: 'warning',
  messages: ['PED-H04.tooMany'],
  check(scope) {
    // PEDAGOGY: 15 by default; sets of about 10 questions (Mayer 2009, segmenting principle).
    const max = thresholdOf(scope.context, 'maxQuestionsPerSet');
    const hits: RuleHit[] = [];
    for (const node of nodesOf(scope, 'H5P.QuestionSet')) {
      const questions = asArray(fieldAt(node.params, 'questions')).length;
      const pool = asNumber(fieldAt(node.params, 'poolSize'));
      const count = pool !== undefined && pool > 0 ? Math.min(questions, pool) : questions;
      if (count > max) {
        hits.push({
          path: pathOf(node.path, 'questions'),
          message: 'PED-H04.tooMany',
          values: { count, max },
        });
      }
    }
    return hits;
  },
};
