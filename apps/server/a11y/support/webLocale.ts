/**
 * webLocale — the web app's own Nynorsk texts (apps/web/src/i18n/locales/nn.json), for the suites that find a control
 * by its name or wait for a message the page shows.
 *
 * Why: the suites must never assert ALU's content texts (the guide, the patterns, the mappe template), which ALU
 *      edits; the app's own locale texts are code-owned and stable, so a suite finds «Vel alle som passar» or waits
 *      for «Viser 3 av 9 mønster.» by the key, not by a copy of the words.
 * Spec: UD-030, UD-006, PROD-012
 * Invariants:
 *   - Reads the file once; an unknown key throws, so a renamed key fails the suite loudly instead of matching nothing.
 *   - `{{name}}` placeholders are filled as the web app's `t()` fills them; a pattern matches any value in their place.
 * Collaborators: ./studioViews.ts, the studio suites in ../.
 * Tests: apps/server/a11y/keyboardStudioJourneys.a11y.test.ts, apps/server/a11y/axeStudioViews.a11y.test.ts
 */
import { readFileSync } from 'node:fs';

const NN: unknown = JSON.parse(
  readFileSync(new URL('../../../web/src/i18n/locales/nn.json', import.meta.url), 'utf8'),
);

/** The template under a dotted key, e.g. `mappe.selectAll`. */
function template(key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined,
      NN,
    );
  if (typeof value !== 'string') throw new Error(`the web app's nn.json has no text ${key}`);
  return value;
}

/**
 * One of the web app's Nynorsk texts, with its placeholders filled.
 * @param key - The dotted key, e.g. `studio.catalogueCount`.
 * @param values - The placeholder values, e.g. `{ shown: 3, total: 9 }`.
 * @returns The text as the page shows it.
 * @throws Error when the key is not a text.
 */
export function webText(key: string, values: Readonly<Record<string, string | number>> = {}): string {
  return template(key).replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}

/**
 * A pattern that matches one of the web app's Nynorsk texts whatever its placeholders hold.
 * @param key - The dotted key, e.g. `mappe.wordCountWithin`.
 * @returns The pattern.
 * @throws Error when the key is not a text.
 */
export function webTextPattern(key: string): RegExp {
  const parts = template(key).split(/\{\{\w+\}\}/);
  return new RegExp(parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+?'));
}
