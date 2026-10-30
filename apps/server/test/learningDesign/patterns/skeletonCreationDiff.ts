/**
 * skeletonCreationDiff — compares two H5P parameter trees leaf by leaf, and collects their `subContentId`s, so probe
 * P1 can say exactly what the editor changes when an author saves a server-created activity unchanged.
 *
 * Why: a skeleton is complete only if the editor has nothing to add; what it adds or changes is a field the
 *      creation step must set (D-084). List indices are kept in paths, so a moved item shows as a change.
 * Spec: PED-010, PROD-001
 * Invariants: pure; paths are `a.b[0].c`; an empty object or list is a leaf (`{}` / `[]`), so "the editor added an
 *   empty group" is visible.
 * Collaborators: ./skeletonCreation.browser.int.test.ts.
 * Tests: apps/server/test/learningDesign/patterns/skeletonCreation.browser.int.test.ts
 */

/** What changed from one parameter tree to another. */
export interface ParamsDiff {
  /** Leaf paths only in the second tree. */
  readonly added: string[];
  /** Leaf paths only in the first tree. */
  readonly removed: string[];
  /** Leaf paths in both, with different values. */
  readonly changed: string[];
}

function collectLeaves(value: unknown, path: string, out: Map<string, string>): void {
  if (Array.isArray(value) && value.length > 0) {
    value.forEach((item: unknown, i) => collectLeaves(item, `${path}[${i}]`, out));
  } else if (typeof value === 'object' && value !== null && Object.keys(value).length > 0) {
    for (const [key, child] of Object.entries(value))
      collectLeaves(child, path ? `${path}.${key}` : key, out);
  } else {
    // WHY: JSON.stringify gives undefined for undefined; such a leaf counts as null.
    out.set(path, JSON.stringify(value) ?? 'null');
  }
}

/**
 * Every leaf of a parameter tree with its JSON value.
 * @param value - The tree.
 * @returns Path → JSON text.
 */
export function leaves(value: unknown): Map<string, string> {
  const out = new Map<string, string>();
  collectLeaves(value, '', out);
  return out;
}

/**
 * The leaf differences between two trees, each list sorted.
 * @param before - The first tree.
 * @param after - The second tree.
 * @returns Added, removed and changed paths.
 */
export function diffParams(before: unknown, after: unknown): ParamsDiff {
  const a = leaves(before);
  const b = leaves(after);
  return {
    added: [...b.keys()].filter((p) => !a.has(p)).sort(),
    removed: [...a.keys()].filter((p) => !b.has(p)).sort(),
    changed: [...a.keys()].filter((p) => b.has(p) && a.get(p) !== b.get(p)).sort(),
  };
}

/**
 * Every `subContentId` in a tree, by path.
 * @param value - The tree.
 * @returns Path of the owning object → ID.
 */
export function subContentIdsOf(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [path, json] of leaves(value)) {
    if (path === 'subContentId' || path.endsWith('.subContentId')) {
      out[path.slice(0, -'subContentId'.length).replace(/\.$/, '')] = JSON.parse(json) as string;
    }
  }
  return out;
}

/**
 * A path without its list indices, so repeated items collapse: `a[2].b` → `a[].b`.
 * @param path - A leaf path.
 * @returns The path with `[]` for every index.
 */
export const withoutIndices = (path: string): string => path.replace(/\[\d+\]/g, '[]');

/**
 * Distinct paths without list indices, sorted.
 * @param paths - Leaf paths.
 * @returns The collapsed paths.
 */
export const distinctPaths = (paths: Iterable<string>): string[] =>
  [...new Set([...paths].map(withoutIndices))].sort();

// WHY: learner-facing text is a phrase or a capitalised word; setting values ("auto", "useBehavioural") are not.
const TEXT = /[A-Za-z]{2,} [A-Za-z]{2,}|^[A-Z][a-z]+$/;

/**
 * Text leaves with the same value in two trees, e.g. a skeleton filled with nn defaults and with en defaults:
 * where the library's language file leaves its English text.
 * @param a - The first tree.
 * @param b - The second tree.
 * @param given - The skeleton; its own texts are left out.
 * @returns Distinct collapsed paths, sorted.
 */
export function sameText(a: unknown, b: unknown, given: unknown): string[] {
  const second = leaves(b);
  const own = new Set(leaves(given).values());
  const same = [...leaves(a)].filter(([path, json]) => {
    const value: unknown = JSON.parse(json);
    return typeof value === 'string' && TEXT.test(value) && second.get(path) === json && !own.has(json);
  });
  return distinctPaths(same.map(([path]) => path));
}
