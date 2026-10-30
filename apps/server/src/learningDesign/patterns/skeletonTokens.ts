/**
 * skeletonTokens — the `{{token}}` text slots of a pattern skeleton: finding them, and filling them with a pattern
 * text in one language, written the way H5P stores text.
 *
 * Why: a skeleton holds H5P parameters, but its texts must exist in Nynorsk, Bokmål and English (D-084). Each text
 *      is a token resolved from `pattern.yaml` in the language the author chooses. The content check and the
 *      creation step must read and fill tokens the same way, so one module does both.
 * Spec: PED-010, PED-011, PROD-001
 * Invariants:
 *   - A token is `{{name}}`, the name a letter followed by letters, digits or hyphens (at most 64 characters);
 *     anything else between `{{` and `}}`, and a lone `{{` or `}}`, is a mistake the loader reports.
 *   - A value is plain text: `&`, `<` and `>` become `&amp;`, `&lt;` and `&gt;` on insertion, as Lumi stores text
 *     (quotes stay as they are, as Lumi's sanitiser leaves them); the guidance marker `⟦…⟧` stays raw (D-084).
 *   - One pass: a value is never searched for tokens again, so a text cannot pull in another text.
 *   - Resolving never mutates its input; the result shares no object with it.
 * Collaborators: ../content/patternContent.ts and ../content/patternTokenChecks.ts (the content check),
 *   ./PatternCreator.ts (creation).
 * Tests: apps/server/test/learningDesign/patterns/skeletonTokens.test.ts
 */

/** The form of a token name, e.g. `question` or `feedback-wrong-1`. */
export const TOKEN_NAME = /^[A-Za-z][A-Za-z0-9-]{0,63}$/;

// WHY: `[^{}]*` keeps `{{{x}}}` and `{{a}}b}}` from being read as one token; their extra braces are reported.
const TOKEN = /\{\{([^{}]*)\}\}/g;
// WHY: a nesting bound keeps a malformed skeleton from exhausting the stack (content.json nests about 15 levels).
const MAX_DEPTH = 100;

/** One `{{…}}` found in a text. */
export interface TokenUse {
  /** What stands between the braces, e.g. `question`. */
  readonly name: string;
  /** Whether `name` has the form of a token name (`TOKEN_NAME`). */
  readonly valid: boolean;
}

/**
 * The tokens in a text, in order (a name used twice is listed twice).
 * @param text - A skeleton string.
 * @returns Each `{{…}}` with whether its name is valid.
 */
export function tokensIn(text: string): TokenUse[] {
  return [...text.matchAll(TOKEN)].map((match) => {
    const name = match[1] ?? '';
    return { name, valid: TOKEN_NAME.test(name) };
  });
}

/**
 * Whether a text has a `{{` or `}}` that is not part of a token, or a brace stuck to one (`{{{a}}}`).
 * @param text - A skeleton string.
 * @returns True when braces are left once every token is removed, or three braces stand together.
 */
export const hasStrayBraces = (text: string): boolean =>
  /\{\{\{|\}\}\}/.test(text) || /\{\{|\}\}/.test(text.replace(TOKEN, ''));

/**
 * Writes plain text the way Lumi stores a text field: `&`, `<` and `>` as references, everything else as it is.
 * @param value - A pattern text.
 * @returns The text, safe inside HTML text.
 * @example escapeTokenValue('Sjekk & send ⟦svar⟧') === 'Sjekk &amp; send ⟦svar⟧'
 */
export function escapeTokenValue(value: string): string {
  // SECURITY: a pattern text is plain text; escaping keeps an ALU author's `<` from becoming markup in a field
  // that allows HTML, and matches what Lumi's sanitiser would store anyway.
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Gives a token's value in the chosen language, or undefined when the pattern has no such text. */
export type TokenValues = (name: string) => string | undefined;

/**
 * Fills the tokens of one text.
 * @param text - A skeleton string.
 * @param values - The pattern's texts in one language.
 * @param escape - Whether values are escaped (`true` for parameters; `false` for a plain-text title).
 * @returns The text with every known token replaced; an unknown token stays as written.
 */
export function resolveTokens(text: string, values: TokenValues, escape = true): string {
  return text.replace(TOKEN, (whole, name: string) => {
    const value = values(name);
    if (value === undefined) return whole;
    return escape ? escapeTokenValue(value) : value;
  });
}

function resolveDeep(value: unknown, values: TokenValues, depth: number): unknown {
  if (depth > MAX_DEPTH) throw new RangeError(`the skeleton nests deeper than ${MAX_DEPTH} levels`);
  if (typeof value === 'string') return resolveTokens(value, values);
  if (Array.isArray(value)) return value.map((item: unknown) => resolveDeep(item, values, depth + 1));
  if (value === null || typeof value !== 'object') return value;
  // SECURITY: fromEntries defines own properties, so a `__proto__` key in a skeleton stays data.
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, resolveDeep(child, values, depth + 1)]),
  );
}

/**
 * Fills every string of a skeleton's parameters (at any depth) with escaped values.
 * @param params - The skeleton's parameters; not changed.
 * @param values - The pattern's texts in one language.
 * @returns A copy with the tokens filled.
 * @throws RangeError when the parameters nest deeper than 100 levels.
 * @spec PROD-001
 */
export function resolveSkeletonParams<T>(params: T, values: TokenValues): T {
  return resolveDeep(params, values, 0) as T;
}

/**
 * Lists every string of a skeleton with its key path, for the content check.
 * @param value - The parsed skeleton, or a part of it.
 * @param path - The key path of `value`.
 * @returns Each string and where it is, in document order.
 */
export function skeletonStrings(
  value: unknown,
  path: readonly (string | number)[] = [],
): { readonly path: readonly (string | number)[]; readonly text: string }[] {
  if (path.length > MAX_DEPTH) return [];
  if (typeof value === 'string') return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((item: unknown, i) => skeletonStrings(item, [...path, i]));
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => skeletonStrings(child, [...path, key]));
}
