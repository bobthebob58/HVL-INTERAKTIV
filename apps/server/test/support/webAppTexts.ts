/**
 * webAppTexts — the web app's own Nynorsk texts (apps/web/src/i18n/locales/nn.json) for the browser suites: a
 * control's name or a message the page shows, filled in as the web app's `t()` fills it, or as a pattern for any value.
 *
 * Why: the e2e flows and the accessibility suites find controls by the words a person sees. They must never assert
 *      ALU's content texts (the guide, the patterns, the mappe template, D-082), and a copy of the app's words in each
 *      suite would drift when a text is reworded; reading the key keeps every suite on the app's own words. One reader
 *      serves both suites, so the placeholder rule is written once.
 * Spec: NFR-004, PROD-012, UD-030, UD-006
 * Invariants:
 *   - The file is read once; an unknown key throws, so a renamed key fails the suite by name instead of waiting for
 *     a control that never comes.
 *   - `{{name}}` placeholders are filled as apps/web/src/i18n/translate.ts fills them; in a pattern each matches any
 *     text, without a capture group.
 * Collaborators: apps/web/src/i18n/translate.ts (the same placeholder rule), the e2e flows in ../../e2e/ and the
 *   accessibility suites in ../../a11y/ (with ../../a11y/support/studioViews.ts and formativeNotice.ts).
 * Tests: apps/server/test/i18n/webAppTexts.test.ts; used by apps/server/e2e/patternToPublish.e2e.test.ts,
 *   apps/server/e2e/bankDuplicate.e2e.test.ts, apps/server/e2e/mappeDownloads.e2e.test.ts,
 *   apps/server/a11y/axeStudioViews.a11y.test.ts, apps/server/a11y/keyboardStudioJourneys.a11y.test.ts,
 *   apps/server/a11y/axeWebRoutes.a11y.test.ts, apps/server/a11y/keyboardJourneys.a11y.test.ts and
 *   apps/server/a11y/language.a11y.test.ts
 */
import { readFileSync } from 'node:fs';

const NN: unknown = JSON.parse(
  readFileSync(new URL('../../../web/src/i18n/locales/nn.json', import.meta.url), 'utf8'),
);

const PLACEHOLDER = /\{\{(\w+)\}\}/g;

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
 * @param values - The placeholder values, e.g. `{ shown: 3, total: 9 }`; a placeholder without one stays as written.
 * @returns The text as the page shows it.
 * @throws Error when the key is not a text.
 */
export function webText(key: string, values: Readonly<Record<string, string | number>> = {}): string {
  return template(key).replace(PLACEHOLDER, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}

/**
 * A pattern for one of the web app's Nynorsk texts, whatever its placeholders hold; not anchored, since a text often
 * follows an icon (`✓ `) in the same element, and without capture groups, so patterns can be joined with `|`.
 * @param key - The dotted key, e.g. `mappe.wordCountWithin`.
 * @returns The pattern; each placeholder matches any text, lazily.
 * @throws Error when the key is not a text.
 */
export function webTextPattern(key: string): RegExp {
  const parts = template(key).split(/\{\{\w+\}\}/);
  return new RegExp(parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+?'));
}
