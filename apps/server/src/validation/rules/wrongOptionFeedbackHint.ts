/**
 * wrongOptionFeedbackHint (PED-H05) — every wrong option says why it is wrong when a learner chooses it.
 *
 * Why: feedback that explains an error helps far more than a mark (Shute 2008, "Focus on formative feedback");
 *      the wrong-option explanation is where a misconception gets corrected.
 * Spec: PED-020
 * Invariants:
 *   - MultiChoice (on its own, or inside QuestionSet, InteractiveVideo, CoursePresentation, Column …): each
 *     answer with `correct: false` needs a `tipsAndFeedback.chosenFeedback` that explains, not one that is blank
 *     or only a verdict («Feil»). TrueFalse: the equivalent is `behaviour.feedbackOnWrong`.
 *   - Limitation: SingleChoiceSet 1.11 has no per-answer feedback field, so it has nothing to check.
 * Collaborators: ../feedbackText.ts.
 * Tests: apps/server/test/validation/rules/wrongOptionFeedbackHint.test.ts
 */
import { pathOf } from '../contentPath.js';
import { isBareVerdict, isBlankText } from '../feedbackText.js';
import { asArray, asString, fieldAt } from '../paramReaders.js';
import { nodesOf, type RuleHit, type ValidationRule } from '../rule.js';

const explains = (feedback: unknown): boolean => {
  const text = asString(feedback);
  return !isBlankText(text) && !isBareVerdict(text);
};

/** PED-H05: explain why a wrong option is wrong. */
export const wrongOptionFeedbackHint: ValidationRule = {
  id: 'PED-H05',
  requirement: 'PED-020',
  severity: 'warning',
  messages: ['PED-H05.noExplanation'],
  check(scope) {
    const hits: RuleHit[] = [];
    for (const node of nodesOf(scope, 'H5P.MultiChoice')) {
      asArray(fieldAt(node.params, 'answers')).forEach((answer, index) => {
        if (fieldAt(answer, 'correct') === true) return;
        if (explains(fieldAt(answer, 'tipsAndFeedback', 'chosenFeedback'))) return;
        const path = pathOf(node.path, 'answers', index, 'tipsAndFeedback', 'chosenFeedback');
        hits.push({ path, message: 'PED-H05.noExplanation' });
      });
    }
    for (const node of nodesOf(scope, 'H5P.TrueFalse')) {
      if (explains(fieldAt(node.params, 'behaviour', 'feedbackOnWrong'))) continue;
      hits.push({
        path: pathOf(node.path, 'behaviour', 'feedbackOnWrong'),
        message: 'PED-H05.noExplanation',
      });
    }
    return hits;
  },
};
