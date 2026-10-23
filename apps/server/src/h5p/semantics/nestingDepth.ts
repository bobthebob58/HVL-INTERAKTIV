/**
 * nestingDepth — refuses content nested so deeply that Lumi's recursive walks would exhaust the stack.
 *
 * Why: our own walks are iterative, but Lumi's are not: `findLibrariesInParameters` on save and the content
 *      scanners on save and import recurse once per level. A few kilobytes of nested arrays then end the save
 *      with a stack overflow (500). Real H5P content nests a few dozen levels at most.
 * Spec: PROD-012, SEC-005
 * Invariants:
 *   - Checked iteratively, before anything recursive sees the value.
 *   - Deeper than `MAX_NESTING_DEPTH` objects and arrays: 400 `hvl:content-too-deep`.
 * Collaborators: ./SubContentPolicy.ts (every save), ../libraries/packageManifest.ts (content.json on import).
 * Tests: apps/server/test/http/contentInput.int.test.ts
 */
import { H5pError } from '@lumieducation/h5p-server';

/** Deepest nesting of objects and arrays accepted (Lumi's walks overflowed from about 2 500 levels). */
export const MAX_NESTING_DEPTH = 256;

/**
 * Throws when the value nests objects or arrays deeper than the limit.
 * @param value - Parsed JSON (parameters or metadata).
 * @param max - The limit; `MAX_NESTING_DEPTH` by default.
 * @throws H5pError `hvl:content-too-deep` (400).
 */
export function assertNestingDepth(value: unknown, max = MAX_NESTING_DEPTH): void {
  const pending: [unknown, number][] = [[value, 0]];
  while (pending.length > 0) {
    const [node, depth] = pending.pop() as [unknown, number];
    if (typeof node !== 'object' || node === null) continue;
    if (depth >= max) throw new H5pError('hvl:content-too-deep', { path: `depth ${max}` }, 400);
    for (const child of Object.values(node)) pending.push([child, depth + 1]);
  }
}
