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
 *   - Iterative, so deeply nested parameters cannot overflow the stack.
 * Collaborators: ./SubContentPolicy.ts.
 * Tests: apps/server/test/h5p/semantics/SubContentPolicy.test.ts
 */

/** One `library` value and the object that holds it. */
export interface LibraryReference {
  /** The object with the `library` key (a sub-content entry when the semantics reached it). */
  readonly owner: object;
  /** The value, e.g. `H5P.DragQuestion 1.14`. */
  readonly library: string;
}

// UPSTREAM: the same pattern as https://github.com/Lumieducation/H5P-Nodejs-library/blob/v10.0.4/packages/h5p-server/src/H5PEditor.ts (findLibrariesInParameters).
const LUMI_LIBRARY_VALUE = /.+ \d+\.\d+/;

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
        if (LUMI_LIBRARY_VALUE.test(value)) found.push({ owner: node, library: value });
      } else {
        pending.push(value);
      }
    }
  }
  return found;
}
