/**
 * safeEditingBench — the whole app (`createApp`) with the ten real content types, a Feide author signed in on the
 * portal, the author's imported example activities, and helpers to save, copy and write learner state through the
 * real routes, for the safe-editing integration tests.
 *
 * Why: PROD-013's integration tests (D-093) must see the editor's learner-state step, the publish gate, the player
 *      pages' version and the state route exactly as a browser meets them: through `/h5p` with the session cookie
 *      and the CSRF token, or with a Canvas ltik, on the real libraries' parameters.
 * Spec: PROD-013
 * Invariants:
 *   - The libraries are installed through the seed path (D-078) and the activities through the package import, as
 *     the author signed in for this run (./../../support/runFeideAuthor.ts).
 *   - "Another learner's" state is a row with a fresh pseudonym (../../support/learnerStateFixtures.ts); the
 *     author's own state is written through the state route, so it is keyed as the route keys it.
 *   - `close` removes the seed audit rows this run wrote and the library folder; the app test bed removes the
 *     author's activities (copies included), whose state rows cascade.
 * Collaborators: ../../support/appTestbed.ts, ../../support/feideTestbed.ts, ../../support/ltiLaunchDriver.ts,
 *   ../../support/realPackages.ts, ../../support/testLibraryAuditSink.ts.
 * Tests: ./safeEditing.int.test.ts, ./safeEditingFailures.int.test.ts, ./staleStateWrites.int.test.ts,
 *   ./saveAsCopy.int.test.ts
 */
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import request, { type Response } from 'supertest';
import { CANVAS_USERS } from '../../../../../tools/mock-platform/mockPlatform.mjs';
import { asAccountUser } from '../../../src/h5p/HvlH5pUser.js';
import { LibraryInstaller } from '../../../src/h5p/libraries/LibraryInstaller.js';
import { seedLibraries } from '../../../src/h5p/libraries/seedLibraries.js';
import { openAppTestbed, type AppTestbed } from '../../support/appTestbed.js';
import { loginWithFeide } from '../../support/feideTestbed.js';
import { newLearner } from '../../support/learnerStateFixtures.js';
import { launchFromCanvas } from '../../support/ltiLaunchDriver.js';
import { packageExamples, REAL_PACKAGES_DIR } from '../../support/realPackages.js';
import { AUTHOR_KEY } from '../../support/runFeideAuthor.js';
import { TestLibraryAuditSink } from '../../support/testLibraryAuditSink.js';
import { testActor } from '../../support/testActors.js';

/** An imported example activity of the author. */
export interface BenchActivity {
  readonly id: string;
  /** `H5P.Name major.minor`. */
  readonly library: string;
  /** The parameters as stored after the import. */
  readonly params: Record<string, unknown>;
  readonly metadata: object;
}

/** Who sends a state write: the portal author (cookie and CSRF token) or a Canvas launch (its ltik). */
export type StateWriter = { readonly ltik: string } | 'author';

/** The running bench. */
export interface SafeEditingBench {
  readonly tb: AppTestbed;
  /** The author's `__Host-hvli_sid` cookie and CSRF token. */
  readonly author: { readonly cookie: string; readonly csrf: string };
  /** Imports a package's example as the author; `published` also publishes it to all of HVL. */
  importExample(machineName: string, options?: { readonly published?: boolean }): Promise<BenchActivity>;
  /** `PUT /h5p/content/:id` as the author, with the body's extra fields (e.g. `confirmLearnerStateReset`). */
  save(activity: BenchActivity, params: object, extra?: object): Promise<Response>;
  /** `POST /h5p/content/:id/copy` as the author, or with an ltik as Bearer. */
  copy(activity: BenchActivity, params: object, ltik?: string): Promise<Response>;
  /** `POST /h5p/contentUserData/:id/state/0` with `contentVersion` when given. */
  writeState(activity: BenchActivity, writer: StateWriter, data: string, version?: string): Promise<Response>;
  /** Stores a state row of a learner who is not the author; returns its learnerKey. */
  addOtherLearnersState(activity: BenchActivity): Promise<string>;
  /** A Canvas launch of the activity by `student` or `teacher`; returns the ltik. */
  launch(activity: BenchActivity, who: 'student' | 'teacher'): Promise<string>;
  /** The stored activity row. */
  stored(id: string): Promise<{ params: unknown; version: number; status: string }>;
  /** The learner keys of the activity's state rows, sorted. */
  stateKeys(id: string): Promise<string[]>;
  close(): Promise<void>;
}

