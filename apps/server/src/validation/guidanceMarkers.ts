/**
 * guidanceMarkers — finds the pattern guidance `⟦…⟧` an activity still holds: every string of its parameters, label
 * groups included, and the titles of the activity and of each sub-content, read as plain text.
 *
 * Why: an activity created from a pattern holds guidance marked `⟦…⟧` where the author's own content goes (D-086).
 *      Guidance published to students by mistake is a real defect, so V-PLACEHOLDER reports each marked field. The
 *      pattern also sets button labels and messages (UI, l10n, texts …), which the shared walker skips as not
 *      authored, and InteractiveBook shows chapter titles as headings, so this walk reads those too.
 * Spec: PROD-001, UD-020
 * Invariants:
 *   - Every string of the parameters at any depth counts, including the `UI`, `l10n`, `texts`, `a11y`,
 *     `confirmCheck` and `confirmRetry` groups; of each sub-content's `metadata` only `title` counts, and of the
 *     activity's metadata only `title` (`extraTitle` is the editor's copy of it, so a marker is reported once).
 *   - A string is read through `parseRichText`: tags removed, then every character reference decoded exactly once,
 *     so `&#x27E6;` is a marker and the literal text `&amp;#10214;` is not (D-086 amendment, probe P6).
 *   - A lone `⟦` or `⟧` counts: an author's partial edit leaves one behind.
 *   - Pure, deterministic, pre-order; the input is never mutated; cycles and nesting deeper than MAX_DEPTH are not
 *     followed.
 * Collaborators: ./rules/placeholderRule.ts, ./richText.ts, ./contentWalker.ts (`subContentLibraryOf`),
 *   ./contentPath.ts, ./paramReaders.ts.
 * Tests: apps/server/test/validation/rules/placeholderRule.test.ts
 */
import { subContentLibraryOf } from './contentWalker.js';
import { pathOf } from './contentPath.js';
import { asObject, asString, fieldAt } from './paramReaders.js';
import { parseRichText, type RichTextReader } from './richText.js';

/** A field that still holds guidance. */
export interface GuidanceField {
  /** Path from the params root, or `metadata.title` for the activity's title. */
  readonly path: string;
  /** The field as plain text. */
  readonly text: string;
}

// WHY: content.json from H5P nests about 15 levels deep; a limit keeps hostile input from exhausting the stack.
const MAX_DEPTH = 100;
// WHY: D-086 is the one record of the marker, `⟦` (U+27E6) and `⟧` (U+27E7); a change there changes these patterns.
const MARK = /[⟦⟧]/;

/** What one scan carries: the fields found, the objects seen and the run's text reader. */
interface Scan {
  readonly found: GuidanceField[];
  readonly seen: WeakSet<object>;
  readonly read: RichTextReader;
}

function scan(value: unknown, path: string, { found, seen, read }: Scan, depth: number): void {
  const state = { found, seen, read };
  if (depth > MAX_DEPTH) return;
  if (typeof value === 'string') {
    const text = read(value).text;
    if (MARK.test(text)) found.push({ path, text });
    return;
  }
  if (value === null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item: unknown, index) => scan(item, pathOf(path, index), state, depth + 1));
    return;
  }
  const object = asObject(value) ?? {};
  if (subContentLibraryOf(object) !== undefined) {
    scan(asString(fieldAt(object, 'metadata', 'title')), pathOf(path, 'metadata', 'title'), state, depth);
    scan(object.params, pathOf(path, 'params'), state, depth + 1);
    return;
  }
  for (const [key, child] of Object.entries(object)) scan(child, pathOf(path, key), state, depth + 1);
}

/**
 * The fields of an activity that still hold pattern guidance.
 * @param params - The activity's parameters (content.json).
 * @param title - The activity's metadata title, if any.
 * @param read - The validation run's text reader.
 * @returns Each such field once, the title first, then the parameters in pre-order.
 * @spec PROD-001
 */
export function guidanceFields(
  params: unknown,
  title: string | undefined,
  read: RichTextReader = parseRichText,
): GuidanceField[] {
  const state: Scan = { found: [], seen: new WeakSet<object>(), read };
  scan(title, 'metadata.title', state, 0);
  scan(params, '', state, 0);
  return state.found;
}

/**
 * A short excerpt of the guidance in a field, for the finding's message.
 * @param text - The field as plain text.
 * @param maxLength - The longest excerpt.
 * @returns The first marked text without its marks, or (for a lone mark) the field's text, shortened with «…».
 */
export function guidanceExcerpt(text: string, maxLength = 80): string {
  const marked = /⟦([^⟦⟧]*)⟧/.exec(text)?.[1]?.trim();
  const excerpt = marked !== undefined && marked !== '' ? marked : text.trim();
  return excerpt.length > maxLength ? `${excerpt.slice(0, maxLength - 1).trimEnd()}…` : excerpt;
}
