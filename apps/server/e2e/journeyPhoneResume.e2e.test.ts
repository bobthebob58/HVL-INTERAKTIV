/**
 * End-to-end test of journey J2 (spec 00 §3, «Study asynchronously on a phone and resume»), steps 1–3, in full
 * Chromium with third-party cookies and frame storage blocked (D-065): a student opens the author's QuestionSet from
 * the mock Canvas on a phone 320 px wide (touch, two device pixels per CSS pixel); the player reflows to the frame's
 * width with no sideways scrolling (UD-008). The student starts the set, answers the first question wrong and sees
 * «Feil:» and the teacher's explanation (UD-003), goes on and fills two of the Blanks question's gaps, and the player
 * saves the state (H5P-005). The student closes the browser; the next evening a new browser on the same phone opens
 * the activity from Canvas again and is back at the Blanks question with both words in their gaps (PROD-008), and the
 * tool set no cookie. Step 1's "under 3 s" is NFR-001's load test (tools/load), not timed here; step 4 (NVDA and the
 * keyboard only) is the manual protocol's (UD-031). The whole server with the built web app and the real content
 * types (../test/support/realWebApp.ts).
 *
 * Spec: UD-008, UD-003, PROD-008, H5P-005, LTI-003
 */
import { randomUUID } from 'node:crypto';
import type { Browser, BrowserContext, Frame } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS, type LaunchSpec } from '../../../tools/mock-platform/mockPlatform.mjs';
import { recordFlow } from '../test/support/flowRecorder.js';
import { lostRowsFact } from '../test/support/lostTestRows.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { launchCookieTestChromium } from '../test/support/thirdPartyCookies.js';
import { startedPlayer } from './support/gradeBridgeFlow.js';
import { questionSetTexts } from './support/seminarCohort.js';

/** A small phone: 320 CSS pixels wide (WCAG 1.4.10's reflow width), touch, two device pixels per CSS pixel. */
const PHONE = { viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
/** The two gaps the student fills, as the example accepts them. */
const WORDS = ['undervegsvurdering', 'framover'] as const;

/** The frame's width and how far its page reaches past it, in CSS pixels. */
const reflowOf = (frame: Frame) =>
  frame.evaluate(() => ({
    width: window.innerWidth,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));

/** The values of the gaps the student sees. */
const gapValues = (player: Frame) =>
  player
    .locator('.h5p-text-input:visible')
    .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));

describeWithRealWebApp('[PROD-008] a student studies on a phone and resumes the next evening (J2)', () => {
  let browser: Browser;
  let app: RealWebApp;
  let contentId: string;
  const launch: LaunchSpec = {
    user: { sub: `e2e-phone-${randomUUID()}`, roles: CANVAS_USERS.student.roles },
    course: { id: `e2e-phone-${randomUUID()}`, label: 'SJUKEPLEIE1', title: 'Forarbeid veke 45' },
    resourceLinkId: `e2e-phone-${randomUUID()}`,
    // WHY: Playwright's Chromium does not partition storage, so the blocked tool frame has no localStorage (D-065).
    platformStorage: true,
  };
  beforeAll(async () => {
    browser = await launchCookieTestChromium();
    app = await openRealWebApp(browser);
    contentId = app.ids.get('H5P.QuestionSet') ?? '';
    launch.custom = { contentId };
  }, 240_000);
  afterAll(async () => {
    await app?.close();
    await browser?.close();
  });

  it('[UD-008][UD-003][PROD-008][H5P-005] reflows at 320 px, says «Feil:» with the explanation, and resumes at the same point', async () => {
    // Arrange: the student's phone; the mock Canvas page is not under test
    const texts = await questionSetTexts(app, contentId);
    const canvasOrigin = new URL(app.tb.mock.canvas.coursePageUrl()).origin;
    const state = () => app.tb.db.h5PUserData.findMany({ where: { contentId, dataType: 'state' } });
    const openOnPhone = async (phone: BrowserContext) => {
      const page = await phone.newPage();
      const flow = await recordFlow(page, app.base, {
        // WHY: H5P asks for full screen, which the mock Canvas's frame does not allow, as the other Canvas flows say.
        ignoreConsole: (m) =>
          m.location().url.startsWith(canvasOrigin) || m.text().includes('fullscreen is not allowed'),
      });
      await page.goto(app.tb.mock.canvas.coursePageUrl(launch));
      return { flow, player: await startedPlayer(page, '/lti/play') };
    };
    const evening = await browser.newContext(PHONE);
    const first = await openOnPhone(evening);
    const facts = async () => ({
      states: (await state()).length,
      ...(await lostRowsFact(app.tb.db, { contents: { 'the activity': contentId } })),
    });
    const studied = await first.flow.run(async () => {
      // Act: the player at 320 px, then the first question answered wrong
      first.flow.step = 'reflow';
      const reflow = await reflowOf(first.player);
      first.flow.step = 'first question';
      await first.player.getByRole('button', { name: 'Start' }).click();
      await first.player.locator('.h5p-answer:visible').nth(1).click();
      await first.player
        .locator('.h5p-question-check-answer:visible, .h5p-theme-check:visible')
        .first()
        .click();
      await first.player.getByText(texts.feedback[1] ?? '', { exact: true }).waitFor();
      const tree = await first.player.locator('.h5p-content').ariaSnapshot();
      // Act: on to the Blanks question; two gaps filled and checked; the player saves the state
      first.flow.step = 'second question';
      await first.player.locator('.h5p-theme-next:visible').click();
      const gaps = first.player.locator('.h5p-text-input:visible');
      for (const [index, word] of WORDS.entries()) await gaps.nth(index).fill(word);
      await first.player
        .locator('.h5p-question-check-answer:visible, .h5p-theme-check:visible')
        .first()
        .click();
      first.flow.step = 'saved';
      await expect
        .poll(async () => (await state()).map((row) => row.data).join(''), { timeout: 20_000 })
        .toContain(WORDS[1]);
      return { reflow, tree };
    }, facts);
    await first.flow.settled();
    await evening.close();
    // Act: the next evening, a new browser on the phone opens the activity from Canvas again
    const nextEvening = await browser.newContext(PHONE);
    const second = await openOnPhone(nextEvening);
    const resumed = await second.flow.run(async () => {
      second.flow.step = 'resume';
      await expect.poll(() => gapValues(second.player), { timeout: 30_000 }).toHaveLength(3);
      return { gaps: await gapValues(second.player), reflow: await reflowOf(second.player) };
    }, facts);
    await second.flow.settled();
    // Assert: the player fills the phone's width and never scrolls sideways (UD-008)
    for (const reflow of [studied.reflow, resumed.reflow]) {
      expect(reflow.width).toBeLessThanOrEqual(320);
      expect(reflow.overflow).toBeLessThanOrEqual(0);
    }
    // Assert: the wrong answer says «Feil:» in text, not by colour alone, beside the teacher's explanation (UD-003)
    expect(studied.tree).toContain(`Feil: ${texts.options[1]}`);
    // Assert: one saved state, and the next evening starts at the Blanks question with both words (PROD-008)
    expect(await state()).toHaveLength(1);
    expect(resumed.gaps).toEqual([...WORDS, '']);
    // Assert: the tool set no cookie and failed no request on either evening (LTI-003)
    for (const flow of [first.flow, second.flow]) {
      expect(flow.setCookies).toEqual([]);
      expect(flow.failed).toEqual([]);
      expect(flow.problems).toEqual([]);
    }
    expect(await nextEvening.cookies(app.base)).toEqual([]);
    await nextEvening.close();
  }, 240_000);
});
