/**
 * permissionSystemGuard — refuses to start when any part of the H5P engine checks permissions with anything
 * but HVL's permission system.
 *
 * Why: Lumi falls back to `LaissezFairePermissionSystem` (everyone may do everything) wherever a component is
 *      built without a permission system, and it builds several components itself (content manager, package
 *      importer and exporter, temporary files, learner state, content-type list). One missed option would
 *      silently open library installation or other learners' state. This guard walks the built editor and
 *      player and checks every `permissionSystem` it finds (H5P-006, CLAUDE.md §1).
 * Spec: H5P-006, SEC-003
 * Invariants:
 *   - Every object reachable from the editor or player (three levels deep) that has a `permissionSystem`
 *     property holds exactly the expected instance; otherwise startup throws.
 *   - At least one such component must be found in each engine, so a renamed Lumi field cannot hide the check.
 * Collaborators: ./H5pEditorFactory.ts, ./H5pPlayerFactory.ts, ./HvlPermissionSystem.ts.
 * Tests: apps/server/test/h5p/permissionSystemGuard.test.ts
 */

/** Thrown when an H5P component does not use HVL's permission system. */
export class PermissionSystemMismatchError extends Error {
  /**
   * @param path - Where the foreign permission system was found, e.g. `editor.packageImporter`.
   */
  constructor(readonly path: string) {
    super(`H5P component ${path} does not use HVL's permission system`);
    this.name = 'PermissionSystemMismatchError';
  }
}

const MAX_DEPTH = 3;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function check(
  node: Record<string, unknown>,
  path: string,
  expected: object,
  depth: number,
  seen: Set<object>,
): number {
  if (seen.has(node)) return 0;
  seen.add(node);
  let found = 0;
  // WHY: own properties only; Lumi stores it as a class field, and proxies (e.g. Prisma) may answer `in` loosely.
  if (Object.hasOwn(node, 'permissionSystem')) {
    if (node.permissionSystem !== expected) throw new PermissionSystemMismatchError(path);
    found += 1;
  }
  if (depth >= MAX_DEPTH) return found;
  for (const [key, value] of Object.entries(node)) {
    // WHY: the permission system is checked by identity above; its own repositories are not H5P components.
    if (key === 'permissionSystem' || !isObject(value) || value === expected) continue;
    found += check(value, `${path}.${key}`, expected, depth + 1, seen);
  }
  return found;
}

/**
 * Checks that every permission-checking component of the engines uses the expected permission system.
 * @param engines - The built engines by name, e.g. `{ editor, player }`.
 * @param expected - HVL's permission system instance.
 * @returns The number of components checked per engine.
 * @throws PermissionSystemMismatchError when a component uses another one, or an engine has none at all.
 */
export function assertPermissionSystem(
  engines: Readonly<Record<string, object>>,
  expected: object,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [name, engine] of Object.entries(engines)) {
    const found = check(engine as Record<string, unknown>, name, expected, 0, new Set());
    if (found === 0) throw new PermissionSystemMismatchError(name);
    counts[name] = found;
  }
  return counts;
}
