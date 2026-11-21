/**
 * undeclaredKeys — content parameters as a save could carry them and an old row could hold them: with one more
 * key, which no semantics name, in every object.
 *
 * Why: the tests of D-123 and D-124 show that such a key is neither stored by a save nor handed to the player or
 *      the editor. Its value is markup, so a test can also look for it in a page.
 * Spec: SEC-008
 * Invariants: the key is `UNDECLARED_KEY` everywhere and its value `MARKUP`; the input is not changed. Nothing is
 *   added inside `metadata` and `copyright` objects: every save since D-039 makes their strings plain text, so no
 *   stored row holds markup there.
 * Tests: shared by apps/server/test/h5p/semantics/realTypesConformance.int.test.ts,
 *   apps/server/test/h5p/semantics/playedParams.int.test.ts and
 *   apps/server/test/h5p/semantics/playedParams.test.ts.
 */

/** Markup that would load nothing and run nothing by itself; tests look for `onerror` in what comes back. */
export const MARKUP = '<img src=x onerror=alert(1)>';

/** A key no semantics of the installed libraries name. */
export const UNDECLARED_KEY = 'hvlUndeclared';

/**
 * The parameters with `UNDECLARED_KEY` added to every object, at every level, outside metadata and copyright.
 * @param params - Content parameters (content.json).
 * @returns A deep copy with the extra keys.
 */
export function withUndeclaredKeys<T extends Record<string, unknown>>(params: T): T {
  const copy = structuredClone(params);
  const mark = (node: unknown): void => {
    if (Array.isArray(node)) node.forEach(mark);
    else if (typeof node === 'object' && node !== null) {
      for (const [key, value] of Object.entries(node))
        if (key !== 'metadata' && key !== 'copyright') mark(value);
      Object.assign(node, { [UNDECLARED_KEY]: MARKUP });
    }
  };
  mark(copy);
  return copy;
}
