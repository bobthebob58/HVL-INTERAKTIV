/**
 * End-to-end test of a learner's data rights and the yearly purge, through the operations CLIs HVL runs (docs/ops/),
 * on what a real Canvas launch and play stored: the whole server with the built web app runs on a database deployed
 * for this test alone, the CLIs as `hvli_app` (D-109), so the purge deletes nothing of another test's. A student
 * plays the author's MultiChoice from the mock Canvas in full Chromium (third-party cookies blocked, D-065): the
 * bridge stores the answer and H5P the state. Last academic year's rows of another learner of the course are seeded.
 * An HVL admin then runs `privacy:dsr export` with the student's Canvas `(iss, sub)` on standard input and gets every
 * stored row of the student and nothing that names them; `privacy:dsr erase` counts first and deletes with
 * `--confirm`, and the student's next launch starts the activity fresh (DATA-008, D-108). `privacy:purge` counts the
 * ended year in a dry run and deletes it, and only it: a classmate's play of this year stays (DATA-003, D-107; from
 * 1 to 30 August it refuses, which the test then expects). Every run is audited with counts and years only
 * (DATA-007). The CLIs on seeded data alone: ../test/privacy/operationsClis.int.test.ts.
 *
 * Spec: DATA-008, DATA-003, DATA-007, DATA-009, DATA-010, DATA-012
 */
import { randomUUID } from 'node:crypto';
import type { Browser, BrowserContext } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS, type LaunchSpec } from '../../../tools/mock-platform/mockPlatform.mjs';
import { DEFAULT_PURGE_RUN_DATE, isPurgeDue } from '../src/privacy/purge/purgeCalendar.js';
import { deployFreshDatabase, type FreshDeployment } from '../test/support/freshDeployment.js';
import { newCanvasLearner, playThroughIngestion } from '../test/support/insightLearners.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { jsonLines, runServerCli } from '../test/support/serverCli.js';
import { launchCookieTestChromium } from '../test/support/thirdPartyCookies.js';
import { answerMultiChoiceRight, recordBridgePosts, startedPlayer } from './support/gradeBridgeFlow.js';
import { operationsEnv, seedEndedYear, seedOperator } from './support/learnerRightsSeed.js';

/** A chosen MultiChoice option, as H5P marks it. */
const CHOSEN = '.h5p-answer[aria-checked="true"]';

