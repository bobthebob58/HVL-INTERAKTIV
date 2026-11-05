/**
 * evidenceShapes — the two kinds of check the evidence map names, and the views the accessibility suite opens, in
 * the words the report uses.
 *
 * Why: UD-040 asks, per success criterion, how it is tested and in which views. The suite's own checks are judged by
 *      the last full run; every other test (unit, component, browser) runs in `npm test` and is linked. One builder
 *      per kind keeps the map's ~100 entries uniform and short.
 * Spec: UD-040
 * Invariants:
 *   - A suite check names a file in apps/server/a11y/ and the IDs its test titles open with; its result comes from
 *     the run summary only.
 *   - A test check names IDs (all must open a title, e.g. `[UD-021][V-IMG-ALT]`) and is never a suite file; `path`
 *     and `contains` narrow it to files and titles that hold those texts.
 *   - `contains` is one text or a list of texts, of which a title must hold one.
 * Collaborators: ./evidencePerceivable.mjs, ./evidenceOperable.mjs, ./evidenceUnderstandableRobust.mjs,
 *   ./testIndex.mjs, ./renderCriterion.mjs.
 * Tests: tools/a11y-report/test/a11yReport.test.mjs
 */

/**
 * A check of the accessibility suite (`npm run test:a11y`).
 * @param {string} file - The suite file in apps/server/a11y/, e.g. `keyboardFocus.a11y.test.ts`.
 * @param {string[]} match - IDs its test titles open with.
 * @param {string} how - What it checks.
 * @param {string} views - Where it checks it.
 * @param {string | string[]} [contains] - A text (or one of several) the test's name holds, to pick some of the
 *   file's tests.
 * @returns {{suite: string, match: string[], how: string, views: string, contains?: string | string[]}} The check.
 */
export const suiteCheck = (file, match, how, views, contains) => ({
  suite: file,
  match,
  how,
  views,
  ...(contains ? { contains } : {}),
});

/**
 * A check by other tests (unit, component, browser) that run in `npm test`.
 * @param {string[]} match - IDs their titles open with; all must be there.
 * @param {string} how - What they check.
 * @param {{path?: string, contains?: string | string[]}} [narrow] - Only files whose path, and titles whose text,
 *   hold these.
 * @returns {{match: string[], how: string, path?: string, contains?: string | string[]}} The check.
 */
export const testCheck = (match, how, narrow = {}) => ({ match, how, ...narrow });

/** The web app's views as the suites open them (apps/server/a11y/support/catalogue.ts). */
export const WEB_VIEWS =
  'the web app’s pages signed out and as the author, an activity’s «Spel», «Rediger» and «Sjekk og publiser» ' +
  'tabs, the Canvas page `/app/play` and the studio’s seeded pages';

/** The player of the ten content types. */
export const PLAYERS =
  'the player of each of the ten content types in Canvas, fresh and started and answered';

/** Both of the above. */
export const WEB_AND_PLAYERS = `${WEB_VIEWS}; ${PLAYERS}`;
