/**
 * xapiResponseCaps — which xAPI answers are stored, and how long they may be: each gap cut to 100 characters, and a
 * whole answer over 1 000 characters not stored at all.
 *
 * Why: INS-003 needs choice indices and short gap text to group the answers that k learners share, but H5P does not
 *      bound what a learner types (probe P1: one 5 000-character gap made a 7 967-byte statement). D-115 caps each gap
 *      and drops an answer that is still too long, rather than shortening the list, which would shift its gaps.
 * Spec: DATA-012, INS-003
 * Invariants:
 *   - Only the interaction types `choice` and `fill-in` keep an answer (D-115); any other gives null.
 *   - Lengths are counted in Unicode code points, as PostgreSQL counts `VARCHAR(1000)`, so a cut never splits a
 *     surrogate pair and a kept answer always fits `XapiStatement.response`.
 *   - Gaps are split and joined on H5P's `[,]`; empty gaps are kept, so gap positions never move.
 *   - A number (BranchingScenario) is stored as its decimal text.
 * Collaborators: ./xapi.ts, apps/server (the DATA-012 mapper, step 3), packages/hvl-h5p-theme/src/xapiBridge.js (the
 *   same caps in the bridge, step 3).
 * Tests: packages/api-contract/test/xapiSchemas.test.ts
 */

/** The interaction types whose answer is stored (D-115). */
export const XAPI_STORED_INTERACTION_TYPES = ['choice', 'fill-in'] as const;
/** How H5P joins the gaps of one answer (and the choices of a multi-select). */
export const XAPI_GAP_SEPARATOR = '[,]';
/** The most characters kept of one gap (D-115). */
export const XAPI_RESPONSE_GAP_MAX = 100;
/** The longest answer stored; the column's limit (DATA-012, D-115). */
export const XAPI_RESPONSE_MAX = 1000;

const codePoints = (text: string): string[] => Array.from(text);
const isStoredType = (type: string | undefined): boolean =>
  (XAPI_STORED_INTERACTION_TYPES as readonly (string | undefined)[]).includes(type);

/**
 * The answer to store for a statement, with the caps applied.
 * @param response - `result.response` as sent: text with gaps joined by `[,]`, or a number.
 * @param interactionType - `object.definition.interactionType`, if any.
 * @returns The answer to store, or null when the type keeps none, there is none, or it is still over 1 000
 *   characters after each gap is cut to 100.
 * @spec DATA-012
 */
export function storedXapiResponse(
  response: string | number | undefined,
  interactionType: string | undefined,
): string | null {
  if (response === undefined || !isStoredType(interactionType)) return null;
  const capped = String(response)
    .split(XAPI_GAP_SEPARATOR)
    .map((gap) => codePoints(gap).slice(0, XAPI_RESPONSE_GAP_MAX).join(''))
    .join(XAPI_GAP_SEPARATOR);
  // PRIVACY: a long answer is dropped whole, not shortened: a cut list would shift the gaps INS-003 groups by.
  return codePoints(capped).length > XAPI_RESPONSE_MAX ? null : capped;
}
