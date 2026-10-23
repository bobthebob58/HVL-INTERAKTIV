/**
 * headingOrderRule (V-HEADING-ORDER) — headings in rich text do not skip levels (h2 → h4).
 *
 * Why: WCAG 1.3.1 (Info and Relationships) and 2.4.6: screen-reader users move through a text by its headings.
 *      A skipped level suggests a missing section and breaks the outline.
 * Spec: UD-021
 * Invariants:
 *   - Checked within each rich-text field: a heading may be at most one level deeper than the heading before it;
 *     going back up any number of levels is fine. The first heading of a field may have any level, since the
 *     field's place in the page outline is not known.
 *   - One finding per field, for its first skip.
 * Collaborators: ../richText.ts (headings), ../contentWalker.ts (authored strings).
 * Tests: apps/server/test/validation/rules/headingOrderRule.test.ts
 */
import type { RuleHit, ValidationRule } from '../rule.js';

/**
 * The first skipped level in a list of heading levels.
 * @param levels - Heading levels in document order, e.g. `[2, 4]`.
 * @returns The two levels around the first skip, or `undefined` when none is skipped.
 */
export function firstSkip(levels: readonly number[]): { from: number; to: number } | undefined {
  for (let i = 1; i < levels.length; i += 1) {
    const [from, to] = [levels[i - 1] ?? 0, levels[i] ?? 0];
    if (to > from + 1) return { from, to };
  }
  return undefined;
}

/** V-HEADING-ORDER: headings must not skip levels. */
export const headingOrderRule: ValidationRule = {
  id: 'V-HEADING-ORDER',
  requirement: 'UD-021',
  severity: 'warning',
  messages: ['V-HEADING-ORDER.skipped'],
  check(scope) {
    const hits: RuleHit[] = [];
    for (const field of scope.nodes.flatMap((node) => node.strings)) {
      const skip = firstSkip(field.rich.headings);
      if (skip) {
        hits.push({
          path: field.path,
          message: 'V-HEADING-ORDER.skipped',
          values: { from: `h${skip.from}`, to: `h${skip.to}`, next: `h${skip.from + 1}` },
        });
      }
    }
    return hits;
  },
};
