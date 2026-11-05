/**
 * testIndex — finds the running tests of the repository by the IDs their titles open with, so each check of the
 * evidence map links to the files and titles that carry it.
 *
 * Why: UD-040 links every criterion to its tests. Reading the titles the way spec-trace and doc-lint read them
 *      (DOC-004, DOC-006) keeps the report's links and the traceability matrix in agreement, and a check that matches
 *      no test any more stops the generator instead of linking to nothing.
 * Spec: UD-040, DOC-004
 * Invariants:
 *   - Only running it()/test() titles count (not describe, skip, todo or fails), from the files doc-lint calls tests.
 *   - A title matches a check when every ID of the check is in the bracket group that opens it (validator rule IDs
 *     such as `V-IMG-ALT` included) and, when the check has `contains`, it holds one of those texts.
 *   - A suite check looks only in its own file in apps/server/a11y/; any other check never looks there.
 *   - Files are in path order and titles in source order, so the links never change between runs.
 *   - A test file runs in `npm test` unless its folder has a command of its own (apps/server/e2e/, apps/server/live/:
 *     their Vitest configs, which the root run does not load), so the report never sends a reader to the wrong one.
 * Collaborators: ../spec-trace/testTitles.mjs, ../doc-lint/lib/repo.mjs, ./renderCriterion.mjs, ./runResults.mjs.
 * Tests: tools/a11y-report/test/a11yReport.test.mjs
 */
import { isTestFile, listFiles, read, SOURCE_ROOTS } from '../doc-lint/lib/repo.mjs';
import { testTitles } from '../spec-trace/testTitles.mjs';

/** The folder of the accessibility suite (`npm run test:a11y`). */
export const SUITE_DIR = 'apps/server/a11y';

/** The command of the root Vitest run (vitest.config.mjs), which runs every other test file. */
export const NPM_TEST = 'npm test';

/**
 * The test folders outside the suite with a command of their own: apps/server's other Vitest configs, which
 * `npm test` does not load.
 */
export const OWN_COMMANDS = [
  { dir: 'apps/server/e2e', command: 'npm run test:e2e' },
  { dir: 'apps/server/live', command: 'npm run test:live' },
];

/**
 * The command that runs a test file outside the accessibility suite.
 * @param {string} file - Repository-relative path of a test file.
 * @returns {string} Its folder's own command, else {@link NPM_TEST}.
 */
export const commandOf = (file) =>
  OWN_COMMANDS.find(({ dir }) => file.startsWith(`${dir}/`))?.command ?? NPM_TEST;

/**
 * The bracketed IDs that open a title: `[UD-021][V-IMG-ALT] …` gives `UD-021` and `V-IMG-ALT`.
 * @param {string} title - A test title.
 * @returns {string[]} The IDs, or none when the title does not open with brackets.
 */
export function openingIds(title) {
  const group = /^(?:\[[A-Z][A-Z0-9-]*\])+/.exec(title)?.[0] ?? '';
  return [...group.matchAll(/\[([A-Z][A-Z0-9-]*)\]/g)].map((m) => m[1]);
}

/**
 * Whether a title holds one of the texts a check narrows by.
 * @param {string} title - A test title.
 * @param {string | string[] | undefined} contains - The text or texts; none means every title.
 * @returns {boolean} True when it holds one, or when there is nothing to hold.
 */
export const holdsText = (title, contains) =>
  contains === undefined || (Array.isArray(contains) ? contains : [contains]).some((c) => title.includes(c));

/**
 * Whether a test title belongs to a check.
 * @param {string} title - A test title (in the source, or as the run printed it).
 * @param {{match: string[], contains?: string | string[]}} check - A check of the evidence map.
 * @returns {boolean} True when it opens with every ID of the check and holds its text.
 */
export function titleMatches(title, check) {
  const ids = openingIds(title);
  return check.match.every((id) => ids.includes(id)) && holdsText(title, check.contains);
}

/**
 * Lists the running test titles of every test file.
 * @param {string} root - Repository root.
 * @returns {{file: string, titles: string[]}[]} Files that have any running test, in path order.
 */
export function indexTests(root) {
  return SOURCE_ROOTS.flatMap((dir) => listFiles(root, dir))
    .filter(isTestFile)
    .map((file) => ({
      file,
      titles: testTitles(read(root, file))
        .filter((t) => t.active && t.fn !== 'describe')
        .map((t) => t.title),
    }))
    .filter((f) => f.titles.length > 0);
}

/**
 * The tests of one check.
 * @param {{file: string, titles: string[]}[]} index - From indexTests.
 * @param {{suite?: string, path?: string, match: string[], contains?: string | string[]}} check - The check.
 * @returns {{file: string, titles: string[]}[]} Each file with the titles that match, in path order.
 */
export function testsOfCheck(index, check) {
  const inSuite = (file) => file.startsWith(`${SUITE_DIR}/`);
  const files = check.suite
    ? index.filter((f) => f.file === `${SUITE_DIR}/${check.suite}`)
    : index.filter((f) => !inSuite(f.file) && (!check.path || f.file.includes(check.path)));
  return files
    .map((f) => ({ file: f.file, titles: f.titles.filter((t) => titleMatches(t, check)) }))
    .filter((f) => f.titles.length > 0);
}
