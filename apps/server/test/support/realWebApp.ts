/**
 * realWebApp — the whole server as `main.ts` builds it (`createApp`) with the built web app (`WEB_APP=prod`), the
 * ten real H5P content types (D-078), the mock Canvas and the mock Feide, plus a signed-in author whose ten
 * published example activities the browser tests open, and LTI launches (resource links and the Deep Linking picker).
 *
 * Why: the accessibility suite (UD-030) and the browser checks of S4 must see what a person sees: the Next.js pages
 *      in their chrome, framing the real H5P markup under the production router, the real Feide session and real
 *      LTI launches. ./appTestbed.ts brings the app and the mocks; this adds the real libraries, the web app and
 *      the content, and cleans up what it added.
 * Spec: UD-030, DATA-011, NFR-003
 * Invariants:
 *   - The libraries are installed through the seed path (D-078), the activities through the package import, so the
 *     S2 package checks run on them; every activity belongs to the Feide author who signed in.
 *   - `ids` hold published activities; `draftId` is a draft MultiChoice for flows that change state.
 *   - `close` removes the seed audit rows of this run and the library folder, on top of ./appTestbed.ts's cleanup.
 *   - Every launch first checks that the mock Canvas is still active, so a platform another process deactivated on
 *     the shared database is reported as such, not as ltijs's bare 403.
 * Collaborators: ./appTestbed.ts, ./realPackages.ts, ./ltiLaunchDriver.ts, ../../src/web/nextWebApp.ts,
 *   ../../src/h5p/libraries/seedLibraries.ts.
 * Tests: apps/server/a11y/axeWebRoutes.a11y.test.ts and the other suites in apps/server/a11y/.
 */
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import type { Browser, BrowserContext } from 'playwright-core';
import { CANVAS_USERS } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { identitySource } from '../../src/auth/identity/subjectSources.js';
import { asAccountUser } from '../../src/h5p/HvlH5pUser.js';
import { PrismaLibraryAuditSink } from '../../src/h5p/libraries/LibraryAuditSink.js';
import { LibraryInstaller } from '../../src/h5p/libraries/LibraryInstaller.js';
import { seedLibraries } from '../../src/h5p/libraries/seedLibraries.js';
import { IdentityHasher } from '../../src/security/keys/IdentityHasher.js';
import { loadWebApp, type WebApp } from '../../src/web/nextWebApp.js';
import { openAppTestbed, type AppTestbed } from './appTestbed.js';
import { launchFromCanvas } from './ltiLaunchDriver.js';
import { packageExamples, REAL_PACKAGES_DIR } from './realPackages.js';
import { testActor } from './testActors.js';

/** A browser context's cookies and storage, as Playwright saves them. */
export type BrowserStorage = Awaited<ReturnType<BrowserContext['storageState']>>;

/** The UI languages (PROD-012). */
export type UiLocale = 'nn' | 'nb' | 'en';

/** Language of a launch and whether the teacher (who may edit) launches; a student by default. */
type LaunchOptions = { locale?: UiLocale; teacher?: boolean };

/** The running app, its content and its people. */
export interface RealWebApp {
  readonly tb: AppTestbed;
  /** `http://localhost:<port>`. */
  readonly base: string;
  /** Main library name (e.g. `H5P.MultiChoice`) → published activity of the author. */
  readonly ids: ReadonlyMap<string, string>;
  /** A draft H5P.MultiChoice activity of the author. */
  readonly draftId: string;
  /** The signed-in author's browser storage; pass it to `browser.newContext({ storageState })`. */
  readonly authorStorage: BrowserStorage;
  /**
   * Launches an activity from the mock Canvas and returns the ltik for `/app/play?ltik=…`.
   * @param contentId - The activity.
   * @param options - Language of the launch and whether the teacher (who may edit) launches; a student by default.
   */
  launch(contentId: string, options?: { locale?: UiLocale; teacher?: boolean }): Promise<string>;
  /**
   * A student's launch that the tool refuses (e.g. of a draft), as the friendly page the launch answers with.
   * @param contentId - The activity.
   * @returns The status and HTML of the tool's answer.
   */
  refusedLaunch(contentId: string): Promise<{ status: number; html: string }>;
  /**
   * Opens the Deep Linking picker from the mock Canvas as the teacher, who owns one published activity and one draft
   * (created on the first call).
   * @returns The ltik for `/lti/deeplink?ltik=…`.
   */
  deepLink(): Promise<string>;
  close(): Promise<void>;
}

/** Signs the mock Feide author in through the start page and returns the context's storage. */
async function signInAuthor(browser: Browser, tb: AppTestbed): Promise<BrowserStorage> {
  const context = await browser.newContext();
  const page = await context.newPage();
  tb.mock.feide.nextLogin('author');
  await page.goto(`${tb.toolUrl}/`);
  await page.getByRole('link', { name: 'Logg inn med Feide' }).click();
  await page.getByRole('button', { name: 'Logg ut' }).waitFor({ timeout: 30_000 });
  const storage = await context.storageState();
  await context.close();
  return storage;
}

