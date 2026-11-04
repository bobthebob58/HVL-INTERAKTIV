/**
 * End-to-end test of insight in Canvas (INS-001, INS-007, PROD-010), with third-party cookies and frame storage
 * blocked (D-065): six learners of course A answer the teacher's MultiChoice, two in the real player through the
 * xAPI bridge and four through the real ingestion route with their launch's Bearer ltik; two learners of course B
 * do the same through the route. The teacher's **Innsikt** tab in `/app/play` then shows course A's participation
 * and the question's share right, and course B's values as «< 5» (fewer than k = 5); a learner gets no tab and a
 * 403; another teacher of course B sees course B only and is refused course A. The whole server with the built web
 * app and the real content types (../test/support/realWebApp.ts).
 *
 * Spec: INS-001, INS-002, INS-006, INS-007, PROD-010, LTI-006, DATA-007
 */
import { randomUUID } from 'node:crypto';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS, type LaunchSpec } from '../../../tools/mock-platform/mockPlatform.mjs';
import { recordFlow } from '../test/support/flowRecorder.js';
import { newCanvasLearner, playThroughIngestion } from '../test/support/insightLearners.js';
import { lostRowsFact } from '../test/support/lostTestRows.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { launchCookieTestChromium } from '../test/support/thirdPartyCookies.js';
import { insightAsLaunch, openTeacherInsight, playInBrowser, tileValue } from './support/insightFlow.js';

/** The MultiChoice's right option (option 0) or its first wrong one, as H5P reports it (D-115). */
const RIGHT = { response: '0', raw: 1 };
const WRONG = { response: '1', raw: 0 };

