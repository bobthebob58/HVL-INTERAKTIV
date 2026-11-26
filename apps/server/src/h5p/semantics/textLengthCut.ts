/**
 * textLengthCut — cuts a cleaned text to its field's `maxLength` so that what is left is still whole: no
 * unfinished tag, no unfinished character reference, no half of a character.
 *
 * Why: Lumi cleans a text and then cuts it to `maxLength` at a fixed position. A cut inside a tag leaves
 *      `<a href="…` at the end of the stored text, and a content type that writes the text into its page joins
 *      it with the markup that follows, so the open attribute takes that markup in. A cut inside `&amp;` leaves
 *      `&am`, and one inside a character outside the basic plane leaves half of it, which PostgreSQL's JSON
 *      refuses. So the cut is made here, before Lumi's, on text without markup (D-140).
 * Spec: SEC-008
 * Invariants:
 *   - A text within `maxLength`, or a field without a positive `maxLength`, is returned as it is.
 *   - A longer text is cut as plain text: its words are kept and its markup is not, since a cut cannot keep
 *     markup whole and within the length. H5P's editor never sends a text past its field's length, and no
 *     content type HVL offers gives a field with markup a length.
 *   - The result is never longer than `maxLength`, ends in a whole character and a whole character reference,
 *     and is not changed by cleaning it again.
 *   - Works on text a cleaner has written, where every `&` starts a reference that `;` ends. No pattern
 *     matching: one `lastIndexOf` read per cut.
 * Collaborators: ./lumiTextSanitizer.ts (the only caller; hands in the plain-text cleaner).
 * Tests: apps/server/test/h5p/semantics/textLengthCut.test.ts,
 *   apps/server/test/h5p/semantics/lumiTextSanitizer.test.ts
 */

const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;

/**
 * The start of a plain text, without what a cut left unfinished at its end.
 * @param plain - Plain text a cleaner has written (no tags; `<`, `>` and `&` as references).
 * @param length - How many UTF-16 units to keep at most.
 * @returns The start of the text, ending in a whole character and a whole character reference.
 */
export function wholeStart(plain: string, length: number): string {
  let text = plain.substring(0, length);
  // WHY: half of a character outside the basic plane is no text; PostgreSQL's JSON refuses it.
  if (text.length > 0 && isHighSurrogate(text.charCodeAt(text.length - 1))) text = text.slice(0, -1);
  const reference = text.lastIndexOf('&');
  return reference !== -1 && !text.includes(';', reference) ? text.slice(0, reference) : text;
}

/**
 * Fits a cleaned text to its field's `maxLength`.
 * @param clean - The text, cleaned by the field's rule.
 * @param maxLength - The field's `maxLength`, as its semantics give it.
 * @param plainText - The plain-text cleaner (./lumiTextSanitizer.ts).
 * @returns The text as it is when it is within the length; otherwise its plain text, cut whole.
 * @spec SEC-008
 */
export function cutToLength(clean: string, maxLength: unknown, plainText: (text: string) => string): string {
  const max = Math.floor(Number(maxLength));
  if (!(max > 0) || clean.length <= max) return clean;
  return wholeStart(plainText(clean), max);
}
