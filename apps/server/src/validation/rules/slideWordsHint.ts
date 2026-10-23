/**
 * slideWordsHint (PED-H09) — a CoursePresentation slide has more than `maxSlideWords` (150) words of text.
 *
 * Why: one concept per slide, with words that support rather than duplicate the speaker, keeps extraneous load
 *      down (Mayer 2009, coherence and segmenting principles).
 * Spec: PED-020
 * Invariants:
 *   - Counts the words of the slide's reading-text elements (H5P.AdvancedText, H5P.Text, H5P.ContinuousText;
 *     ../contentKinds.ts). Questions, images and the elements' hidden "solution" texts do not count.
 *   - One hint per slide, at `presentation.slides[n]`.
 * Collaborators: ../contentKinds.ts, ../richText.ts, ../hintThresholds.ts.
 * Tests: apps/server/test/validation/rules/slideWordsHint.test.ts
 */
import { machineNameOf, READING_TEXT_LIBRARIES } from '../contentKinds.js';
import { pathOf } from '../contentPath.js';
import { thresholdOf } from '../hintThresholds.js';
import { asArray, asString, fieldAt } from '../paramReaders.js';
import { countWords, plainTextOf } from '../richText.js';
import { nodesOf, type RuleHit, type ValidationRule } from '../rule.js';

const wordsOfElement = (element: unknown): number => {
  const machineName = machineNameOf(asString(fieldAt(element, 'action', 'library')) ?? '');
  if (machineName === undefined || !READING_TEXT_LIBRARIES.has(machineName)) return 0;
  return countWords(plainTextOf(asString(fieldAt(element, 'action', 'params', 'text')) ?? ''));
};

/** PED-H09: one concept per slide. */
export const slideWordsHint: ValidationRule = {
  id: 'PED-H09',
  requirement: 'PED-020',
  severity: 'hint',
  messages: ['PED-H09.tooManyWords'],
  check(scope) {
    // PEDAGOGY: 150 words by default; one concept per slide (Mayer 2009).
    const max = thresholdOf(scope.context, 'maxSlideWords');
    const hits: RuleHit[] = [];
    for (const node of nodesOf(scope, 'H5P.CoursePresentation')) {
      asArray(fieldAt(node.params, 'presentation', 'slides')).forEach((slide, index) => {
        const count = asArray(fieldAt(slide, 'elements')).reduce<number>(
          (sum, e) => sum + wordsOfElement(e),
          0,
        );
        if (count <= max) return;
        const path = pathOf(node.path, 'presentation', 'slides', index);
        hits.push({ path, message: 'PED-H09.tooManyWords', values: { count, max } });
      });
    }
    return hits;
  },
};
