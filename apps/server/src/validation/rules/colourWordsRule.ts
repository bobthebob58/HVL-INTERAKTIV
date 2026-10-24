/**
 * colourWordsRule (V-COLOUR-WORDS) — text that points to something by its colour alone ("the red option",
 * «det grøne feltet»).
 *
 * Why: WCAG 1.4.1 (Use of Color) and 1.3.3 (Sensory Characteristics): learners who cannot tell colours apart, and
 *      screen-reader users, cannot follow such an instruction. A hint, because the phrase may be fine in context
 *      (the colour may also be named in text on screen).
 * Spec: UD-021
 * Invariants:
 *   - Every authored string is checked; one finding per field, quoting the first phrase.
 *   - A BranchingScenario choice text (`branchingQuestion.alternatives[n].text`) that is only a colour is left to
 *     V-BRANCH-COLOUR, so it is not reported twice. Every other string of a BranchingQuestion (the question, the
 *     feedback) is checked as usual, since V-BRANCH-COLOUR does not look at it.
 * Collaborators: ../colourWords.ts, ../contentWalker.ts (authored strings).
 * Tests: apps/server/test/validation/rules/colourWordsRule.test.ts
 */
import { findColourPhrase, isColourOnlyChoice } from '../colourWords.js';
import type { RuleHit, ValidationRule } from '../rule.js';

// WHY: exactly the field V-BRANCH-COLOUR checks; a node's own strings never include its sub-content's.
const CHOICE_TEXT = /(?:^|\.)branchingQuestion\.alternatives\[\d+\]\.text$/;

const isBranchChoice = (machineName: string | undefined, path: string): boolean =>
  machineName === 'H5P.BranchingQuestion' && CHOICE_TEXT.test(path);

/** V-COLOUR-WORDS: do not refer to things by colour alone. */
export const colourWordsRule: ValidationRule = {
  id: 'V-COLOUR-WORDS',
  requirement: 'UD-021',
  severity: 'hint',
  messages: ['V-COLOUR-WORDS.colourOnly'],
  check(scope) {
    const hits: RuleHit[] = [];
    for (const node of scope.nodes) {
      for (const field of node.strings) {
        const phrase = findColourPhrase(field.rich.text);
        if (phrase === undefined) continue;
        if (isBranchChoice(node.machineName, field.path) && isColourOnlyChoice(field.rich.text)) continue;
        hits.push({ path: field.path, message: 'V-COLOUR-WORDS.colourOnly', values: { phrase } });
      }
    }
    return hits;
  },
};
