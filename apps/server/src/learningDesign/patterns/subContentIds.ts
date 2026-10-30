/**
 * subContentIds — gives every sub-content node in a pattern skeleton's parameters a fresh `subContentId`.
 *
 * Why: H5P keys a learner's saved state and xAPI statements for nested content by `subContentId` (UUID), and the
 *      editor adds one when it loads a library field (h5peditor-library.js:374). An activity created from a pattern
 *      on the server never passes through the editor, so it gets its IDs here; IDs written in a skeleton (for
 *      example copied from an exported `.h5p`) are replaced, so two activities never share one (D-084).
 * Spec: PED-010, PROD-001
 * Invariants:
 *   - A node is an object whose `library` is `H5P.Name x.y` (sub-content), or an object that already has a
 *     `subContentId` key (a sub-content group such as H5P.Summary's statements, `isSubContent` in semantics); each
 *     gets a new ID, whatever it had. Nodes are found by shape at any depth, in lists and groups.
 *   - A sub-content group without a `subContentId` key cannot be recognised by shape and gets none; the editor adds
 *     it when the author opens the activity (h5peditor-group.js:162).
 *   - The input is never mutated; the result shares no object with it.
 * Collaborators: node:crypto `randomUUID`; ./semanticDefaults.ts runs first, so sub-content that a semantics
 *   default adds (e.g. InteractiveVideo's summary task) gets an ID too.
 * Tests: apps/server/test/learningDesign/patterns/subContentIds.test.ts,
 *   apps/server/test/learningDesign/patterns/skeletonCreation.browser.int.test.ts
 */
import { randomUUID } from 'node:crypto';

// WHY: content.json names sub-content libraries with a space (`H5P.MultiChoice 1.16`), as Lumi and the editor do.
const SUB_CONTENT_LIBRARY = /^[A-Za-z][\w.]* \d+\.\d+$/;
// WHY: content.json nests about 15 levels; a bound keeps a malformed skeleton from exhausting the stack.
const MAX_DEPTH = 100;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNode = (value: Record<string, unknown>): boolean =>
  'subContentId' in value || (typeof value.library === 'string' && SUB_CONTENT_LIBRARY.test(value.library));

function renew(value: unknown, newId: () => string, depth: number): unknown {
  if (depth > MAX_DEPTH) throw new RangeError(`parameters nest deeper than ${MAX_DEPTH} levels`);
  if (Array.isArray(value)) return value.map((item: unknown) => renew(item, newId, depth + 1));
  if (!isObject(value)) return value;
  // WHY: a node takes its ID before its children (pre-order), so IDs read top-down in the result.
  const id = isNode(value) ? newId() : undefined;
  // SECURITY: fromEntries defines own properties, so a `__proto__` key in a skeleton stays data, never a prototype.
  const out: Record<string, unknown> = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, renew(child, newId, depth + 1)]),
  );
  if (id !== undefined) out.subContentId = id;
  return out;
}

/**
 * Copies parameters with a fresh `subContentId` on every sub-content node.
 * @param params - Parameters (content.json); not changed.
 * @param newId - Makes an ID; a random UUID by default (tests pass a counter).
 * @returns The copy.
 * @throws RangeError when the parameters nest deeper than 100 levels.
 * @spec PED-010
 */
export function withFreshSubContentIds<T>(params: T, newId: () => string = randomUUID): T {
  return renew(params, newId, 0) as T;
}
