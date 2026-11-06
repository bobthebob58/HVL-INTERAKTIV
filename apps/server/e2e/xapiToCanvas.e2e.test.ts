/**
 * End-to-end test of the grade bridge (LTI-010 → LTI-012) in the mock Canvas, with third-party cookies and frame
 * storage blocked (D-065): a student launches a teacher's MultiChoice from a graded assignment, plays it in
 * `/app/play` → `/lti/play` and answers right; the player's xAPI bridge posts with the Bearer ltik; the server
 * stores the learner's statements under the learnerKey with no name (DATA-012) and queues one grade job; the grade
 * worker's `runOnce(now)` sends 100 of 100 for the student's `sub`, which the mock Canvas records; and the teacher's
 * own launch shows «Poeng til Canvas» with 1 sent. The portal side is ./xapiPortal.e2e.test.ts. The whole server
 * with the built web app and the real content types (../test/support/realWebApp.ts).
 *
 * Spec: LTI-010, LTI-011, LTI-012, DATA-012, LTI-006, H5P-009
 */
import { randomUUID } from 'node:crypto';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS, type LaunchSpec } from '../../../tools/mock-platform/mockPlatform.mjs';
import { recordFlow } from '../test/support/flowRecorder.js';
import { lostRowsFact } from '../test/support/lostTestRows.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { launchCookieTestChromium } from '../test/support/thirdPartyCookies.js';
import {
  answerMultiChoiceRight,
  gradeWorkerOf,
  recordBridgePosts,
  startedPlayer,
  XAPI_PATH,
} from './support/gradeBridgeFlow.js';

describeWithRealWebApp('[LTI-012] a student’s right answer in Canvas reaches the gradebook', () => {
  let browser: Browser;
  let app: RealWebApp;
  let contentId: string;
  const course = { id: `e2e-grades-${randomUUID()}`, label: 'KARAKTER101', title: 'Karakterprøve' };
  const resourceLinkId = `e2e-grades-${randomUUID()}`;
  const launchAs = (user: LaunchSpec['user']): LaunchSpec => ({
    user,
    course,
    resourceLinkId,
    custom: { contentId },
    lineItem: '1',
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

  it('[LTI-010][LTI-012][DATA-012] the bridge sends, the server stores and queues, the worker sends 100, the teacher sees 1 sent', async () => {
    // Arrange: the student in a browser of their own; the mock Canvas page is not under test
    const student = await browser.newContext();
    const page = await student.newPage();
    const posts = recordBridgePosts(page);
    const canvasOrigin = new URL(app.tb.mock.canvas.coursePageUrl()).origin;
    const flow = await recordFlow(page, app.base, {
      ignoreConsole: (m) =>
        m.location().url.startsWith(canvasOrigin) || m.text().includes('fullscreen is not allowed'),
    });
    const statements = () =>
      app.tb.db.xapiStatement.findMany({ where: { contentId }, orderBy: { timestamp: 'asc' } });
    const placement = () =>
      app.tb.db.ltiPlacement.findFirst({
        where: { contentId, resourceLinkId },
        include: { gradeSyncJobs: true },
      });
    const facts = async () => ({
      posts,
      xapiRequests: flow.requests.filter((request) => request.endsWith(XAPI_PATH)),
      statements: (await statements()).map((row) => row.verb),
      jobs: (await placement())?.gradeSyncJobs.map((job) => job.status),
      ...(await lostRowsFact(app.tb.db, { contents: { 'the activity': contentId } })),
    });
    const seen = await flow.run(async () => {
      // Act: the student launches from the assignment and answers right
      flow.step = 'student launch';
      await page.goto(app.tb.mock.canvas.coursePageUrl(launchAs(CANVAS_USERS.student)));
      const player = await startedPlayer(page, '/lti/play');
      flow.step = 'answer';
      const picked = await answerMultiChoiceRight(app, player, contentId);
      // Act: the bridge posts within its 2-second tick; the server stores and queues
      flow.step = 'bridge';
      await expect
        .poll(() => posts.some((post) => post.verbs.includes('answered')), { timeout: 20_000 })
        .toBe(true);
      flow.step = 'queued';
      await expect.poll(async () => (await placement())?.gradeSyncJobs.length, { timeout: 10_000 }).toBe(1);
      const queued = await placement();
      // Act: the worker runs once
      flow.step = 'worker';
      const outcome = await gradeWorkerOf(app, [queued?.id ?? '']).runOnce(new Date());
      const sent = await placement();
      // Act: the teacher launches the same assignment and opens «Poeng til Canvas»
      flow.step = 'teacher';
      const teacher = await browser.newContext();
      const teacherPage = await teacher.newPage();
      await teacherPage.goto(app.tb.mock.canvas.coursePageUrl(launchAs(CANVAS_USERS.teacher)));
      const tool = teacherPage.frameLocator('#tool_content');
      await tool.getByRole('tab', { name: 'Poeng til Canvas' }).click();
      const sentCount = tool
        .locator('dt', { hasText: 'Sendt til Canvas' })
        .locator('xpath=following-sibling::dd[1]');
      await expect.poll(() => sentCount.textContent(), { timeout: 20_000 }).toBe('1');
      const panelText = (await tool.getByRole('tabpanel').textContent()) ?? '';
      await teacher.close();
      return { picked, queued, outcome, sent, panelText };
    }, facts);
    await flow.settled();
    const rows = await statements();
    const scores = app.tb.mock.canvas.ags.scores.filter((score) => score.courseId === course.id);
    // Assert: the bridge posted with the Bearer ltik only, and the server accepted each post
    expect(seen.picked).toBeGreaterThan(0);
    expect(posts.length).toBeGreaterThan(0);
    expect(posts.every((post) => post.credential === 'Bearer' && post.status === 202)).toBe(true);
    // Assert: stored once each, under the learnerKey and the platform-scoped course, with no name or sub
    const answered = rows.filter((row) => row.verb === 'answered' && row.subContentId === null);
    expect(answered).toHaveLength(1);
    expect(answered[0]).toMatchObject({ scaled: 1, contextId: `${app.tb.platformId}:${course.id}` });
    expect(rows.every((row) => row.learnerKey === answered[0]?.learnerKey)).toBe(true);
    expect(JSON.stringify(rows)).not.toContain(CANVAS_USERS.student.sub);
    expect(JSON.stringify(rows)).not.toMatch(/"(name|email|mbox)"/);
    // Assert: one job, sent; Canvas has 100 of 100 for the student's sub, and nothing else for this course
    expect(seen.queued?.gradeSyncJobs).toMatchObject([{ status: 'pending', scoreGiven: 100 }]);
    expect(seen.outcome).toBe('ran');
    expect(seen.sent?.gradeSyncJobs).toMatchObject([{ status: 'succeeded' }]);
    expect(scores).toHaveLength(1);
    expect(scores[0]?.score).toMatchObject({
      userId: CANVAS_USERS.student.sub,
      scoreGiven: 100,
      scoreMaximum: 100,
      gradingProgress: 'FullyGraded',
    });
    // Assert: the teacher's panel says the scores are formative and shows counts only, never the student
    expect(seen.panelText).toContain('ikkje karakterar');
    expect(seen.panelText).not.toContain(CANVAS_USERS.student.sub);
    expect(flow.failed).toEqual([]);
    expect(flow.problems).toEqual([]);
    await student.close();
  }, 180_000);
});