/**
 * Starts the app with the real content types and signs the run's Feide author in.
 * @returns The bench; call `close` in `afterAll`.
 */
export async function openSafeEditingBench(): Promise<SafeEditingBench> {
  const tb = await openAppTestbed([], { runAuthor: true });
  const { packageImporter, libraryManager } = tb.runtime.editor;
  const seedAudit = new TestLibraryAuditSink(tb.db);
  await seedLibraries(REAL_PACKAGES_DIR, new LibraryInstaller(packageImporter, seedAudit, libraryManager));
  const login = await loginWithFeide({ app: tb.app, feide: tb.mock.feide }, AUTHOR_KEY);
  const cookie = login.sessionCookie ?? '';
  const csrf = String((await request(tb.app).get('/auth/session').set('Cookie', cookie)).body.csrfToken);
  const owner = asAccountUser(testActor('author', { accountId: await tb.feideAccount(AUTHOR_KEY) }));
  const examples = await packageExamples();
  let launches = 0;
  const asAuthor = (call: request.Test) => call.set('Cookie', cookie).set('X-CSRF-Token', csrf);
  return {
    tb,
    author: { cookie, csrf },
    importExample: async (machineName, options = {}) => {
      const example = examples.find((e) => e.library.startsWith(`${machineName} `));
      if (!example) throw new Error(`no real package for ${machineName}`);
      const { id } = await packageImporter.addPackageLibrariesAndContent(
        join(REAL_PACKAGES_DIR, example.file),
        owner,
      );
      const status = options.published ? 'published' : 'draft';
      const visibility = options.published ? 'organisation' : 'private';
      const row = await tb.db.h5PContent.update({ where: { id: String(id) }, data: { status, visibility } });
      return {
        id: row.id,
        library: example.library,
        params: row.params as Record<string, unknown>,
        metadata: row.metadata as object,
      };
    },
    save: (activity, params, extra = {}) =>
      asAuthor(request(tb.app).put(`/h5p/content/${activity.id}`)).send({
        library: activity.library,
        params: { params, metadata: activity.metadata },
        ...extra,
      }),
    copy: (activity, params, ltik) => {
      const call = request(tb.app).post(`/h5p/content/${activity.id}/copy`);
      const authed = ltik ? call.set('Authorization', `Bearer ${ltik}`) : asAuthor(call);
      return authed.send({ params, metadata: activity.metadata });
    },
    writeState: (activity, writer, data, version) => {
      const token =
        writer === 'author' ? `csrf=${encodeURIComponent(csrf)}` : `ltik=${encodeURIComponent(writer.ltik)}`;
      const query = version === undefined ? token : `${token}&contentVersion=${version}`;
      const call = request(tb.app).post(`/h5p/contentUserData/${activity.id}/state/0?${query}`);
      return (writer === 'author' ? call.set('Cookie', cookie) : call)
        .type('form')
        .send({ data, preload: '1', invalidate: '1' });
    },
    addOtherLearnersState: async (activity) => {
      const learnerKey = newLearner();
      await tb.db.h5PUserData.create({
        data: {
          contentId: activity.id,
          dataType: 'state',
          learnerKey,
          contextId: 'course-1',
          data: '{"answers":[1]}',
        },
      });
      return learnerKey;
    },
    launch: async (activity, who) => {
      launches += 1;
      const run = await launchFromCanvas(tb.app, tb.mock.canvas, {
        user: CANVAS_USERS[who],
        custom: { contentId: activity.id },
        resourceLinkId: `safe-editing-${launches}`,
      });
      if (!run.ltik) throw new Error(`the launch did not reach the tool (status ${run.res.status})`);
      return run.ltik;
    },
    stored: (id) =>
      tb.db.h5PContent.findUniqueOrThrow({
        where: { id },
        select: { params: true, version: true, status: true },
      }),
    stateKeys: async (id) =>
      (await tb.db.h5PUserData.findMany({ where: { contentId: id }, select: { learnerKey: true } }))
        .map((row) => row.learnerKey)
        .sort(),
    close: async () => {
      await seedAudit.remove();
      await tb.close();
      rmSync(tb.env.H5P_LIBRARY_DIR, { recursive: true, force: true });
    },
  };
}
