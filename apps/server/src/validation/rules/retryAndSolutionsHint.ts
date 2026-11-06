/**
 * retryAndSolutionsHint (PED-H07) — "Retry" and "Show solution" stay on, since the activities are formative.
 *
 * Why: practice testing works through repeated retrieval with feedback (Dunlosky et al. 2013); spec 04 §3 asks
 *      for unlimited retries and *Show solution* on. Turning them off makes a formative task feel like a test.
 * Spec: PED-020, PROD-009
 * Invariants:
 *   - Shape-based, for every node: `behaviour.enableRetry` / `behaviour.enableSolutionsButton` set to `false`
 *     (MultiChoice, Blanks, DragText, TrueFalse, SingleChoiceSet, InteractiveBook …), the container overrides
 *     `override.retryButton` / `override.showSolutionButton` set to `"off"` (QuestionSet, InteractiveVideo,
 *     CoursePresentation), QuestionSet's `endGame.showRetryButton` / `endGame.showSolutionButton` and
 *     CoursePresentation's `override.summarySlideRetryButton` / `override.summarySlideSolutionButton` set to
 *     `false`. A missing setting is the library's default (on), so it is fine.
 *   - A child's switched-off `behaviour` setting is not reported when its container forces it on: QuestionSet,
 *     CoursePresentation and InteractiveVideo overwrite the behaviour of their direct tasks (questions, slide
 *     elements, interactions) with `override.* === "on"` (../containerOverrides.ts).
 *   - QuestionSet's `endGame.showRetryButton: false` is not reported while the set forces its questions' retry on
 *     (`override.retryButton: "on"`): every question keeps its own «Prøv igjen», which is the `enableRetry` spec 04
 *     names. WHY: the set's own button fails in QuestionSet 1.21 when a page holds several sets, so a pattern turns
 *     it off on purpose (D-115, Q20), and a hint would send the author back to a button that breaks.
 *   - One hint per switched-off setting, at its path.
 * Collaborators: ../paramReaders.ts, ../containerOverrides.ts.
 * Tests: apps/server/test/validation/rules/retryAndSolutionsHint.test.ts
 */
import { forcedBehaviours, type ForcedBehaviour } from '../containerOverrides.js';
import { pathOf } from '../contentPath.js';
import { fieldAt } from '../paramReaders.js';
import type { RuleHit, ValidationRule } from '../rule.js';

type Switch = readonly [
  group: string,
  field: string,
  off: boolean | string,
  kind: 'retryOff' | 'solutionsOff',
];

const SWITCHES: readonly Switch[] = [
  ['behaviour', 'enableRetry', false, 'retryOff'],
  ['behaviour', 'enableSolutionsButton', false, 'solutionsOff'],
  ['override', 'retryButton', 'off', 'retryOff'],
  ['override', 'showSolutionButton', 'off', 'solutionsOff'],
  ['override', 'summarySlideRetryButton', false, 'retryOff'],
  ['override', 'summarySlideSolutionButton', false, 'solutionsOff'],
  ['endGame', 'showRetryButton', false, 'retryOff'],
  ['endGame', 'showSolutionButton', false, 'solutionsOff'],
];

/** PED-H07: keep retry and solutions on. */
export const retryAndSolutionsHint: ValidationRule = {
  id: 'PED-H07',
  requirement: 'PED-020',
  severity: 'hint',
  messages: ['PED-H07.retryOff', 'PED-H07.solutionsOff'],
  check(scope) {
    const forced = forcedBehaviours(scope.nodes);
    const hits: RuleHit[] = [];
    for (const node of scope.nodes) {
      for (const [group, field, off, kind] of SWITCHES) {
        if (fieldAt(node.params, group, field) !== off) continue;
        if (group === 'behaviour' && forced.get(node.path)?.[field as keyof ForcedBehaviour] === true)
          continue;
        if (field === 'showRetryButton' && fieldAt(node.params, 'override', 'retryButton') === 'on') continue;
        hits.push({ path: pathOf(node.path, group, field), message: `PED-H07.${kind}` });
      }
    }
    return hits;
  },
};
