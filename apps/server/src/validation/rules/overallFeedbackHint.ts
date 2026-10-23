/**
 * overallFeedbackHint (PED-H11) — overall feedback says why, not only «Riktig» / «Feil» / "Correct" / "Wrong".
 *
 * Why: feedback works when it tells learners where they are and what to do next, not just whether they were
 *      right (Hattie & Timperley 2007, "The power of feedback").
 * Spec: PED-020
 * Invariants:
 *   - Shape-based, for every node: each `overallFeedback[n].feedback` (also `endGame.overallFeedback` in
 *     QuestionSet), and TrueFalse's `behaviour.feedbackOnCorrect`.
 *   - Blank feedback is not reported here (H5P shows its score text instead); only a bare verdict is
 *     (../feedbackText.ts). Wrong-answer explanations, including TrueFalse's `feedbackOnWrong`, are PED-H05's
 *     concern, so a verdict there is reported once, by PED-H05.
 * Collaborators: ../feedbackText.ts, ../contentWalker.ts (authored strings).
 * Tests: apps/server/test/validation/rules/overallFeedbackHint.test.ts
 */
import { isBareVerdict } from '../feedbackText.js';
import type { RuleHit, ValidationRule } from '../rule.js';

const OVERALL_FEEDBACK = /(?:^|\.)overallFeedback\[\d+\]\.feedback$/;
const TRUE_FALSE_FEEDBACK = /(?:^|\.)behaviour\.feedbackOnCorrect$/;

/** PED-H11: say why in overall feedback. */
export const overallFeedbackHint: ValidationRule = {
  id: 'PED-H11',
  requirement: 'PED-020',
  severity: 'hint',
  messages: ['PED-H11.verdictOnly'],
  check(scope) {
    const hits: RuleHit[] = [];
    for (const node of scope.nodes) {
      for (const field of node.strings) {
        const relevant =
          OVERALL_FEEDBACK.test(field.path) ||
          (node.machineName === 'H5P.TrueFalse' && TRUE_FALSE_FEEDBACK.test(field.path));
        if (relevant && isBareVerdict(field.value))
          hits.push({ path: field.path, message: 'PED-H11.verdictOnly' });
      }
    }
    return hits;
  },
};
