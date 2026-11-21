/**
 * libraryReferences — finds every place in content parameters that Lumi would treat as a library dependency.
 *
 * Why: Lumi adds every `library: "H5P.Name x.y"` value it finds anywhere in the parameters to the content's
 *      dependencies (`H5PEditor.findLibrariesInParameters`), also under keys the semantics do not know. Such a
 *      library would be loaded by the player although no field offers it, so the sub-content policy refuses any
 *      reference the semantics walk did not reach (D-039).
 * Spec: H5P-002, SEC-008
 * Invariants:
 *   - Matches exactly what Lumi matches: a key `library` whose value is a string matching `/.+ \d+\.\d+/`.
 *   - That is tested with a pattern that reads each character a fixed number of times: Lumi's own, starting with
 *     `.+`, tries every start for every space (D-126). ./contentBudget.ts keeps such a string to 255 characters
 *     before Lumi's copy of the pattern reads it.
 *   - Iterative, so deeply nested parameters cannot overflow the stack.
 * Collaborators: ./SubContentPolicy.ts.
 * Tests: apps/server/test/h5p/semantics/libraryReferences.test.ts,
 *   apps/server/test/h5p/semantics/SubContentPolicy.test.ts
 */

/** One `library` value and the object that holds it. */
export interface LibraryReference {
  /** The object with the `library` key (a sub-content entry when the semantics reached it). */
  readonly owner: object;
  /** The value, e.g. `H5P.DragQuestion 1.14`. */
  readonly library: string;
}

// UPSTREAM: the same pattern as https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-server/src/H5PEditor.ts (findLibrariesInParameters).
// Keep it in step with Lumi; remove the check (D-039) when Lumi collects only libraries the semantics reach.
// WHY: `.+ \d+\.\d+` matches somewhere exactly when a space follows a character that ends no line and is followed
// by digits, a dot and a digit, which this pattern says without the leading `.+`.
const LUMI_LIBRARY_VALUE = /[^\n\r\u2028\u2029] \d+\.\d/;

/**
 * Tells whether Lumi would take a `library` value for a library and its version.
 * @param value - A string under a key named `library`.
 * @returns True when Lumi's pattern `/.+ \d+\.\d+/` matches the value.
 * @spec H5P-002
 */
export const namesLibraryVersion = (value: string): boolean => LUMI_LIBRARY_VALUE.test(value);

/**
 * Lists every library reference Lumi would collect from the parameters.
 * @param params - Content parameters (content.json).
 * @returns The references in no particular order.
 */
export function findLibraryReferences(params: unknown): LibraryReference[] {
  const found: LibraryReference[] = [];
  const pending: unknown[] = [params];
  while (pending.length > 0) {
    const node = pending.pop();
    if (typeof node !== 'object' || node === null) continue;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'library' && typeof value === 'string') {
        if (namesLibraryVersion(value)) found.push({ owner: node, library: value });
      } else {
        pending.push(value);
      }
    }
  }
  return found;
}