describeWithRealWebApp(
  '[DATA-008] a learner’s data request and the yearly purge on what a real play stored',
  () => {
    let deployed: FreshDeployment;
    let browser: Browser;
    let app: RealWebApp;
    let contentId: string;
    const sharedDatabase = process.env.DATABASE_URL;
    const now = new Date();
    const student = { sub: `e2e-rights-${randomUUID()}`, roles: CANVAS_USERS.student.roles };
    const course = { id: `e2e-rights-${randomUUID()}`, label: 'PERSONVERN1', title: 'Personvern' };
    const launch = (): LaunchSpec & { custom: { contentId: string } } => ({
      user: student,
      course,
      resourceLinkId: `e2e-rights-${course.id}`,
      custom: { contentId },
      // WHY: Playwright's Chromium does not partition storage, so the blocked tool frame has no localStorage (D-065).
      platformStorage: true,
    });
    beforeAll(async () => {
      deployed = await deployFreshDatabase();
      // WHY: the purge deletes a whole academic year; on its own database it can run for real (DATA-003). The CLIs run
      // as `hvli_app`; the test bed connects as the database's owner, since its cleanup removes the seed's library
      // audit rows, which `hvli_app` may not delete (the audit is append-only for the app, D-109).
      process.env.DATABASE_URL = deployed.urls.admin;
      browser = await launchCookieTestChromium();
      app = await openRealWebApp(browser);
      contentId = app.ids.get('H5P.MultiChoice') ?? '';
    }, 300_000);
    afterAll(async () => {
      try {
        await app?.close();
        await browser?.close();
      } finally {
        // WHY: a failed cleanup must not leave the test's database behind on the shared server.
        await deployed?.close();
        process.env.DATABASE_URL = sharedDatabase;
      }
    });

    it('[DATA-008][DATA-003][DATA-007] export and erasure reach the student’s real rows; the purge takes the ended year only', async () => {
      // Arrange: the student plays from Canvas; the bridge stores the answer and H5P the state
      const { db } = app.tb;
      const contextId = `${app.tb.platformId}:${course.id}`;
      const statementsIn = (year?: number) =>
        db.xapiStatement.count({ where: { contentId, contextId, ...(year ? { academicYear: year } : {}) } });
      const playOnce = async (context: BrowserContext) => {
        const page = await context.newPage();
        const posts = recordBridgePosts(page);
        await page.goto(app.tb.mock.canvas.coursePageUrl(launch()));
        return { posts, player: await startedPlayer(page, '/lti/play') };
      };
      const first = await browser.newContext();
      const { posts, player } = await playOnce(first);
      await answerMultiChoiceRight(app, player, contentId);
      await expect
        .poll(() => db.xapiStatement.count({ where: { contentId, verb: 'answered' } }), { timeout: 20_000 })
        .toBe(1);
      const [{ learnerKey } = { learnerKey: '' }] = await db.xapiStatement.findMany({
        where: { contentId },
        take: 1,
      });
      await expect
        .poll(() => db.h5PUserData.count({ where: { contentId, learnerKey } }), { timeout: 20_000 })
        .toBe(1);
      await first.close();
      const studentRows = await statementsIn();
      const seeded = await seedEndedYear(db, contentId, contextId, now);
      const operator = await seedOperator(db);
      const env = operationsEnv(deployed.urls.hvli_app, operator);
      const subject = JSON.stringify({ lti: [{ issuer: app.tb.mock.canvas.issuer, sub: student.sub }] });
      const dsr = (args: string[]) =>
        runServerCli('privacy:dsr', [...args, '--operator', operator], env, subject);

      // Act: the admin exports what is stored about the student
      const exported = await dsr(['export']);
      // Act: the admin erases it: a dry run, then with --confirm
      const counted = await dsr(['erase']);
      const erased = await dsr(['erase', '--confirm']);
      const left = {
        statements: await db.xapiStatement.count({ where: { learnerKey } }),
        states: await db.h5PUserData.count({ where: { learnerKey } }),
        seeded: await db.xapiStatement.count({ where: { learnerKey: seeded.learnerKey } }),
      };
      // Act: the student's next launch from Canvas
      const again = await browser.newContext();
      const fresh = (await playOnce(again)).player;
      await fresh.locator('.h5p-answer').first().waitFor();
      const chosenAfter = await fresh.locator(CHOSEN).count();
      await again.close();
      // Act: another learner plays this year; then the yearly purge, a dry run and then for real
      const stored = await playThroughIngestion(
        app,
        { ...launch(), user: newCanvasLearner() },
        'H5P.MultiChoice',
      );
      const thisYear = await statementsIn(seeded.ended + 1);
      const due = isPurgeDue(DEFAULT_PURGE_RUN_DATE, now);
      const dry = await runServerCli('privacy:purge', ['--dry-run'], env);
      const real = await runServerCli('privacy:purge', ['--execute'], env);
      const endedLeft = await statementsIn(seeded.ended);
      const thisYearLeft = await statementsIn(seeded.ended + 1);
      const audits = await db.auditEvent.findMany({
        where: { action: { in: ['dataSubject.export', 'dataSubject.erase', 'purge.run'] } },
        orderBy: { at: 'asc' },
      });

      // Assert: the export holds the student's stored statements and state, and nothing that names the student
      const document = JSON.parse(exported.stdout) as { xapiStatements: unknown[]; h5pUserData: unknown[] };
      expect(exported.code).toBe(0);
      expect([document.xapiStatements.length, document.h5pUserData.length]).toEqual([studentRows, 1]);
      expect(posts.every((post) => post.credential === 'Bearer')).toBe(true);
      for (const run of [exported, counted, erased])
        expect(run.stdout + run.stderr).not.toContain(student.sub);
      // Assert: the dry run deleted nothing; the erasure left none of the student's rows and all of the other learner's
      expect([counted.code, erased.code]).toEqual([0, 0]);
      expect(JSON.parse(counted.stdout)).toMatchObject({
        action: 'erase',
        dryRun: true,
        counts: { xapiStatements: studentRows, h5pUserData: 1 },
      });
      expect(left).toEqual({ statements: 0, states: 0, seeded: 2 });
      // Assert: the next launch starts the activity fresh, with no answer chosen
      expect(chosenAfter).toBe(0);
      // Assert: the purge counted the ended year and, when due, deleted it and nothing of this year
      const [plan] = jsonLines(dry.stdout) as {
        endedYear: number;
        dryRun: boolean;
        counts: Record<string, number>;
      }[];
      expect(dry.code).toBe(0);
      expect(plan).toMatchObject({
        endedYear: seeded.ended,
        dryRun: true,
        counts: { xapiStatements: 2, h5pUserData: 1 },
      });
      expect([real.code, endedLeft]).toEqual(due ? [0, 0] : [1, 2]);
      expect(stored).toBe(202);
      expect(thisYear).toBeGreaterThan(0);
      expect(thisYearLeft).toBe(thisYear);
      // Assert: every run is audited, and no audit row holds the student's sub or learner key (DATA-007)
      expect(audits.map((event) => event.action)).toEqual([
        'dataSubject.export',
        'dataSubject.erase',
        'dataSubject.erase',
        'purge.run',
        ...(due ? ['purge.run'] : []),
      ]);
      for (const secret of [student.sub, learnerKey]) expect(JSON.stringify(audits)).not.toContain(secret);
    }, 300_000);
  },
);
