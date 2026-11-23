/**
 * linkAddressConformance — the web address of a link field in H5P content parameters holds no character that
 * can end the HTML attribute a content type writes it into.
 *
 * Why: H5P's link field (`widget: 'linkWidget'`: a protocol and an address) is what H5P.Link, Interactive
 *      Video's "go to" and its hotspot use. The types join the address into `<a href="…">` as text. A plain
 *      text keeps its quotation marks, so an address with one ended the attribute and the rest of it was read
 *      as more attributes of the link. A web address needs none of these characters as they are: in a URL
 *      they are written percent-encoded, which is also what a browser does with them (D-140).
 * Spec: SEC-008
 * Invariants:
 *   - In the `url` of a link field, `"`, `'`, `<`, `>`, a backtick and a space are percent-encoded (`%22`,
 *     `%27`, `%3C`, `%3E`, `%60`, `%20`); control characters are removed, as a browser's URL parser removes
 *     them; space around the address is removed.
 *   - The two forms H5P's editor writes a quote in (`&quot;`, `&#039;`) are encoded the same way, so the
 *     editor's form shows what a save stores.
 *   - An address without such characters is not changed. A `url` that is no string is left to the walker.
 *   - The protocol is a select; ./semanticsConformance.ts fits it to its options.
 * Collaborators: ./semanticsConformance.ts (the only caller; calls it once the walk has cleaned the text).
 * Tests: apps/server/test/h5p/semantics/linkAddressConformance.test.ts
 */
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';

const ENCODED: Readonly<Record<string, string>> = {
  '"': '%22',
  "'": '%27',
  '<': '%3C',
  '>': '%3E',
  '`': '%60',
  ' ': '%20',
  '&quot;': '%22',
  '&#039;': '%27',
};
// SECURITY: a character class and two fixed words; no nesting, so the time is linear in the address.
const UNSAFE_IN_ATTRIBUTE = /["'<>` ]|&quot;|&#039;/g;
// eslint-disable-next-line no-control-regex -- the control characters are what is removed
const CONTROL = /[\u0000-\u001f\u007f]/g;

/**
 * Tells whether a field is H5P's link field: a group with the link widget and more than one field.
 * @param semantics - The field's semantics.
 * @returns True for a link field whose value is an object with a `url`.
 */
export function isLinkField(semantics: ISemanticsEntry): boolean {
  return semantics.type === 'group' && semantics.widget === 'linkWidget';
}

/**
 * A web address in the form that cannot leave a quoted HTML attribute.
 * @param address - The address as the parameters hold it.
 * @returns The address with the unsafe characters percent-encoded or removed.
 */
export function attributeSafeAddress(address: string): string {
  return address
    .replace(CONTROL, '')
    .trim()
    .replace(UNSAFE_IN_ATTRIBUTE, (found) => ENCODED[found] ?? '');
}

/**
 * Fits the address of one link field's value, in place.
 * @param link - The link field's value (`{ protocol, url }`).
 * @returns True when the address was changed.
 * @spec SEC-008
 */
export function fitLinkAddress(link: Record<string, unknown>): boolean {
  if (typeof link.url !== 'string') return false;
  const safe = attributeSafeAddress(link.url);
  if (safe === link.url) return false;
  link.url = safe;
  return true;
}
