/**
 * checkPins — fails when any package.json in the workspace uses a version range instead of an exact pin.
 *
 * Why: a range such as `^10.0.4` lets `npm install` pick up a new release nobody reviewed. For an H5P
 *      engine with a known unpatched CVE (D-003) every version change must be a deliberate commit.
 * Spec: SEC-007
 * Invariants:
 *   - Checks dependencies, devDependencies, optionalDependencies, peerDependencies and overrides.
 *   - Accepts only exact semver (`1.2.3`, `1.2.3-rc.1`); `^`, `~`, `*`, `x`, `>=`, tags and URLs fail.
 * Collaborators: root package.json, apps/* and packages/* package.json files; CI (`npm run check:pins`).
 * Tests: tools/dependency-check/test/checkPins.test.mjs
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'overrides'];
const EXACT = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

/**
 * Lists every workspace manifest: the root package.json and one per app or package.
 * @param {string} root - Absolute repository root.
 * @returns {string[]} Repository-relative paths of existing package.json files.
 */
export function manifestPaths(root) {
  const nested = ['apps', 'packages'].flatMap((dir) =>
    existsSync(join(root, dir))
      ? readdirSync(join(root, dir)).map((child) => `${dir}/${child}/package.json`)
      : [],
  );
  return ['package.json', ...nested].filter((f) => existsSync(join(root, f)));
}

/**
 * Finds version specifiers that are not exact pins.
 * @param {string} file - Manifest path, used in messages.
 * @param {object} manifest - Parsed package.json.
 * @returns {string[]} One message per loose specifier.
 */
export function loosePins(file, manifest) {
  return FIELDS.flatMap((field) =>
    Object.entries(manifest[field] ?? {})
      .filter(([, spec]) => typeof spec !== 'string' || !EXACT.test(spec))
      .map(([name, spec]) => `${file}: ${field}.${name} is "${JSON.stringify(spec)}"; pin an exact version`),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const files = manifestPaths(root);
  const problems = files.flatMap((f) => loosePins(f, JSON.parse(readFileSync(join(root, f), 'utf8'))));
  for (const p of problems) console.error(`✗ ${p}`);
  if (problems.length > 0) process.exit(1);
  console.log(`✓ check:pins: ${files.length} manifests, every version is pinned exactly.`);
}
