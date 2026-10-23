/**
 * branchColourRule (V-BRANCH-COLOUR) — a BranchingScenario choice is not just a colour («Raud», "The green one",
 * a coloured circle).
 *
 * Why: WCAG 1.4.1 (Use of Color): a choice that only names or shows a colour relies on colour coding elsewhere
 *      (an image, a slide), which learners who cannot tell colours apart and screen-reader users cannot use.
 * Spec: UD-021
 * Invariants:
 *   - Checks the text of every alternative of every `H5P.BranchingQuestion`, at any depth.
 *   - BranchingQuestion 1.0 has no colour setting of its own, so colour coding can only show in the text.
 * Collaborators: ../colourWords.ts.
 * Tests: apps/server/test/validation/rules/branchColourRule.test.ts
 */
import { isColourOnlyChoice } from '../colourWords.js';
import { pathOf } from '../contentPath.js';
import { asArray, asString, fieldAt } from '../paramReaders.js';
import { plainTextOf } from '../richText.js';
import { nodesOf, type RuleHit, type ValidationRule } from '../rule.js';

/** V-BRANCH-COLOUR: choices need text, not only a colour. */
export const branchColourRule: ValidationRule = {
  id: 'V-BRANCH-COLOUR',
  requirement: 'UD-021',
  severity: 'warning',
  messages: ['V-BRANCH-COLOUR.colourOnly'],
  check(scope) {
    const hits: RuleHit[] = [];
    for (const node of nodesOf(scope, 'H5P.BranchingQuestion')) {
      const alternatives = asArray(fieldAt(node.params, 'branchingQuestion', 'alternatives'));
      alternatives.forEach((alternative, index) => {
        if (!isColourOnlyChoice(plainTextOf(asString(fieldAt(alternative, 'text')) ?? ''))) return;
        const path = pathOf(node.path, 'branchingQuestion', 'alternatives', index, 'text');
        hits.push({ path, message: 'V-BRANCH-COLOUR.colourOnly' });
      });
    }
    return hits;
  },
};
