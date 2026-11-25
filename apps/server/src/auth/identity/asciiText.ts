/**
 * asciiText — lower-casing and trimming that touch ASCII only, for identifiers that are compared or hashed.
 *
 * Why: `String.prototype.toLowerCase` folds by Unicode's rules, so U+212A (the Kelvin sign) becomes the letter
 *      `k`, and `trim` removes every Unicode space. An identifier tidied that way before it is checked lets a
 *      look-alike written with such a character name the same account as the plain one (D-142). Identifiers
 *      (a Feide ID, a Feide group ID, an entry of a configured list) are ASCII where their case is free, so only
 *      ASCII is folded and only ASCII blanks are trimmed; every other character stays as written and is then
 *      judged by the identifier's own pattern.
 * Spec: AUTH-002, AUTH-005
 * Invariants:
 *   - `asciiLowerCase` changes `A`–`Z` only; the result has the same length, and every other code unit is kept.
 *   - `trimAsciiBlanks` removes SP and HTAB from both ends, nothing else (as ../session/sessionCookies.ts does).
 *   - Both take time in step with the text's length, and import nothing.
 * Collaborators: ./feideId.ts, ../feide/FeideRoleMapper.ts, ../../config/envParsers.ts.
 * Tests: apps/server/test/auth/identity/asciiText.test.ts
 */

const UPPER_ASCII = /[A-Z]/g;

/**
 * Lower-cases the letters `A`–`Z` and nothing else.
 * @param text - An identifier as written.
 * @returns The text with ASCII capitals made small; e.g. the Kelvin sign U+212A stays the Kelvin sign.
 */
export const asciiLowerCase = (text: string): string =>
  text.replace(UPPER_ASCII, (letter) => String.fromCharCode(letter.charCodeAt(0) + 32));

const isBlank = (code: number): boolean => code === 0x20 || code === 0x09;

/**
 * Removes spaces and tabs from both ends and nothing else.
 * @param text - An identifier as written.
 * @returns The text without SP and HTAB at its ends; a no-break space or a line break stays.
 */
export function trimAsciiBlanks(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && isBlank(text.charCodeAt(start))) start += 1;
  while (end > start && isBlank(text.charCodeAt(end - 1))) end -= 1;
  return text.slice(start, end);
}
