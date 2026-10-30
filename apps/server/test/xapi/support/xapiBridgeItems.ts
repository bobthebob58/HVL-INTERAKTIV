/**
 * xapiBridgeItems — turns probe P1's recorded statements (../../fixtures/xapi/) into batch items the way the player
 * bridge numbers them: a `statementId` per statement and an `attemptId` of `<viewId>:<n>` per page load (D-115).
 *
 * Why: the DATA-012 mapper and D-115's rules must be tested on what H5P really sends, with attempt IDs as the bridge
 *      makes them. The items keep every field H5P sent (actor, texts, extensions), as an unfiltered client might post
 *      them, so the tests also prove that the server drops what the bridge would never send.
 * Spec: DATA-012, LTI-011
 * Invariants:
 *   - One `viewId` per recorded view (page load); `n` starts at 1 and goes up right after a root result with
 *     `score.max` above 0, the bridge's rule (D-115), judged with the server's own root tests.
 *   - `bridgeOnly` keeps what the bridge sends: the first root `attempted` of a view, every `answered`, and a root
 *     `completed`.
 *   - The fixtures hold no personal data; the IDs made here are random.
 * Collaborators: ../../support/xapiFixtures.ts, ../../../src/xapi/xapiRootTests.ts.
 * Tests: apps/server/test/xapi/xapiBatchPlan.test.ts, apps/server/test/xapi/xapiIngest.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import { xapiStatementItemSchema } from '@hvl-interaktiv/api-contract';
import {
  isRootResult,
  isRootStatement,
  mainLibraryCategory,
  verbOf,
} from '../../../src/xapi/xapiRootTests.js';
import { readXapiFixture, type XapiFixture } from '../../support/xapiFixtures.js';

/** A statement as posted to `/api/h5p/xapi`: H5P's own fields plus the bridge's two IDs. */
export type PostedStatement = Record<string, unknown> & { statementId: string; attemptId: string };

/** One view (page load) of a fixture, as posted. */
export interface PostedView {
  readonly view: number;
  readonly viewId: string;
  readonly statements: PostedStatement[];
}

/** A fixture read for a test activity. */
export interface FixturePlay {
  readonly fixture: XapiFixture;
  /** The main library with its version, e.g. `H5P.MultiChoice 1.16`. */
  readonly ubername: string;
  /** Its machine name, e.g. `H5P.MultiChoice`. */
  readonly machineName: string;
  readonly views: readonly PostedView[];
}

/**
 * Reads a fixture for an activity and numbers its statements as the bridge would.
 * @param type - The fixture's name, e.g. `H5P.CoursePresentation`.
 * @param contentId - The test activity's ID.
 * @param options - `bridgeOnly`: keep only what the bridge sends.
 * @returns The fixture and its views as posted.
 */
export function fixturePlay(
  type: string,
  contentId: string,
  options: { bridgeOnly?: boolean } = {},
): FixturePlay {
  const fixture = readXapiFixture(type, contentId);
  const [machineName = '', version = ''] = fixture.library.split(' ');
  const category = mainLibraryCategory(fixture.library);
  const views = [...new Set(fixture.statements.map((s) => s.view))].map((view) => {
    const viewId = randomUUID();
    let n = 1;
    let attempted = false;
    const statements: PostedStatement[] = [];
    for (const recorded of fixture.statements.filter((s) => s.view === view)) {
      const posted = { ...recorded.statement, statementId: randomUUID(), attemptId: `${viewId}:${n}` };
      const item = xapiStatementItemSchema.parse(posted);
      const root = isRootStatement(item, contentId);
      const verb = verbOf(item);
      const sent =
        verb === 'answered' || (root && (verb === 'completed' || (verb === 'attempted' && !attempted)));
      if (root && verb === 'attempted') attempted = true;
      if (sent || !options.bridgeOnly) statements.push(posted);
      if (sent && isRootResult(item, contentId, category) && (item.result?.score?.max ?? 0) > 0) n += 1;
    }
    return { view, viewId, statements };
  });
  return { fixture, ubername: `${machineName} ${version}`, machineName, views };
}

/**
 * A short line per stored row, for comparing with an expected table.
 * @param row - A stored or planned row.
 * @param row.verb - Its verb.
 * @param row.subContentId - Its part, or null at the root.
 * @param row.scoreRaw - Its raw score.
 * @param row.scoreMax - Its maximum.
 * @param row.attemptId - Its attempt, `<viewId>:<n>`.
 * @returns e.g. `answered root 1/1 #1` or `answered part …7a11 1/1 #1` (the part's last four characters).
 */
export function rowLine(row: {
  verb: string;
  subContentId: string | null;
  scoreRaw: number | null;
  scoreMax: number | null;
  attemptId: string;
}): string {
  const where = row.subContentId === null ? 'root' : `part …${row.subContentId.slice(-4)}`;
  const score = row.scoreRaw === null ? '' : ` ${row.scoreRaw}/${row.scoreMax ?? '-'}`;
  return `${row.verb} ${where}${score} #${row.attemptId.split(':')[1] ?? ''}`;
}