describeWithRealWebApp(
  '[INS-007] a teacher sees their own course’s insight in Canvas, suppressed below k',
  () => {
    let browser: Browser;
    let app: RealWebApp;
    let contentId: string;
    const runId = randomUUID();
    const courseA = { id: `e2e-insight-a-${runId}`, label: 'INNSIKT101', title: 'Innsikt A' };
    const courseB = { id: `e2e-insight-b-${runId}`, label: 'INNSIKT202', title: 'Innsikt B' };
    const launchIn = (course: typeof courseA, user: LaunchSpec['user']) => ({
      user,
      course,
      resourceLinkId: `e2e-insight-${course.id}`,
      custom: { contentId },
      platformStorage: true,
    });
    beforeAll(async () => {
      // WHY: Playwright's Chromium does not partition storage, so the blocked tool frame has no localStorage (D-065).
      browser = await launchCookieTestChromium();
      app = await openRealWebApp(browser);
      contentId = await app.teacherActivity();
    }, 240_000);
    afterAll(async () => {
      await app?.close();
      await browser?.close();
    });

    it('[INS-001][INS-007][PROD-010] six learners in course A show; two in course B stay «< 5»; learners and other courses see nothing', async () => {
      // Arrange: the teacher's own page records what fails; the mock Canvas page is not under test
      const page = await (await browser.newContext()).newPage();
      const canvasOrigin = new URL(app.tb.mock.canvas.coursePageUrl()).origin;
      const flow = await recordFlow(page, app.base, {
        ignoreConsole: (m) =>
          m.location().url.startsWith(canvasOrigin) || m.text().includes('fullscreen is not allowed'),
      });
      const stored = () => app.tb.db.xapiStatement.count({ where: { contentId, verb: 'answered' } });
      const facts = async () => ({
        answered: await stored(),
        ...(await lostRowsFact(app.tb.db, { contents: { 'the activity': contentId } })),
      });
      const seen = await flow.run(async () => {
        // Act: course A, two learners in the real player (one right, one wrong) and four through the route
        flow.step = 'browser learners';
        await playInBrowser(browser, app, launchIn(courseA, newCanvasLearner()), true);
        await playInBrowser(browser, app, launchIn(courseA, newCanvasLearner()), false);
        flow.step = 'route learners';
        const statuses: number[] = [];
        for (const answer of [RIGHT, RIGHT, WRONG, RIGHT]) {
          const launch = launchIn(courseA, newCanvasLearner());
          statuses.push(await playThroughIngestion(app, launch, 'H5P.MultiChoice', () => answer));
        }
        for (const answer of [RIGHT, WRONG]) {
          const launch = launchIn(courseB, newCanvasLearner());
          statuses.push(await playThroughIngestion(app, launch, 'H5P.MultiChoice', () => answer));
        }
        // Act: the teacher opens Innsikt in course A's /app/play
        flow.step = 'teacher A';
        await page.goto(app.tb.mock.canvas.coursePageUrl(launchIn(courseA, CANVAS_USERS.teacher)));
        const toolA = page.frameLocator('#tool_content');
        await toolA.getByRole('tab', { name: 'Innsikt' }).click();
        await toolA.getByRole('heading', { level: 3, name: 'Deltaking' }).waitFor({ timeout: 30_000 });
        const items = toolA.getByRole('table', { name: 'Spørsmåla, vanskelegast først' });
        const a = {
          started: await tileValue(toolA, 'Starta'),
          completed: await tileValue(toolA, 'Fullført'),
          item: (await items.locator('tbody tr').first().textContent()) ?? '',
          rows: await items.locator('tbody tr').count(),
          panel: (await toolA.getByRole('tabpanel').textContent()) ?? '',
        };
        // Act: the same teacher in course B, where only two learners played
        flow.step = 'teacher B';
        const inB = await openTeacherInsight(browser, app, launchIn(courseB, CANVAS_USERS.teacher));
        const b = {
          started: await tileValue(inB.tool, 'Starta'),
          panel: (await inB.tool.getByRole('tabpanel').textContent()) ?? '',
        };
        await inB.page.context().close();
        // Act: a learner's own Canvas page, and the API with a learner's and another course B teacher's ltik
        flow.step = 'refusals';
        const learnerPage = await (await browser.newContext()).newPage();
        await learnerPage.goto(app.tb.mock.canvas.coursePageUrl(launchIn(courseA, newCanvasLearner())));
        const learnerTool = learnerPage.frameLocator('#tool_content');
        await learnerTool.locator('iframe').first().waitFor({ timeout: 30_000 });
        const learnerTabs = await learnerTool.getByRole('tab', { name: 'Innsikt' }).count();
        await learnerPage.context().close();
        const learnerApi = await insightAsLaunch(app, launchIn(courseA, newCanvasLearner()));
        const otherTeacher = { sub: randomUUID(), roles: CANVAS_USERS.teacher.roles };
        const otherOwn = await insightAsLaunch(app, launchIn(courseB, otherTeacher));
        const keyA = `${app.tb.platformId}:${courseA.id}`;
        const otherA = await insightAsLaunch(app, launchIn(courseB, otherTeacher), `?context=${keyA}`);
        return { statuses, a, b, learnerTabs, learnerApi, otherOwn, otherA, keyA };
      }, facts);
      await flow.settled();
      const audits = await app.tb.db.auditEvent.findMany({
        where: { action: 'insight.view', targetId: contentId },
      });
      // Assert: every answer was stored through the bridge or the route
      expect(seen.statuses.every((status) => status === 202)).toBe(true);
      expect(await stored()).toBe(8);
      // Assert: course A shows six learners and the question, 4 of 6 right on the first try
      expect(seen.a.started).toBe('6');
      expect(seen.a.completed).toBe('6');
      expect(seen.a.rows).toBe(1);
      expect(seen.a.item).toContain('Kva kjenneteiknar undervegsvurdering (formativ vurdering)?');
      expect(seen.a.item.replace(/\s/g, ' ')).toContain('67 %');
      expect(seen.a.panel).toContain('INNSIKT101');
      expect(seen.a.panel).not.toContain(CANVAS_USERS.student.sub);
      // Assert: course B has two learners, so its values are «< 5» and nothing of course A shows
      expect(seen.b.started).toContain('< 5');
      expect(seen.b.panel).toContain('INNSIKT202');
      expect(seen.b.panel).not.toContain('INNSIKT101');
      // Assert: a learner gets no tab and a 403; another course B teacher sees course B only, and never course A
      expect(seen.learnerTabs).toBe(0);
      expect(seen.learnerApi.status).toBe(403);
      expect(seen.otherOwn.status).toBe(200);
      expect(seen.otherOwn.body).toMatchObject({
        scope: { context: { key: `${app.tb.platformId}:${courseB.id}` } },
        participation: { started: { suppressed: true } },
      });
      expect(JSON.stringify(seen.otherOwn.body)).not.toContain('"value":6');
      expect(seen.otherA.status).toBe(403);
      // Assert: each view the teachers opened is audited with its context, and no learner (DATA-007)
      expect(audits.map((event) => (event.details as { context: string }).context)).toContain(seen.keyA);
      expect(JSON.stringify(audits)).not.toMatch(/learnerKey|"value"/);
      expect(flow.failed).toEqual([]);
      expect(flow.problems).toEqual([]);
      await page.context().close();
    }, 300_000);
  },
);
