/**
 * lockFileProduction — counts an installed copy as production when package-lock.json lists its folder as a
 * production package, also where npm's flag on the installed tree says dev.
 *
 * Why: check:licences and the SBOM cover every package a production install contains, and read npm's `dev` flag
 *      from the installed tree (`npm query '*'`). There, a copy that no installed package needs is extraneous and
 *      counts as dev. npm leaves such copies behind: when two optional packages are skipped for the platform, what
 *      both depend on stays installed. `npm prune --omit=dev`, which the image build runs (deploy/Dockerfile), goes
 *      by the lock file and keeps such a copy when the lock file lists it without `dev`. On 2026-11-27 that was
 *      @emnapi/runtime 1.11.3, wanted by @img/sharp-wasm32 and by rolldown's wasm32 binding: in the image, and seen
 *      by neither check (D-148).
 * Spec: NFR-005, SEC-007
 * Invariants:
 *   - Only adds: an entry npm does not mark dev is returned as it is, so the production set never shrinks.
 *   - An entry npm marks dev becomes production only when the lock file has its folder without `dev` and without
 *     `extraneous`. A folder the lock file lacks stays dev.
 *   - Reads package-lock.json; runs nothing.
 * Collaborators: ./checkLicences.mjs, ../sbom/buildSbom.mjs, package-lock.json (check:lockfile holds its form).
 * Tests: tools/dependency-check/test/lockFileProduction.test.mjs,
 *   tools/dependency-check/test/productionSetGuard.test.mjs (check:licences), tools/sbom/test/buildSbom.test.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The lock file's repository-relative path. */
export const LOCK_FILE = 'package-lock.json';

/**
 * Reads what the lock file says about each installed folder.
 * @param {string} root - Absolute repository root.
 * @returns {Record<string, {dev?: boolean, extraneous?: boolean}>} Folder (for example `node_modules/zod`) → entry.
 * @throws {Error} When the lock file is missing or is not JSON.
 */
export function readLockPackages(root) {
  return JSON.parse(readFileSync(join(root, LOCK_FILE), 'utf8')).packages ?? {};
}

/**
 * Says whether a production install keeps the folder a lock-file entry describes.
 * @param {{dev?: boolean, extraneous?: boolean} | undefined} locked - The entry; undefined when the file lacks it.
 * @returns {boolean} True when the lock file lists it, and neither as dev nor as extraneous.
 */
export const keptByProductionInstall = (locked) =>
  locked !== undefined && locked.dev !== true && locked.extraneous !== true;

/**
 * Gives every installed copy that npm marks dev, but that the lock file lists as production, the production flag.
 * @param {{location?: string, dev?: boolean}[]} entries - Every entry from `npm query '*'`.
 * @param {Record<string, object>} lockPackages - The lock file's `packages` (readLockPackages).
 * @returns {object[]} The entries; a changed one is a copy with `dev: false`.
 */
export function withLockFileProduction(entries, lockPackages) {
  const locked = (entry) =>
    Object.hasOwn(lockPackages, entry.location) ? lockPackages[entry.location] : undefined;
  return entries.map((entry) =>
    entry.dev === true && typeof entry.location === 'string' && keptByProductionInstall(locked(entry))
      ? { ...entry, dev: false }
      : entry,
  );
}
