/**
 * End-to-end test of journey J1's Canvas half (spec 00 §3, «Create from a pattern and place it in Canvas»), steps 1
 * and 6, in full Chromium with third-party cookies and frame storage blocked (D-065). The author has built and
 * published activities in the portal (J1 steps 2–5 there: ./patternToPublish.e2e.test.ts and
 * ./publishWithReason.e2e.test.ts). In a Canvas course the same teacher chooses *Add item → External tool* as an
 * assignment (Deep Linking, `assignment_selection`); Canvas sends `custom.feide_login`, so the launch joins the
 * teacher's Feide account (AUTH-005, D-063) and the picker lists the portal activities. The teacher picks the
 * MultiChoice; the mock Canvas accepts the signed answer, a graded resource link with a line item labelled formative
 * (LTI-005, LTI-013), and creates the assignment's line item. A student opens the placed link and answers right
 * through the player's bridge; the grade worker's `runOnce(now)` sends 100 of 100 to that line item (LTI-012). The
 * teacher opens the same link and has **Rediger**, **Innsikt** and **Poeng til Canvas** (1 sent).
 * SPEC-DEVIATION: D-101 (amendment of 2026-11-05, S6 step 8) — J1 step 2's picker offers no «Create new» from a
 * pattern and no content bank: the Canvas side of the studio (D-098) passes to HVL's bachelor students
 * (docs/handoff/canvas-studio.md, parts 1 and 2); this test is J1's Canvas half, and the pattern part runs in the
 * portal.
 * The whole server with the built web app and the real content types (../test/support/realWebApp.ts).
 *
 * Spec: LTI-005, AUTH-005, LTI-012, LTI-013, LTI-006, LTI-010
 */
import { randomUUID } from 'node:crypto';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS, type LaunchSpec } from '../../../tools/mock-platform/mockPlatform.mjs';
import { t } from '../src/i18n/translate.js';
import { recordFlow } from '../test/support/flowRecorder.js';
import { lostRowsFact } from '../test/support/lostTestRows.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { launchCookieTestChromium } from '../test/support/thirdPartyCookies.js';
import { webText } from '../test/support/webAppTexts.js';
import {
  answerMultiChoiceRight,
  gradeWorkerOf,
  recordBridgePosts,
  startedPlayer,
} from './support/gradeBridgeFlow.js';

