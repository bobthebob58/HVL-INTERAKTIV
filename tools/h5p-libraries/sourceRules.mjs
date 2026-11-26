/**
 * sourceRules — the forms a library's name, version, repository, ref and commit must have before any of them
 * reaches `git` or a folder name.
 *
 * Why: the resolver reads repository addresses from H5P's public registry, and library names and versions from the
 *      `library.json` and `semantics.json` of repositories it has just fetched. None of that text is ours. Passed on
 *      as it is, an address that starts with `-` is read by git as an option, an address in another form reaches
 *      another transport or a local path, and a name such as `../x` joins to a folder outside the work folder, which
 *      a checkout removes first (D-143). The committed pin list is held to the same rules when it is read, so a line
 *      edited by hand can do no more than a line of the registry.
 * Spec: H5P-003
 * Invariants:
 *   - A repository is `https://github.com/<owner>/<name>`: owner and name start with a letter or digit and hold
 *     only letters, digits, `.`, `_` and `-`. Nothing else is fetched, whatever the registry says.
 *   - A machine name is 1 to 100 characters: parts of letters, digits, `_` and `-`, joined by single dots, starting
 *     with a letter or digit. It holds no path separator and is never `.` or `..`.
 *   - A version part is a whole number from 0 to 99 999, as a number (text is refused, so nothing but digits can
 *     reach a folder name).
 *   - A ref is `HEAD`, `refs/tags/x.y.z`, `refs/tags/vx.y.z` or a full commit; a commit is 40 lower-case hex
 *     characters.
 *   - Every function returns what it was given or throws an Error that names the value's role; the error is not
 *     `transient`, so the resolver never retries it.
 * Collaborators: ./resolveManifest.mjs, ./gitSource.mjs, ./fetchLibraries.mjs.
 * Tests: tools/h5p-libraries/test/sourceRules.test.mjs, tools/h5p-libraries/test/resolveManifest.test.mjs,
 *   tools/h5p-libraries/test/gitSource.test.mjs, tools/h5p-libraries/test/manifest.test.mjs
 */

const REPOSITORY = /^https:\/\/github\.com\/[A-Za-z0-9][\w.-]{0,99}\/[A-Za-z0-9][\w.-]{0,99}$/;
const MACHINE_NAME = /^[A-Za-z0-9][\w-]*(\.[\w-]+)*$/;
const TAG_REF = /^refs\/tags\/v?\d{1,5}\.\d{1,5}\.\d{1,5}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const VERSION = /^\d{1,5}\.\d{1,5}\.\d{1,5}$/;

/** A short, one-line form of a refused value for an error message. */
const shown = (value) => JSON.stringify(typeof value === 'string' ? value.slice(0, 80) : value);

const refuse = (role, value) => {
  throw new Error(`${role} ${shown(value)} does not have the form a library source may have`);
};

const matching = (pattern, role) => (value) =>
  typeof value === 'string' && pattern.test(value) ? value : refuse(role, value);

/**
 * Checks a repository address before git is given it.
 * @param {unknown} repository - The address, e.g. from the registry or the pin list.
 * @returns {string} The address.
 * @throws {Error} When it is not `https://github.com/<owner>/<name>`.
 */
export const checkedRepository = matching(REPOSITORY, 'repository');

/**
 * Checks a full commit hash.
 * @param {unknown} commit - The hash.
 * @returns {string} The hash.
 * @throws {Error} When it is not 40 lower-case hex characters.
 */
export const checkedCommit = matching(COMMIT, 'commit');

/**
 * Checks a library's machine name before it becomes part of a folder name.
 * @param {unknown} machineName - The name, e.g. `H5P.MultiChoice`.
 * @returns {string} The name.
 * @throws {Error} When it is not a plain machine name.
 */
export function checkedMachineName(machineName) {
  const name = matching(MACHINE_NAME, 'machine name')(machineName);
  return name.length <= 100 ? name : refuse('machine name', machineName);
}

/**
 * Checks one part of a version (major, minor or patch).
 * @param {unknown} part - The part.
 * @returns {number} The part.
 * @throws {Error} When it is not a whole number from 0 to 99 999.
 */
export const checkedVersionPart = (part) =>
  Number.isInteger(part) && part >= 0 && part <= 99_999 ? part : refuse('version', part);

/**
 * Checks what git is asked to fetch from a repository.
 * @param {unknown} ref - `HEAD`, a version tag's ref or a full commit.
 * @returns {string} The ref.
 * @throws {Error} When it is none of these.
 */
export const checkedRef = (ref) =>
  ref === 'HEAD' || (typeof ref === 'string' && (TAG_REF.test(ref) || COMMIT.test(ref)))
    ? ref
    : refuse('ref', ref);

/**
 * The folder a library is checked out into: `<machineName>-<major>.<minor>`.
 * @param {unknown} machineName - The library's machine name.
 * @param {unknown} majorVersion - Its major version.
 * @param {unknown} minorVersion - Its minor version.
 * @returns {string} The folder name, one path segment.
 * @throws {Error} When the name or a version part does not have its form.
 */
export const libraryFolder = (machineName, majorVersion, minorVersion) =>
  `${checkedMachineName(machineName)}-${checkedVersionPart(majorVersion)}.${checkedVersionPart(minorVersion)}`;

/**
 * The repository the registry names for a library.
 * @param {object} registry - The registry's `libraries.json`: machine name → `{ repo: { url } }`.
 * @param {string} machineName - The library.
 * @returns {string | undefined} The checked address; undefined when the registry does not list the library.
 * @throws {Error} When the registry's address does not have the form of a repository.
 */
export function registryRepository(registry, machineName) {
  // WHY: `hasOwn`, so a name such as `constructor` finds no inherited property.
  const url = Object.hasOwn(registry, machineName) ? registry[machineName]?.repo?.url : undefined;
  return url === undefined || url === null || url === '' ? undefined : checkedRepository(url);
}

/**
 * Checks one line of the pin list (`libraries.manifest.json`) before it is fetched.
 * @param {object} entry - `{ machineName, version, repository, ref, commit, build }`.
 * @returns {object} The entry.
 * @throws {Error} When a field does not have its form, naming the library where it can.
 */
export function checkedManifestEntry(entry) {
  try {
    checkedMachineName(entry?.machineName);
    matching(VERSION, 'version')(entry.version);
    checkedRepository(entry.repository);
    checkedCommit(entry.commit);
    if (entry.ref !== 'HEAD') matching(TAG_REF, 'ref')(entry.ref);
    if (typeof entry.build !== 'boolean') refuse('build flag', entry.build);
    return entry;
  } catch (error) {
    throw new Error(`pin list line ${shown(entry?.machineName)}: ${error.message}`, { cause: error });
  }
}
