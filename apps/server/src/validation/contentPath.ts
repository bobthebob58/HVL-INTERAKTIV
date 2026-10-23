/**
 * contentPath — builds and orders the dot-and-bracket paths that findings point to (`content[1].content.params.alt`).
 *
 * Why: the editor's "Go to field" and the publish acknowledgements (D-074) key on a finding's path, so every rule
 *      must spell paths the same way, and the findings list must order `[2]` before `[10]`.
 * Spec: UD-020
 * Invariants:
 *   - Paths are relative to the activity's params root; the root itself is the empty string.
 *   - Identifier keys join with `.`, list indices as `[n]`, and any other key as `["key"]` (JSON-quoted).
 *   - `comparePaths` is a total order that compares indices as numbers.
 * Collaborators: ./contentWalker.ts, ./findingOrder.ts, every rule under ./rules/.
 * Tests: apps/server/test/validation/contentWalker.test.ts
 */

/** One step in a path: an object key or a list index. */
export type PathSegment = string | number;

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * Appends segments to a path.
 * @param base - The path so far (`''` for the params root).
 * @param segments - Keys and indices to append.
 * @returns The joined path.
 * @example pathOf('content[1].content', 'params', 'alt') === 'content[1].content.params.alt'
 */
export function pathOf(base: string, ...segments: readonly PathSegment[]): string {
  let path = base;
  for (const segment of segments) {
    if (typeof segment === 'number') path += `[${segment}]`;
    else if (!IDENTIFIER.test(segment)) path += `[${JSON.stringify(segment)}]`;
    else path = path === '' ? segment : `${path}.${segment}`;
  }
  return path;
}

/**
 * Tells whether `path` is `ancestor` itself or lies inside it.
 * @param path - A candidate path.
 * @param ancestor - The enclosing path.
 * @returns True when `path` starts with `ancestor` at a segment boundary.
 */
export function isWithin(path: string, ancestor: string): boolean {
  if (ancestor === '' || path === ancestor) return true;
  return path.startsWith(ancestor) && (path[ancestor.length] === '.' || path[ancestor.length] === '[');
}

const tokens = (path: string): string[] => path.split(/[.[\]]+/).filter((t) => t !== '');

/**
 * Orders two paths segment by segment, with list indices compared as numbers.
 * @param a - First path.
 * @param b - Second path.
 * @returns A negative number, zero or a positive number, as `Array.prototype.sort` expects.
 */
export function comparePaths(a: string, b: string): number {
  const [left, right] = [tokens(a), tokens(b)];
  for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
    const [x, y] = [left[i] ?? '', right[i] ?? ''];
    if (x === y) continue;
    const numeric = /^\d+$/.test(x) && /^\d+$/.test(y);
    if (numeric) return Number(x) - Number(y);
    // WHY: plain code-unit order, not localeCompare, so the order never depends on the server's locale.
    return x < y ? -1 : 1;
  }
  return left.length - right.length || (a < b ? -1 : a > b ? 1 : 0);
}