describeWithRealWebApp(
  '[LTI-005] a teacher places a portal activity in Canvas as an assignment and gets grades (J1)',
  () => {
    let browser: Browser;
    let app: RealWebApp;
    let contentId: string;
    let title: string;
    const course = { id: `e2e-place-${randomUUID()}`, label: 'PED101', title: 'Modul 3: Forarbeid' };
    const resourceLinkId = `e2e-place-${randomUUID()}`;
    const teacherSub = `e2e-lars-${randomUUID()}`;
    beforeAll(async () => {
      browser = await launchCookieTestChromium();
      app = await openRealWebApp(browser);
      contentId = app.ids.get('H5P.MultiChoice') ?? '';
      ({ title } = await app.tb.db.h5PContent.findUniqueOrThrow({ where: { id: contentId } }));
    }, 240_000);
    afterAll(async () => {
      await app?.close();
      await browser?.close();
    });

    it('[LTI-005][AUTH-005][LTI-012] the picker lists the portal activities, Canvas takes a graded link, a student’s grade reaches it', async () => {
      // Arrange: the teacher's Canvas login ID is their Feide ID, which Canvas sends on the Deep Linking placement
      const feideId = app.tb.mock.feide.users.get('author')?.feideId ?? '';
      const teacher = { sub: teacherSub, roles: CANVAS_USERS.teacher.roles, loginId: feideId };
      const page = await (await browser.newContext()).newPage();
      const canvasOrigin = new URL(app.tb.mock.canvas.coursePageUrl()).origin;
      const flow = await recordFlow(page, app.base, {
        ignoreConsole: (m) =>
          m.location().url.startsWith(canvasOrigin) || m.text().includes('fullscreen is not allowed'),
      });
      const placement = () =>
        app.tb.db.ltiPlacement.findFirst({
          where: { contentId, resourceLinkId },
          include: { gradeSyncJobs: true },
        });
      const facts = async () => ({
        responses: app.tb.mock.canvas.deepLinkResponses.map((record) => record.problems),
        jobs: (await placement())?.gradeSyncJobs.map((job) => job.status),
        ...(await lostRowsFact(app.tb.db, { contents: { 'the activity': contentId } })),
      });
      const seen = await flow.run(async () => {
        // Act: Add item → External tool → HVL Interaktiv, as an assignment
        flow.step = 'picker';
        await page.goto(
          app.tb.mock.canvas.coursePageUrl({
            messageType: 'LtiDeepLinkingRequest',
            user: teacher,
            course,
            placement: 'assignment_selection',
            custom: { feide_login: '$Canvas.user.loginId', hvl_placement: 'assignment_selection' },
            platformStorage: true,
          }),
        );
        const picker = page.frameLocator('#tool_content');
        await picker.locator('#deep-link-form').waitFor({ timeout: 30_000 });
        const listed = await picker.getByRole('radio').count();
        // WHY: the author's draft copy has the same title; the published one is picked, the draft must be disabled.
        const draftDisabled = await picker.locator(`input[value="${app.draftId}"]`).isDisabled();
        await picker.getByRole('radio', { name: title, exact: true, disabled: false }).check();
        await picker.getByRole('button', { name: t('deepLink.submit', {}, 'nn') }).click();
        await expect.poll(() => app.tb.mock.canvas.deepLinkResponses.length, { timeout: 15_000 }).toBe(1);
        const [record] = app.tb.mock.canvas.deepLinkResponses;
        const item = record?.items[0] as {
          custom: Record<string, string>;
          lineItem: { label: string; scoreMaximum: number };
        };
        // Act: Canvas creates the assignment's line item, and a student opens the placed link and answers right
        flow.step = 'student';
        const lineItem = app.tb.mock.canvas.ags.addLineItem({
          courseId: course.id,
          resourceLinkId,
          ...item.lineItem,
        });
        const placed = (user: LaunchSpec['user']): LaunchSpec => ({
          user,
          course,
          resourceLinkId,
          custom: item.custom,
          lineItem: lineItem.id,
          platformStorage: true,
        });
        const student = await browser.newContext();
        const studentPage = await student.newPage();
        const posts = recordBridgePosts(studentPage);
        await studentPage.goto(app.tb.mock.canvas.coursePageUrl(placed(CANVAS_USERS.student)));
        await answerMultiChoiceRight(app, await startedPlayer(studentPage, '/lti/play'), contentId);
        await expect
          .poll(() => posts.some((post) => post.verbs.includes('answered') && post.status === 202), {
            timeout: 20_000,
          })
          .toBe(true);
        await student.close();
        // Act: the grade worker runs once
        flow.step = 'worker';
        await expect.poll(async () => (await placement())?.gradeSyncJobs.length, { timeout: 10_000 }).toBe(1);
        const outcome = await gradeWorkerOf(app, [(await placement())?.id ?? '']).runOnce(new Date());
        // Act: the teacher opens the placed link
        flow.step = 'teacher';
        await page.goto(app.tb.mock.canvas.coursePageUrl(placed(teacher)));
        const tool = page.frameLocator('#tool_content');
        await tool.getByRole('tab', { name: webText('gradeSync.tab') }).click();
        const sent = tool
          .locator('dt', { hasText: webText('gradeSync.sent') })
          .locator('xpath=following-sibling::dd[1]');
        await expect.poll(() => sent.textContent(), { timeout: 20_000 }).toBe('1');
        const tabs = await tool.getByRole('tab').allTextContents();
        return { listed, draftDisabled, record, item, lineItem, outcome, tabs };
      }, facts);
      await flow.settled();
      const scores = app.tb.mock.canvas.ags.scores.filter((score) => score.courseId === course.id);
      const linked = await app.tb.db.authAuditEvent.count({
        where: { event: 'link.feide-lti', actorUserId: app.authorId },
      });
      // Assert: the launch joined the teacher's Feide account; the picker lists its ten published activities and draft
      expect(linked).toBe(1);
      expect([seen.listed, seen.draftDisabled]).toEqual([app.ids.size + 1, true]);
      // Assert: Canvas accepted one graded resource link to the activity, labelled formative (LTI-005, LTI-013)
      expect(seen.record?.problems).toEqual([]);
      expect(seen.record?.items).toHaveLength(1);
      expect(seen.item.custom).toEqual({ contentId });
      expect(seen.item.lineItem).toMatchObject({ scoreMaximum: 100, label: `${title} (formativ)` });
      // Assert: the student's 100 of 100 reached the assignment's line item, for the student's own `sub` (LTI-012)
      expect(seen.outcome).toBe('ran');
      expect(scores).toEqual([
        expect.objectContaining({
          lineItemUrl: seen.lineItem.id,
          score: expect.objectContaining({
            userId: CANVAS_USERS.student.sub,
            scoreGiven: 100,
            scoreMaximum: 100,
          }),
        }),
      ]);
      // Assert: from the placed link the teacher may edit, read insight and follow the grades (LTI-006)
      expect(seen.tabs.map((name) => name.trim())).toEqual(
        expect.arrayContaining([
          webText('activity.tabPlay'),
          webText('activity.tabEdit'),
          webText('insight.tab'),
          webText('gradeSync.tab'),
        ]),
      );
      expect(flow.failed).toEqual([]);
      expect(flow.problems).toEqual([]);
      await page.context().close();
    }, 300_000);
  },
);
