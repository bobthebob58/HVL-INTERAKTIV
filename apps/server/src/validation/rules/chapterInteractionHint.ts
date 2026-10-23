/**
 * chapterInteractionHint (PED-H10) — an InteractiveBook chapter has more than
 * `maxChapterWordsWithoutInteraction` (1 500) words and no learner task.
 *
 * Why: a check per chapter turns reading into retrieval practice, which strengthens long-term retention
 *      (Roediger & Karpicke 2006).
 * Spec: PED-020
 * Invariants:
 *   - A chapter is one item of `chapters` (an H5P.Column). Its words are those of every reading-text node inside
 *     it, at any depth (also in an Accordion); its tasks are learner tasks at any depth (../contentKinds.ts).
 *   - One hint per chapter, at `chapters[n]`.
 * Collaborators: ../contentWalker.ts (`nodesWithin`), ../contentKinds.ts, ../richText.ts, ../hintThresholds.ts.
 * Tests: apps/server/test/validation/rules/chapterInteractionHint.test.ts
 */
import { isLearnerTask, READING_TEXT_LIBRARIES } from '../contentKinds.js';
import { pathOf } from '../contentPath.js';
import { nodesWithin } from '../contentWalker.js';
import { thresholdOf } from '../hintThresholds.js';
import { asArray, asString, fieldAt } from '../paramReaders.js';
import { countWords, plainTextOf } from '../richText.js';
import { nodesOf, type RuleHit, type ValidationRule } from '../rule.js';

/** PED-H10: add a check to long chapters. */
export const chapterInteractionHint: ValidationRule = {
  id: 'PED-H10',
  requirement: 'PED-020',
  severity: 'hint',
  messages: ['PED-H10.tooManyWords'],
  check(scope) {
    // PEDAGOGY: 1 500 words by default; a check per chapter (Roediger & Karpicke 2006).
    const max = thresholdOf(scope.context, 'maxChapterWordsWithoutInteraction');
    const hits: RuleHit[] = [];
    for (const book of nodesOf(scope, 'H5P.InteractiveBook')) {
      asArray(fieldAt(book.params, 'chapters')).forEach((_, index) => {
        const chapterPath = pathOf(book.path, 'chapters', index);
        const inside = nodesWithin(scope.nodes, pathOf(chapterPath, 'params'));
        if (inside.some((node) => isLearnerTask(node.machineName))) return;
        const count = inside
          .filter((node) => node.machineName !== undefined && READING_TEXT_LIBRARIES.has(node.machineName))
          .reduce(
            (sum, node) => sum + countWords(plainTextOf(asString(fieldAt(node.params, 'text')) ?? '')),
            0,
          );
        if (count > max)
          hits.push({ path: chapterPath, message: 'PED-H10.tooManyWords', values: { count, max } });
      });
    }
    return hits;
  },
};
