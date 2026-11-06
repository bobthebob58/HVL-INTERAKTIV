/**
 * contentTypeBundle — checks the ten H5P content-type packages and copies them, with a `SHA256SUMS`, into an offline
 * bundle that an image build, and a host without GitHub, seed from.
 *
 * Why: HVL's hosts and the image build do not fetch from GitHub, so the real content types (D-078) travel as a bundle
 *      built where GitHub is reachable (D-110). Each hop checks the hashes again: this builder against the fetch's own
 *      list, the image build against the bundle's list, the seeder when it installs (H5P-003). A library build that
 *      wrote its build machine's environment into its JavaScript would ship that machine's secrets to every learner
 *      and into every image (found in H5P.AudioRecorder 1.0), so such a package is refused (D-110 amendment of
 *      2026-11-05).
 * Spec: NFR-007, H5P-003, H5P-002
 * Invariants:
 *   - A bundle holds exactly the ten content types (CLAUDE.md §1), one `H5P.<Type>.h5p` each and never a package of
 *     its own for DragQuestion; their libraries' dependencies stay inside the packages.
 *   - A package that is missing, changed or not listed, or a listed name that is not one of the ten, fails the check;
 *     the bundle is written only when there is no problem.
 *   - SECURITY: a package with a text file that holds a build machine's secrets is refused, by the rules every way in
 *     shares (`libraryBuildSecrets.ts`, D-110 amendment of 2026-11-06); the problem names the package, the file and
 *     the variable or the kind of value, never the value. Unlike the server, the bundle scans `content/` too.
 *   - WHY: that rules file is TypeScript without imports, which Node 24 loads by stripping its types, so this tool
 *     needs no build step; the image's `inputs` stage copies it next to this file.
 * Collaborators: ./bundleCli.mjs, ../h5p-core/verifyClientFiles.mjs (`readHashList`),
 *   ../h5p-libraries/resolveManifest.mjs (`CONTENT_TYPE_ROOTS`), apps/server/src/h5p/libraries/libraryBuildSecrets.ts,
 *   yauzl, deploy/Dockerfile (stage `inputs`), deploy/smoke/dockerSmoke.sh.
 * Tests: tools/h5p-bundle/test/contentTypeBundle.test.mjs, tools/h5p-bundle/test/bundleSecretGuard.test.mjs
 */
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import yauzl from 'yauzl';
import {
  MAX_SCANNED_FILE_BYTES,
  SCANNED_TEXT_FILE,
  buildSecretsIn,
} from '../../apps/server/src/h5p/libraries/libraryBuildSecrets.ts';
import { readHashList } from '../h5p-core/verifyClientFiles.mjs';
import { CONTENT_TYPE_ROOTS } from '../h5p-libraries/resolveManifest.mjs';

/** The package file names a bundle holds: one per content type, sorted. */
export const BUNDLE_PACKAGES = CONTENT_TYPE_ROOTS.map((root) => `${root.machineName}.h5p`).sort();

/** The hash list's file name, in the fetch's folder and in the bundle (the seeder reads the same name). */
export const SUMS_FILE = 'SHA256SUMS';

/**
 * The SHA-256 of a file.
 * @param {string} path - The file.
 * @returns {string} Lower-case hex.
 */
export const sha256Of = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

/**
 * Checks a folder of packages against its own `SHA256SUMS` and the ten content types.
 * @param {string} dir - A folder with the ten `.h5p` files and their `SHA256SUMS`.
 * @returns {{ problems: string[], sums: Map<string, string> }} The problems (empty when the folder is right) and the
 *   listed hashes.
 */
