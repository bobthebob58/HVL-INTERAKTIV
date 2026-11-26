/**
 * installScriptRules — holds the packages that run a script at install to the reviewed list in the root
 * package.json (`allowScripts`), and holds npm to that list.
 *
 * Why: an install script is code of a dependency that runs on the build machine with the builder's rights, before
 *      any of our code. npm keeps a reviewed list of them (`allowScripts`), but by default a script outside the
 *      list still runs, with a notice. `strict-allow-scripts=true` turns the notice into a failed install, and this
 *      check shows the same thing from the files alone: before anything is installed, and whatever npm runs the
 *      install (SEC-007, D-145).
 * Spec: SEC-007
 * Invariants:
 *   - Every package of the lock file with `hasInstallScript` stands in `allowScripts` as `name@version`, with
 *     `true` (the script may run) or `false` (it is skipped): a new script, or a new version of a package with
 *     one, is a reviewed change of the list.
 *   - Every entry of `allowScripts` names such a package, so the list never holds a stale approval.
 *   - `.npmrc` at the repository root sets `strict-allow-scripts=true` and does not allow every script.
 *   - Pure checks of file contents: each function returns problems as text and an empty list when all is well.
 * Collaborators: ./checkLockfile.mjs, package.json (`allowScripts`), package-lock.json, .npmrc, deploy/Dockerfile
 *                (copies `.npmrc` before its `npm ci`).
 * Tests: tools/dependency-check/test/installScriptRules.test.mjs
 */

const ENTRY = /^(@[a-z0-9~][a-z0-9._~-]*\/)?[a-z0-9~][a-z0-9._~-]*@\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

/**
 * Lists the packages of a lock file that run a script at install.
 * @param {{packages?: Record<string, {version?: string, hasInstallScript?: boolean}>}} lock - Parsed lock file.
 * @returns {string[]} `name@version` of each, sorted and without repeats.
 */
export function scriptedPackages(lock) {
  const found = Object.entries(lock.packages ?? {})
    .filter(([, entry]) => entry.hasInstallScript === true)
    .map(([key, entry]) => `${key.split('node_modules/').pop()}@${entry.version}`);
  return [...new Set(found)].sort();
}

/**
 * Compares the packages with an install script with the reviewed list, both ways.
 * @param {object} lock - Parsed package-lock.json.
 * @param {{allowScripts?: Record<string, unknown>}} manifest - Parsed root package.json.
 * @returns {string[]} Problems.
 */
export function installScriptProblems(lock, manifest) {
  const problems = [];
  const reviewed = manifest.allowScripts ?? {};
  for (const [key, value] of Object.entries(reviewed))
    if (!ENTRY.test(key) || typeof value !== 'boolean')
      problems.push(`package.json: allowScripts: "${key}" must be name@version with true or false`);
  const scripted = scriptedPackages(lock);
  for (const name of scripted.filter((entry) => !(entry in reviewed)))
    problems.push(
      `${name}: has an install script that allowScripts does not name; review it, then allow or deny it`,
    );
  for (const key of Object.keys(reviewed).filter((entry) => !scripted.includes(entry)))
    problems.push(
      `package.json: allowScripts names ${key}, which has no install script in the lock file; remove it`,
    );
  return problems;
}

/**
 * Reads the settings of an `.npmrc` file: `key=value` lines, without comments.
 * @param {string} text - The file's text.
 * @returns {Map<string, string>} Each setting's last value.
 */
export function npmrcSettings(text) {
  const settings = new Map();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;
    const at = trimmed.indexOf('=');
    const key = (at < 0 ? trimmed : trimmed.slice(0, at)).trim();
    // WHY: npm reads a key without a value as `true`.
    const value =
      at < 0
        ? 'true'
        : trimmed
            .slice(at + 1)
            .trim()
            .replace(/^(["'])(.*)\1$/, '$2');
    settings.set(key, value);
  }
  return settings;
}

/**
 * Checks that the project's npm settings refuse an install script outside the reviewed list.
 * @param {string | undefined} text - The text of `.npmrc`; undefined when the file is missing.
 * @returns {string[]} Problems.
 */
export function npmrcProblems(text) {
  const settings = npmrcSettings(text ?? '');
  const problems = [];
  if (settings.get('strict-allow-scripts') !== 'true')
    problems.push(
      '.npmrc: must set strict-allow-scripts=true, so a script outside allowScripts stops the install',
    );
  // SECURITY: this setting switches the reviewed list off for every install of the project.
  if (
    settings.has('dangerously-allow-all-scripts') &&
    settings.get('dangerously-allow-all-scripts') !== 'false'
  )
    problems.push('.npmrc: must not set dangerously-allow-all-scripts');
  return problems;
}
