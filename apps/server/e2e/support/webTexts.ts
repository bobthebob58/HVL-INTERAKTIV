/**
 * webTexts — the web app's own Nynorsk texts (apps/web/src/i18n/locales/nn.json) for the studio flows: a control's
 * name or a message the page shows, filled in as the web app's `t()` fills it, or as a pattern for any value.
 *
 * Why: the S5 flows click through pages whose controls carry the app's locale texts. They must never assert ALU's
 *      content texts (the guide, the patterns, the mappe template, D-082), and a copy of the app's words in each
 *      flow would drift when a text is reworded; reading the key keeps the flow on the words the person sees.
 * Spec: NFR-004, PROD-012
 * Invariants:
 *   - The file is read once; an unknown key throws, so a renamed key fails the flow by name instead of waiting for
 *     a control that never comes.
 *   - `{{name}}` placeholders are filled as the web app fills them; in a pattern each matches any text.
 * Collaborators: apps/web/src/i18n/translate.ts (the same placeholder rule), the S5 flows in ../.
 * Tests: apps/server/e2e/patternToPublish.e2e.test.ts, apps/server/e2e/bankDuplicate.e2e.test.ts,
 *   apps/server/e2e/mappeDownloads.e2e.test.ts
 */
import { readFileSync } from 'node:fs';

const NN: unknown = JSON.parse(
  readFileSync(new URL('../../../web/src/i18n/locales/nn.json', import.meta.url), 'utf8'),
);

/** The template under a dotted key, e.g. `mappe.selectAll`. */
function template(key: string): string {
  let node: unknown = NN;
  for (const part of key.split('.')) {
    node = typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined;
  }
  if (typeof node !== 'string') throw new Error(`the web app's nn.json has no text ${key}`);
  return node;
}

/**
 * One of the web app's Nynorsk texts, with its placeholders filled.
 * @param key - The dotted key, e.g. `publish.submit`.
 * @param values - The placeholder values, e.g. `{ count: 2 }`.
 * @returns The text as the page shows it.
 * @throws Error when the key is not a text.
 */
export function webText(key: string, values: Readonly<Record<string, string | number>> = {}): string {
  return template(key).replace(/\{\{(\w+)\}\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}

/**
 * A pattern for one of the web app's Nynorsk texts, whatever its placeholders hold; not anchored, since a text often
 * follows an icon (`✓ `) in the same element.
 * @param key - The dotted key, e.g. `findings.groupError`.
 * @returns The pattern; each placeholder is a lazy group.
 * @throws Error when the key is not a text.
 */
export function webTextPattern(key: string): RegExp {
  const parts = template(key).split(/\{\{\w+\}\}/);
  return new RegExp(parts.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('(.+?)'));
}