/** The account the mock Feide author signed in to. */
async function authorAccount(tb: AppTestbed): Promise<string> {
  const hashes = new IdentityHasher(tb.env.IDENTITY_HASH_KEYS).candidates(
    'identity-subject',
    identitySource({ kind: 'feide', feideId: 'author@hvl.no' }),
  );
  const row = await tb.db.identity.findFirst({ where: { subjectHash: { in: hashes.map((c) => c.hash) } } });
  if (!row) throw new Error('the Feide author has no account after signing in');
  return row.userId;
}

/**
 * Starts the app with the built web app and the real content types, signs the author in and imports the examples.
 * @param browser - A running Chromium, used once to sign in through the mock Feide.
 * @returns The running app; call `close` in `afterAll`.
 * @throws Error when the web app is not built (`npm run build`) or the real packages are missing.
 */
export async function openRealWebApp(browser: Browser): Promise<RealWebApp> {
  const web: WebApp = await loadWebApp('prod');
  const startedAt = new Date();
  const tb = await openAppTestbed([], { web });
  const { packageImporter, libraryManager } = tb.runtime.editor;
  await seedLibraries(
    REAL_PACKAGES_DIR,
    new LibraryInstaller(packageImporter, new PrismaLibraryAuditSink(tb.db), libraryManager),
  );
  const authorStorage = await signInAuthor(browser, tb);
  const author = asAccountUser(testActor('author', { accountId: await authorAccount(tb) }));
  const importAs = async (file: string, published: boolean, owner = author) => {
    const { id } = await packageImporter.addPackageLibrariesAndContent(join(REAL_PACKAGES_DIR, file), owner);
    if (published) {
      await tb.db.h5PContent.update({
        where: { id: String(id) },
        data: { status: 'published', visibility: 'organisation' },
      });
    }
    return String(id);
  };
  const ids = new Map<string, string>();
  for (const example of await packageExamples()) {
    ids.set(example.library.split(' ')[0] ?? '', await importAs(example.file, true));
  }
  const draftId = await importAs('H5P.MultiChoice.h5p', false);
  let launches = 0;
  let teacherHasActivities = false;
  // WHY: a server started meanwhile on the same database (e.g. test/server/main.smoke.test.ts) runs the start-up sync
  // (src/lti/platforms/syncLtiPlatforms.ts), which deactivates every platform it is not configured with; the tool
  // then refuses this mock Canvas's logins with a bare 403. Say so instead (run the suite on its own).
  const assertPlatformActive = async () => {
    const { platformId, mock } = tb;
    const platform = await tb.db.ltiPlatform.findUnique({ where: { id: platformId } });
    const deployed = await tb.db.ltiDeployment.count({
      where: { platformId, deploymentId: mock.canvas.deploymentId },
    });
    if (!platform?.active || deployed === 0) throw new Error('another process deactivated the mock Canvas');
  };
  const resourceLaunch = async (contentId: string, options: LaunchOptions = {}) => {
    launches += 1;
    await assertPlatformActive();
    return launchFromCanvas(tb.app, tb.mock.canvas, {
      user: options.teacher ? CANVAS_USERS.teacher : CANVAS_USERS.student,
      custom: { contentId },
      locale: options.locale ?? 'nn',
      resourceLinkId: `a11y-${launches}-${contentId}`,
    });
  };
  return {
    tb,
    base: tb.toolUrl,
    ids,
    draftId,
    authorStorage,
    launch: async (contentId, options) => {
      const run = await resourceLaunch(contentId, options);
      if (!run.ltik) throw new Error(`the launch did not reach the tool (status ${run.res.status})`);
      return run.ltik;
    },
    refusedLaunch: async (contentId) => {
      const { res } = await resourceLaunch(contentId);
      return { status: res.status, html: res.text };
    },
    deepLink: async () => {
      await assertPlatformActive();
      const run = await launchFromCanvas(tb.app, tb.mock.canvas, {
        messageType: 'LtiDeepLinkingRequest',
        user: CANVAS_USERS.teacher,
        placement: 'assignment_selection',
      });
      if (!run.ltik) throw new Error(`the picker launch did not reach the tool (status ${run.res.status})`);
      if (!teacherHasActivities) {
        const { userId } = (await tb.lti.resolveLtik(run.ltik)).principal;
        const teacher = asAccountUser(testActor('author', { accountId: userId }));
        await importAs('H5P.MultiChoice.h5p', true, teacher);
        await importAs('H5P.MultiChoice.h5p', false, teacher);
        teacherHasActivities = true;
      }
      return run.ltik;
    },
    close: async () => {
      // WHY: seeding records its installs without an actor (D-041); only this run's rows go.
      await tb.db.libraryAuditEvent.deleteMany({
        where: { actorUserId: null, source: 'seed', at: { gte: startedAt } },
      });
      await tb.close();
      await web.close();
      rmSync(tb.env.H5P_LIBRARY_DIR, { recursive: true, force: true });
    },
  };
}
