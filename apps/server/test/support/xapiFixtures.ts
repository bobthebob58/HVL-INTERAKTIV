/**
 * xapiFixtures — the curated xAPI statements of the ten real content types in `test/fixtures/xapi/`: how the probe
 * test writes them, how it tells that they still match the player, and how unit tests read them.
 *
 * Why: step 3's mapper (DATA-012), ingestion route (LTI-011) and bridge (LTI-010) need unit tests on what H5P really
 *      sends, not on hand-written statements; the browser test (probe P1, D-102) records them and fails when the
 *      player sends something the committed fixture no longer describes.
 * Spec: DATA-012, LTI-010, H5P-009
 * Invariants:
 *   - A fixture holds the content ID only as `{{contentId}}`; `readXapiFixture` puts a real one back.
 *   - Fixtures hold H5P's anonymous actor and the example's own texts; no learnerKey, host, port or personal data.
 *   - They are written only when `XAPI_FIXTURES_WRITE=1`; otherwise the test compares, so CI never rewrites them.
 * Collaborators: ../h5p/support/xapiCapture.ts (the captured statements), ../h5p/support/xapiStatementShape.ts.
 * Tests: apps/server/test/h5p/xapiQuestionTypes.browser.int.test.ts and xapiContainerTypes.browser.int.test.ts
 *   write and check them.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CapturedStatement } from '../h5p/support/xapiCapture.js';
import { subContentIdOf, verbOf, type XapiStatement } from '../h5p/support/xapiStatementShape.js';

/** Where the fixtures are. */
export const XAPI_FIXTURE_DIR = fileURLToPath(new URL('../fixtures/xapi/', import.meta.url));
/** What stands for the activity's content ID inside a fixture. */
export const CONTENT_ID_PLACEHOLDER = '{{contentId}}';

/** One statement in a fixture: the view (page load), the learner's step and the statement as H5P sent it. */
export interface XapiFixtureStatement {
  readonly view: number;
  readonly step: string;
  readonly statement: XapiStatement;
}

/** A fixture file. */
export interface XapiFixture {
  /** The main library, e.g. `H5P.MultiChoice 1.16`. */
  readonly library: string;
  /** `{{contentId}}` in the file; the real ID after `readXapiFixture` with one. */
  readonly contentId: string;
  /** The test that recorded it. */
  readonly recordedBy: string;
  /** What the learner did, step by step. */
  readonly actions: readonly string[];
  readonly statements: readonly XapiFixtureStatement[];
}

const fileOf = (type: string): string => join(XAPI_FIXTURE_DIR, `${type}.json`);
const swap = <T>(value: T, from: string, to: string): T =>
  JSON.parse(JSON.stringify(value).split(from).join(to)) as T;

/**
 * Builds a fixture from a captured play, with the content ID replaced by its placeholder.
 * @param library - The main library, e.g. `H5P.MultiChoice 1.16`.
 * @param contentId - The activity's content ID in this run.
 * @param actions - What the learner did.
 * @param captured - The statements in arrival order.
 * @returns The fixture.
 */
export function curateXapiFixture(
  library: string,
  contentId: string,
  actions: readonly string[],
  captured: readonly CapturedStatement[],
): XapiFixture {
  const statements = captured.map(({ view, step, statement }) => ({ view, step, statement }));
  return {
    library,
    contentId: CONTENT_ID_PLACEHOLDER,
    recordedBy: 'apps/server/test/h5p/support/xapiTypeRun.ts (probe P1)',
    actions,
    statements: swap(statements, contentId, CONTENT_ID_PLACEHOLDER),
  };
}

/**
 * The stable outline of a fixture: per view, every statement except `interacted`, sorted, without durations.
 * @param fixture - A fixture.
 * @returns One line per statement: view, item, verb, library, score, success and response.
 */
export function xapiFixtureOutline(fixture: XapiFixture): string[] {
  // WHY: H5P sends some statements from timers (pre-rendered BranchingScenario nodes), so the order within a view
  // may vary between runs; what is sent may not. The tests assert the orders that matter (onLoad, root results).
  return fixture.statements
    .filter(({ statement }) => verbOf(statement) !== 'interacted')
    .map(({ view, statement: st }) => {
      const library = st.context?.contextActivities?.category?.[0]?.id.split('/').pop() ?? 'no category';
      const score = st.result?.score ? `${st.result.score.raw}/${st.result.score.max}` : '';
      const success = st.result?.success === undefined ? '' : `success=${st.result.success}`;
      const response =
        st.result?.response === undefined ? '' : `response=${JSON.stringify(st.result.response)}`;
      const item =
        subContentIdOf(st) ?? (st.object.id === CONTENT_ID_PLACEHOLDER ? 'activity' : st.object.id);
      return [`view ${view}`, item, verbOf(st), library, score, success, response].filter(Boolean).join(' ');
    })
    .sort();
}

/**
 * Writes the fixture when `XAPI_FIXTURES_WRITE=1`; otherwise compares its outline with the committed file.
 * @param type - The fixture's name, the main library's machine name (e.g. `H5P.MultiChoice`).
 * @param fixture - What the player sent in this run.
 * @returns Empty when the committed fixture still describes the player, else why not.
 */
export function xapiFixtureDrift(type: string, fixture: XapiFixture): string[] {
  const file = fileOf(type);
  if (process.env.XAPI_FIXTURES_WRITE === '1') {
    writeFileSync(file, `${JSON.stringify(fixture, null, 2)}\n`);
    return [];
  }
  const regenerate = 'regenerate with XAPI_FIXTURES_WRITE=1 and review the diff (step 3 unit tests read it)';
  if (!existsSync(file)) return [`${type}.json is missing; ${regenerate}`];
  const committed = JSON.parse(readFileSync(file, 'utf8')) as XapiFixture;
  if (committed.library !== fixture.library)
    return [
      `${type}.json was recorded with ${committed.library}, the player runs ${fixture.library}; ${regenerate}`,
    ];
  if (JSON.stringify(committed.actions) !== JSON.stringify(fixture.actions))
    return [`${type}.json was recorded for other learner steps than the script now takes; ${regenerate}`];
  const [was, now] = [xapiFixtureOutline(committed), xapiFixtureOutline(fixture)];
  const first = Array.from({ length: Math.max(was.length, now.length) }, (_, i) => i).find(
    (i) => was[i] !== now[i],
  );
  if (first === undefined) return [];
  return [
    `${type}.json no longer matches the player at outline line ${first}: the fixture has "${was[first] ?? '(nothing)'}", ` +
      `the player sent "${now[first] ?? '(nothing)'}"; ${regenerate}`,
  ];
}

/**
 * Reads a fixture, optionally with a real content ID in place of the placeholder.
 * @param type - The main library's machine name, e.g. `H5P.MultiChoice`.
 * @param contentId - The content ID to put in; the placeholder stays when omitted.
 * @returns The fixture.
 * @throws When the file does not exist.
 */
export function readXapiFixture(type: string, contentId: string = CONTENT_ID_PLACEHOLDER): XapiFixture {
  const fixture = JSON.parse(readFileSync(fileOf(type), 'utf8')) as XapiFixture;
  return swap(fixture, CONTENT_ID_PLACEHOLDER, contentId);
}