export function checkPackageFolder(dir) {
  const listFile = join(dir, SUMS_FILE);
  if (!existsSync(listFile)) return { problems: [`no ${SUMS_FILE} in the folder`], sums: new Map() };
  const sums = readHashList(readFileSync(listFile, 'utf8'));
  const problems = [];
  for (const name of BUNDLE_PACKAGES) if (!sums.has(name)) problems.push(`not listed: ${name}`);
  for (const [name, hash] of sums) {
    if (!BUNDLE_PACKAGES.includes(name)) problems.push(`not one of the ten content types: ${name}`);
    else if (!existsSync(join(dir, name))) problems.push(`missing: ${name}`);
    else if (sha256Of(join(dir, name)) !== hash) problems.push(`changed: ${name}`);
  }
  for (const name of readdirSync(dir).sort())
    if (name !== SUMS_FILE && !sums.has(name)) problems.push(`unexpected: ${name}`);
  return { problems, sums };
}

const readEntry = (zip, entry) =>
  new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error) return reject(error);
      const chunks = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
  });

/**
 * Finds the text files of a package that hold a build machine's secrets.
 * @param {string} packageFile - The `.h5p` file.
 * @returns {Promise<string[]>} One line per finding: the file in the package and the variable names.
 */
export function secretsInPackage(packageFile) {
  return new Promise((resolve, reject) => {
    yauzl.open(packageFile, { lazyEntries: true }, (openError, zip) => {
      if (openError) return reject(openError);
      const findings = [];
      zip.on('error', reject);
      zip.on('end', () => resolve(findings));
      zip.on('entry', (entry) => {
        if (!SCANNED_TEXT_FILE.test(entry.fileName)) return zip.readEntry();
        if (entry.uncompressedSize > MAX_SCANNED_FILE_BYTES) {
          findings.push(`${entry.fileName} is too large to scan (over 32 MB), so it is refused`);
          return zip.readEntry();
        }
        readEntry(zip, entry).then((text) => {
          const names = buildSecretsIn(text);
          if (names.length > 0)
            findings.push(
              `${entry.fileName} holds ${names.join(', ')} (a build machine's environment; rebuild without it)`,
            );
          zip.readEntry();
        }, reject);
      });
      zip.readEntry();
    });
  });
}

/**
 * Every problem of a folder of packages: its hashes, the ten types and secrets baked into a package.
 * @param {string} dir - The folder (a fetch's `packages/` or a bundle).
 * @returns {Promise<{ problems: string[], sums: Map<string, string> }>} The problems and the listed hashes.
 */
export async function bundleProblems(dir) {
  const { problems, sums } = checkPackageFolder(dir);
  if (problems.length > 0) return { problems, sums };
  for (const name of [...sums.keys()].sort())
    for (const finding of await secretsInPackage(join(dir, name))) problems.push(`${name}: ${finding}`);
  return { problems, sums };
}

/** Thrown when a folder cannot become, or is not, a bundle; `problems` lists why. */
export class BundleError extends Error {
  /** @param {string[]} problems - One line per problem. */
  constructor(problems) {
    super(`content-type bundle refused:\n${problems.map((p) => `  ✗ ${p}`).join('\n')}`);
    this.name = 'BundleError';
    this.problems = problems;
  }
}

/**
 * Builds a bundle: checks the packages, then copies them and writes their `SHA256SUMS` into a new folder.
 * @param {{ from: string, out: string }} options - The fetch's `packages/` folder and the bundle folder, which must
 *   not exist yet or be empty.
 * @returns {Promise<{ packages: number }>} How many packages the bundle holds.
 * @throws {BundleError} With every problem; nothing is written then.
 */
export async function buildBundle({ from, out }) {
  const { problems, sums } = await bundleProblems(from);
  if (existsSync(out) && readdirSync(out).length > 0) problems.push(`the bundle folder is not empty: ${out}`);
  if (problems.length > 0) throw new BundleError(problems);
  mkdirSync(out, { recursive: true });
  const names = [...sums.keys()].sort();
  for (const name of names) copyFileSync(join(from, name), join(out, name));
  writeFileSync(join(out, SUMS_FILE), names.map((name) => `${sums.get(name)}  ${name}\n`).join(''));
  return { packages: names.length };
}
