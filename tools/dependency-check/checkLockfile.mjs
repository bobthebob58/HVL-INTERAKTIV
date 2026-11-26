/**
 * checkLockfile — holds package-lock.json to one source and one kind of checksum, and (with
 * ./installScriptRules.mjs) the install scripts to their reviewed list.
 *
 * Why: `npm ci` installs exactly what the lock file names, from the address it names, and accepts the checksum it
 *      names. A lock file edited by hand or by a compromised tool can point one package at another server, at
 *      another package's file, or at a weak checksum, and no review of `package.json` shows it. That every package
 *      came from the npm registry with a SHA-512 value was checked once by hand; this check holds it on every
 *      change, and CI runs it before anything is installed (SEC-007, D-145).
 * Spec: SEC-007
 * Invariants:
 *   - The lock file has `lockfileVersion` 3.
 *   - Every package that is not one of our workspaces is `resolved` from the npm registry's own address for its
 *     name and version (`https://registry.npmjs.org/<name>/-/<name>-<version>.tgz`) and carries a `sha512-`
 *     integrity value of the full length.
 *   - SECURITY: a package installed under another name (an alias) or bundled inside another package has no
 *     address of its own to check; it fails until a person reviews it and this check learns the case.
 *   - A link points at a local package of the lock file, and a local package names no download address.
 *   - Only Node's own modules are used: the check runs on a machine where nothing is installed yet.
 * Collaborators: package-lock.json, package.json, .npmrc, ./installScriptRules.mjs, CI (`npm run check:lockfile`,
 *                before `npm ci`).
 * Tests: tools/dependency-check/test/checkLockfile.test.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installScriptProblems, npmrcProblems, scriptedPackages } from './installScriptRules.mjs';

/** The only source a package may come from. */
export const REGISTRY = 'https://registry.npmjs.org/';
const SHA512 = /^sha512-[A-Za-z0-9+/]{86}==$/;

const isLocal = (key) => !key.includes('node_modules/');

/**
 * Lists the lock file's packages that are downloaded: every entry but the root, our workspaces and the links.
 * @param {{packages?: Record<string, object>}} lock - Parsed package-lock.json.
 * @returns {[string, object][]} Key and entry of each.
 */
export function registryPackages(lock) {
  return Object.entries(lock.packages ?? {}).filter(
    ([key, entry]) => key !== '' && !isLocal(key) && entry.link !== true,
  );
}

/**
 * Checks where each package of the lock file comes from and which checksum it carries.
 * @param {{lockfileVersion?: number, packages?: Record<string, object>}} lock - Parsed package-lock.json.
 * @returns {string[]} Problems; empty when every package is from the registry with a SHA-512 value.
 */
export function lockSourceProblems(lock) {
  const problems = [];
  const at = (key) => `package-lock.json: ${key}`;
  if (lock.lockfileVersion !== 3) problems.push('package-lock.json: lockfileVersion must be 3');
  const packages = lock.packages ?? {};
  for (const [key, entry] of Object.entries(packages)) {
    if (key === '') continue;
    if (entry.link === true) {
      if (typeof entry.resolved !== 'string' || !isLocal(entry.resolved) || !(entry.resolved in packages))
        problems.push(
          `${at(key)}: links to ${entry.resolved}, which is not a local package of the lock file`,
        );
    } else if (isLocal(key)) {
      if (entry.resolved !== undefined || entry.integrity !== undefined)
        problems.push(`${at(key)}: a local package must not name a download address or a checksum`);
    }
  }
  for (const [key, entry] of registryPackages(lock)) {
    const name = key.split('node_modules/').pop();
    const expected = `${REGISTRY}${name}/-/${name.split('/').pop()}-${entry.version}.tgz`;
    if (entry.name !== undefined && entry.name !== name)
      problems.push(`${at(key)}: is installed under another name (${entry.name}); review it`);
    else if (entry.inBundle === true)
      problems.push(`${at(key)}: is bundled inside another package and has no checksum of its own`);
    else if (entry.resolved !== expected)
      problems.push(`${at(key)}: comes from ${entry.resolved}, expected ${expected}`);
    if (entry.inBundle !== true && (typeof entry.integrity !== 'string' || !SHA512.test(entry.integrity)))
      problems.push(`${at(key)}: needs a sha512 integrity value`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const json = (file) => JSON.parse(readFileSync(join(root, file), 'utf8'));
  const lock = json('package-lock.json');
  const npmrc = existsSync(join(root, '.npmrc')) ? readFileSync(join(root, '.npmrc'), 'utf8') : undefined;
  const problems = [
    ...lockSourceProblems(lock),
    ...installScriptProblems(lock, json('package.json')),
    ...npmrcProblems(npmrc),
  ];
  for (const p of problems) console.error(`✗ ${p}`);
  if (problems.length > 0) process.exit(1);
  console.log(
    `✓ check:lockfile: ${registryPackages(lock).length} packages, each from registry.npmjs.org with a sha512 ` +
      `checksum; ${scriptedPackages(lock).length} install scripts, each reviewed in allowScripts.`,
  );
}
