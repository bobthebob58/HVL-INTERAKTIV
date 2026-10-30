/**
 * productionSetGuard — fails the licence check when the production set it checked lacks a workspace or a declared
 * runtime dependency.
 *
 * Why: check:licences checks the packages `npm query '*'` returns. When npm does not see the workspaces, it marks
 *      them and everything only they need as dev, so the production set shrinks and the check passes while checking
 *      almost nothing (the S5 gate counted 1 production package instead of 482 behind a stray
 *      node_modules/node_modules link). Every workspace and every runtime dependency our manifests declare must be in
 *      the set, so a shrunken set fails loudly instead of passing (D-113).
 * Spec: NFR-005
 * Invariants:
 *   - The workspaces are the ones the root `workspaces` names, as npm finds them (`dir/*` or a plain directory);
 *     any other pattern throws, so a new workspace layout cannot be skipped silently.
 *   - Expected: every workspace's own name and every name in a root or workspace `dependencies` (dev tools are not
 *     shipped). No magic number: the manifests are the expectation, matched by package name.
 *   - An entry without a package name (a link to a folder outside the tree) is a problem, not a crash.
 * Collaborators: root and workspace package.json files, checkLicences.mjs (runs the guard before the licence check).
 * Tests: tools/dependency-check/test/productionSetGuard.test.mjs
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, posix } from 'node:path';

/** The root manifest's repository-relative path. */
export const ROOT_MANIFEST = 'package.json';

/** What the problems mean and what usually causes them, printed after them. */
export const LIKELY_CAUSE =
  'The production set npm reported is not the one production ships, so the licence check would not check it. ' +
  'Likely cause: a stray node_modules/node_modules link or an install that predates a workspace; remove the link ' +
  'and run `npm ci`.';

/**
 * Lists the root manifest and one manifest per workspace the root `workspaces` names.
 * WHY: npm reads the workspaces from `workspaces`, not from a fixed list of folders; a pattern npm would expand but
 * this does not (for example `**` or braces) throws instead of leaving a workspace out of the expectation.
 * @param {string} root - Absolute repository root.
 * @param {{workspaces?: string[]}} rootManifest - The parsed root package.json.
 * @returns {string[]} Repository-relative package.json paths, the root first.
 */
export function workspaceManifestPaths(root, rootManifest) {
  const folders = (rootManifest.workspaces ?? []).flatMap((written) => {
    const pattern = posix.normalize(written).replace(/\/+$/, '');
    if (!/[*?[\]{}!]/.test(pattern)) return [pattern];
    const parent = pattern.slice(0, -2);
    if (!pattern.endsWith('/*') || /[*?[\]{}!]/.test(parent))
      throw new Error(`workspaces pattern "${pattern}" is not supported; extend workspaceManifestPaths`);
    // WHY: like npm's glob, `*` matches neither dot-folders nor node_modules.
    return existsSync(join(root, parent))
      ? readdirSync(join(root, parent))
          .filter((child) => !child.startsWith('.') && child !== 'node_modules')
          .map((child) => `${parent}/${child}`)
      : [];
  });
  const nested = folders.map((folder) => `${folder}/package.json`);
  return [ROOT_MANIFEST, ...nested].filter((file) => existsSync(join(root, file)));
}

/**
 * Reads the root and workspace manifests.
 * @param {string} root - Absolute repository root.
 * @returns {Record<string, object>} Parsed package.json by repository-relative path, the root first.
 */
export function readWorkspaceManifests(root) {
  const read = (file) => JSON.parse(readFileSync(join(root, file), 'utf8'));
  const paths = workspaceManifestPaths(root, read(ROOT_MANIFEST));
  return Object.fromEntries(paths.map((file) => [file, read(file)]));
}

/**
 * Collects the packages a production install must contain: each workspace and each declared runtime dependency.
 * @param {Record<string, {name?: string, dependencies?: Record<string, string>}>} manifests - By path, the root
 *   manifest at ROOT_MANIFEST.
 * @returns {Map<string, {workspace?: string, declaredIn: string[]}>} Package name → the workspace folder it is, if
 *   any, and the manifests that declare it, in manifest order.
 */
export function expectedProductionPackages(manifests) {
  const expected = new Map();
  const entry = (name) => {
    if (!expected.has(name)) expected.set(name, { workspace: undefined, declaredIn: [] });
    return expected.get(name);
  };
  for (const [file, manifest] of Object.entries(manifests)) {
    // WHY: npm names a workspace without a `name` after its folder.
    if (file !== ROOT_MANIFEST) entry(manifest.name ?? basename(dirname(file))).workspace = dirname(file);
    for (const name of Object.keys(manifest.dependencies ?? {})) entry(name).declaredIn.push(file);
  }
  return expected;
}

/**
 * Finds what makes the checked production set incomplete: expected packages it lacks and entries without a name.
 * WHY: matched by name; check:pins already forbids `npm:` aliases (not an exact version), so a declared name is the
 * name npm reports for the installed package.
 * @param {Map<string, {workspace?: string, declaredIn: string[]}>} expected - From expectedProductionPackages.
 * @param {{name?: string, location?: string}[]} packages - The production entries the licence check saw
 *   (productionPackages).
 * @returns {string[]} One message per problem, then LIKELY_CAUSE; empty when the set is complete.
 */
export function incompleteSetProblems(expected, packages) {
  const present = new Set(packages.map((p) => p.name));
  const unnamed = packages
    .filter((p) => typeof p.name !== 'string')
    .map((p) => `npm reported an entry without a package name at ${p.location ?? '(no location)'}`);
  const missing = [...expected]
    .filter(([name]) => !present.has(name))
    .map(([name, { workspace, declaredIn }]) => {
      const why = [
        workspace && `the workspace in ${workspace}`,
        declaredIn.length > 0 && `declared in ${declaredIn.join(', ')}`,
      ];
      const total = `the ${packages.length} production packages npm reported`;
      return `${name} (${why.filter(Boolean).join('; ')}) is missing from ${total}`;
    });
  const problems = [...unnamed, ...missing];
  return problems.length > 0 ? [...problems, LIKELY_CAUSE] : [];
}
