/**
 * headingOrderRule (V-HEADING-ORDER) — headings in rich text do not skip levels (h2 → h4).
 *
 * Why: WCAG 1.3.1 (Info and Relationships) and 2.4.6: screen-reader users move through a text by its headings.
 *      A skipped level suggests a missing section and breaks the outline.
 * Spec: UD-021
 * Invariants:
 *   - Checked within each rich-text field: a heading may be at most one level deeper than the heading before it;
 *     going back up any number of levels is fine.
 *   - H5P.Column (and so every InteractiveBook chapter) shows its items one after another in one outline, so the
 *     texts of its direct reading-text items (AdvancedText, Text, ContinuousText) are checked as one sequence: the
 *     first heading of such a text follows the last heading of the texts above it. Other items add no headings.
 *   - Elsewhere the first heading of a field may have any level, since the field's place in the page outline is
 *     not known.
 *   - One finding per field, for its first skip, at the field where the skip is.
 * Collaborators: ../richText.ts (headings), ../contentWalker.ts (authored strings), ../contentKinds.ts.
 * Tests: apps/server/test/validation/rules/headingOrderRule.test.ts
 */
import { READING_TEXT_LIBRARIES } from '../contentKinds.js';
import { pathOf } from '../contentPath.js';
import { asArray, fieldAt } from '../paramReaders.js';
import { nodesOf, type RuleHit, type RuleScope, type ValidationRule } from '../rule.js';

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

/**
 * The last heading level above each reading text in a Column.
 * @param scope - The rule's scope.
 * @returns Per text field path, the level of the last heading in the Column's texts above it (if any).
 */
function levelsAbove(scope: RuleScope): ReadonlyMap<string, number> {
  const byPath = new Map(scope.nodes.map((node) => [node.path, node]));
  const above = new Map<string, number>();
  for (const column of nodesOf(scope, 'H5P.Column')) {
    let last: number | undefined;
    asArray(fieldAt(column.params, 'content')).forEach((_, index) => {
      const item = byPath.get(pathOf(column.path, 'content', index, 'content', 'params'));
      if (!item?.machineName || !READING_TEXT_LIBRARIES.has(item.machineName)) return;
      const text = item.strings.find((field) => field.path === pathOf(item.path, 'text'));
      if (!text) return;
      if (last !== undefined) above.set(text.path, last);
      last = text.rich.headings.at(-1) ?? last;
    });
  }
  return above;
}

/** V-HEADING-ORDER: headings must not skip levels. */
export const headingOrderRule: ValidationRule = {
  id: 'V-HEADING-ORDER',
  requirement: 'UD-021',
  severity: 'warning',
  messages: ['V-HEADING-ORDER.skipped'],
  check(scope) {
    const above = levelsAbove(scope);
    const hits: RuleHit[] = [];
    for (const field of scope.nodes.flatMap((node) => node.strings)) {
      const before = above.get(field.path);
      const skip = firstSkip(before === undefined ? field.rich.headings : [before, ...field.rich.headings]);
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
