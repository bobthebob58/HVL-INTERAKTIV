/**
 * learnerStateAfterEditBench — a server with the real content types where an author's edit keeps the learner state
 * rows, so probe P3 can see what a learner meets when an activity changed under their saved state.
 *
 * Why: today every save deletes the state H5P marks as invalidated (D-038, HvlH5PEditor.saveOrUpdateContent). PROD-013
 *      keeps state after non-structural edits (D-093), so the probe must observe resume behaviour after each kind of
 *      edit. It saves through `saveOrUpdateContentReturnMetaData`, which runs every HVL save check but never touches
 *      learner state, and it puts the learner's saved row back before each edit is played.
 * Spec: PROD-013, H5P-005
 * Invariants:
 *   - Activities are the packages' own examples, imported with their files and published, so learners may view them.
 *   - Every row and object the bench creates is removed by `close()` (the testbed deletes activities, whose state
 *     cascades, users, buckets and the library folder).
 * Collaborators: ../../support/httpTestbed.ts, ../../support/realPackages.ts, ../../support/loopbackServers.ts,
 *   ../../../src/h5p/HvlH5PEditor.ts.
 * Tests: ./learnerStateAfterEdit.browser.int.test.ts, ./learnerStateAfterEditComposite.browser.int.test.ts,
 *   ./learnerStateAfterEditNavigation.browser.int.test.ts, ./learnerStateAfterEditPaths.browser.int.test.ts
 */
import { join } from 'node:path';
import type { ContentParameters, IContentMetadata } from '@lumieducation/h5p-server';
import { asAccountUser } from '../../../src/h5p/HvlH5pUser.js';
import { closeLoopbackServers, listenOnLoopback } from '../../support/loopbackServers.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../../support/httpTestbed.js';
import { packageExamples, REAL_PACKAGES_DIR, type PackageExample } from '../../support/realPackages.js';

/** One imported example activity. */
export interface BenchActivity {
  /** The activity ID. */
  readonly id: string;
  /** The main library as `H5P.Name major.minor`. */
  readonly ubername: string;
  /** The example's parameters as imported (never mutated; edits work on copies). */
  readonly params: Readonly<Record<string, unknown>>;
  /** Title, licence and language from the package. */
  readonly metadata: PackageExample['metadata'];
}

/** A learner state row as stored, without its database ID and timestamp. */
export interface StateRowSnapshot {
  readonly subContentId: string;
  readonly dataType: string;
  readonly learnerKey: string;
  readonly contextId: string;
  readonly data: unknown;
  readonly preload: boolean;
  readonly invalidate: boolean;
}

/** The running bench. */
export interface StateBench {
  readonly tb: HttpTestbed;
  /** `http://127.0.0.1:<port>`. */
  readonly base: string;
  readonly author: TestActor;
  readonly learner: TestActor;
  /** Imports the example of one type (e.g. `H5P.MultiChoice`) as a published activity. */
  importExample(machineName: string): Promise<BenchActivity>;
  /** Saves new parameters as the author with every HVL check, keeping all learner state rows. */
  saveParams(activity: BenchActivity, params: object): Promise<void>;
  /** The learner state rows of an activity, as stored. */
  stateRows(contentId: string): Promise<StateRowSnapshot[]>;
  /**
   * Waits until H5P's autosave (every 5 s, D-037) has stored a main state that passes `saved`.
   * @param contentId - The activity.
   * @param saved - Tells whether the parsed state holds the learner's answers yet.
   * @returns Every state row of the activity, as stored.
   * @throws Error after 30 s without such a row (a few autosave rounds on a busy runner).
   */
  savedRows(contentId: string, saved: (state: unknown) => boolean): Promise<StateRowSnapshot[]>;
  /** Replaces the learner state rows of an activity with a snapshot. */
  restoreRows(contentId: string, rows: readonly StateRowSnapshot[]): Promise<void>;
  /** Stops the server and removes everything the bench created. */
  close(): Promise<void>;
}

/**
 * A deep copy of an example's parameters, to edit.
 * @param params - The parameters.
 * @returns A copy that shares nothing with the original.
 */
export const copyParams = <T>(params: T): T => structuredClone(params);

/**
 * Seeds the real packages into a fresh testbed and starts listening.
 * @returns The bench; call `close()` in `afterAll`.
 */
export async function openStateBench(): Promise<StateBench> {
  const tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
  const author = await tb.actor('author');
  const learner = await tb.actor('learner');
  const examples = await packageExamples();
  const base = await listenOnLoopback(tb.app);
  const stateRows = (contentId: string): Promise<StateRowSnapshot[]> =>
    tb.db.h5PUserData.findMany({
      where: { contentId },
      orderBy: { subContentId: 'asc' },
      select: {
        ...{ subContentId: true, dataType: true, learnerKey: true, contextId: true },
        ...{ data: true, preload: true, invalidate: true },
      },
    });
  return {
    tb,
    base,
    author,
    learner,
    importExample: async (machineName) => {
      const example = examples.find((e) => e.library.startsWith(`${machineName} `));
      if (!example) throw new Error(`no real package for ${machineName}`);
      const id = await tb.importPackage(author, join(REAL_PACKAGES_DIR, example.file), { published: true });
      const params = (await tb.db.h5PContent.findUniqueOrThrow({ where: { id } })).params;
      return {
        id,
        ubername: example.library,
        params: params as Record<string, unknown>,
        metadata: example.metadata,
      };
    },
    saveParams: async (activity, params) => {
      // WHY: the ReturnMetaData variant runs permission, library, sub-content and file checks but, unlike
      // saveOrUpdateContent, never deletes invalidated learner state (D-038), which is what the probe must keep.
      await tb.runtime.editor.saveOrUpdateContentReturnMetaData(
        activity.id,
        params as ContentParameters,
        activity.metadata as IContentMetadata,
        activity.ubername,
        asAccountUser(author.actor),
      );
    },
    stateRows,
    savedRows: async (contentId, saved) => {
      const deadline = Date.now() + 30_000;
      for (;;) {
        const rows = await stateRows(contentId);
        const main = rows.find((row) => row.subContentId === '0' && row.dataType === 'state');
        if (main && saved(JSON.parse(String(main.data)))) return rows;
        if (Date.now() > deadline) throw new Error(`no matching saved state: ${JSON.stringify(rows)}`);
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    },
    restoreRows: async (contentId, rows) => {
      await tb.db.h5PUserData.deleteMany({ where: { contentId } });
      await tb.db.h5PUserData.createMany({
        data: rows.map((row) => ({ ...row, contentId, data: row.data as string })),
      });
    },
    close: async () => {
      await closeLoopbackServers();
      await tb.close();
    },
  };
}
