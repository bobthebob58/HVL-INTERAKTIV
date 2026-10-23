/**
 * tableHeadersRule (V-TABLE-HEADERS) — tables in rich text have header cells (`<th>`) for a row or a column.
 *
 * Why: WCAG 1.3.1 (Info and Relationships): without header cells a screen reader reads a table as a stream of
 *      values, and the learner cannot tell which column or row a value belongs to.
 * Spec: UD-021
 * Invariants:
 *   - Every authored rich-text string is checked (H5P.AdvancedText and H5P.Table, and any other text field that
 *     contains a table, such as an InteractiveBook cover).
 *   - One finding per text field, however many tables in it lack headers.
 * Collaborators: ../richText.ts (tables), ../contentWalker.ts (authored strings).
 * Tests: apps/server/test/validation/rules/tableHeadersRule.test.ts
 */
import type { RuleHit, ValidationRule } from '../rule.js';

/** V-TABLE-HEADERS: tables need header cells. */
export const tableHeadersRule: ValidationRule = {
  id: 'V-TABLE-HEADERS',
  requirement: 'UD-021',
  severity: 'warning',
  messages: ['V-TABLE-HEADERS.missing'],
  check(scope) {
    return scope.nodes
      .flatMap((node) => node.strings)
      .filter((field) => field.rich.tables.some((table) => !table.hasHeaderCell))
      .map((field): RuleHit => ({ path: field.path, message: 'V-TABLE-HEADERS.missing' }));
  },
};
