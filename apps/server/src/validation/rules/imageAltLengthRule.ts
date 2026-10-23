/**
 * imageAltLengthRule (V-IMG-ALT-LENGTH) — an alternative text longer than 250 characters should become a long
 * description in the text.
 *
 * Why: screen readers read alt text in one go, with no way to pause or navigate it. A complex image (a diagram,
 *      a chart) is better served by a short alt text and a longer description in the surrounding text (WCAG 1.1.1,
 *      W3C WAI image tutorial "complex images").
 * Spec: UD-021
 * Invariants:
 *   - Same images as V-IMG-ALT (../imageAltSources.ts); decorative images are skipped.
 *   - Length is counted in characters (code points) of the plain text.
 * Collaborators: ../imageAltSources.ts, ../richText.ts.
 * Tests: apps/server/test/validation/rules/imageAltLengthRule.test.ts
 */
import { altSourcesOf } from '../imageAltSources.js';
import { plainTextOf } from '../richText.js';
import type { RuleHit, ValidationRule } from '../rule.js';

/** The longest alt text that does not get a warning (UD-021). */
export const MAX_ALT_LENGTH = 250;

/** V-IMG-ALT-LENGTH: long alt texts belong in the text instead. */
export const imageAltLengthRule: ValidationRule = {
  id: 'V-IMG-ALT-LENGTH',
  requirement: 'UD-021',
  severity: 'warning',
  messages: ['V-IMG-ALT-LENGTH.tooLong'],
  check(scope) {
    const hits: RuleHit[] = [];
    for (const source of scope.nodes.flatMap(altSourcesOf)) {
      const length = [...plainTextOf(source.alt ?? '')].length;
      if (!source.decorative && length > MAX_ALT_LENGTH) {
        hits.push({
          path: source.path,
          message: 'V-IMG-ALT-LENGTH.tooLong',
          values: { length, max: MAX_ALT_LENGTH },
        });
      }
    }
    return hits;
  },
};
