/**
 * insightFlow — what the Canvas insight flow does in and around the browser: a learner who plays the teacher's
 * MultiChoice in the real player inside the mock Canvas (right or wrong), the teacher's **Innsikt** tab in
 * `/app/play`, and the insight API as a launch's ltik sees it.
 *
 * Why: the end-to-end test of insight (INS-001, INS-007, PROD-010) must see real learners' statements arrive through
 *      the player's bridge, and the teacher read them back in the Canvas page, as a teacher would before a seminar.
 * Spec: INS-001, INS-007, PROD-010, LTI-010
 * Invariants:
 *   - A browser learner has a browser context of their own, closed after their answer has been stored (202).
 *   - The wrong option is read from the stored activity, so the flow follows the real content
 *     (`randomAnswers: false` keeps H5P's order).
 *   - The ltik is sent as `Authorization: Bearer` only and never logged (LTI-003).
 * Collaborators: ./gradeBridgeFlow.ts (the player and the bridge's posts), ../insightInCanvas.e2e.test.ts,
 *   ../../test/support/ltiLaunchDriver.ts, ../../test/support/realWebApp.ts.
 * Tests: apps/server/e2e/insightInCanvas.e2e.test.ts
 */
import type { Browser, FrameLocator, Page } from 'playwright-core';
import { expect } from 'vitest';
import type { LaunchSpec } from '../../../../tools/mock-platform/mockPlatform.mjs';
import { launchFromCanvas } from '../../test/support/ltiLaunchDriver.js';
import type { RealWebApp } from '../../test/support/realWebApp.js';
import { answerMultiChoiceRight, recordBridgePosts, startedPlayer } from './gradeBridgeFlow.js';

/**
 * Answers a stored MultiChoice wrong: picks its first wrong option and presses «Sjekk».
 * @param app - The running app, to read the stored activity.
 * @param player - The started player frame.
 * @param contentId - The activity.
 * @throws Error when the activity shuffles its options or has no wrong one.
 */
async function answerMultiChoiceWrong(
  app: RealWebApp,
  player: Awaited<ReturnType<typeof startedPlayer>>,
  contentId: string,
): Promise<void> {
  const { params } = await app.tb.db.h5PContent.findUniqueOrThrow({ where: { id: contentId } });
  const stored = params as { answers: { correct?: boolean }[]; behaviour?: { randomAnswers?: boolean } };
  if (stored.behaviour?.randomAnswers !== false)
    throw new Error('the activity must keep its options in order');
  const wrong = stored.answers.findIndex((answer) => !answer.correct);
  if (wrong < 0) throw new Error('the activity has no wrong option');
  await player.locator('.h5p-answer').nth(wrong).click();
  await player.locator('.h5p-question-check-answer:visible').click();
}

/**
 * One learner launches from the mock Canvas, plays in Chromium and answers; the bridge posts the answer.
 * @param browser - The running Chromium (third-party cookies blocked, D-065).
 * @param app - The running app.
 * @param launch - The learner's launch.
 * @param right - Whether the learner answers right.
 */
export async function playInBrowser(
  browser: Browser,
  app: RealWebApp,
  launch: LaunchSpec & { custom: { contentId: string } },
  right: boolean,
): Promise<void> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const posts = recordBridgePosts(page);
    await page.goto(app.tb.mock.canvas.coursePageUrl(launch));
    const player = await startedPlayer(page, '/lti/play');
    const { contentId } = launch.custom;
    if (right) await answerMultiChoiceRight(app, player, contentId);
    else await answerMultiChoiceWrong(app, player, contentId);
    // WHY: the bridge posts within its 2-second tick; the context may close only after the answer is stored.
    await expect
      .poll(() => posts.some((post) => post.verbs.includes('answered') && post.status === 202), {
        timeout: 20_000,
      })
      .toBe(true);
  } finally {
    await context.close();
  }
}

/**
 * The teacher launches from the mock Canvas and opens the **Innsikt** tab of `/app/play`.
 * @param browser - The running Chromium.
 * @param app - The running app.
 * @param launch - The teacher's launch.
 * @returns The page (close its context when done) and the tool frame with the tab shown.
 */
export async function openTeacherInsight(
  browser: Browser,
  app: RealWebApp,
  launch: LaunchSpec,
): Promise<{ page: Page; tool: FrameLocator }> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(app.tb.mock.canvas.coursePageUrl(launch));
  const tool = page.frameLocator('#tool_content');
  await tool.getByRole('tab', { name: 'Innsikt' }).click();
  await tool.getByRole('heading', { level: 3, name: 'Deltaking' }).waitFor({ timeout: 30_000 });
  return { page, tool };
}

/**
 * The text of one participation tile, e.g. «Starta».
 * @param tool - The tool frame with the Innsikt tab shown.
 * @param name - The tile's name.
 * @returns Its value as shown, with the hidden phrase of a suppressed value.
 */
export const tileValue = async (tool: FrameLocator, name: string): Promise<string> =>
  (await tool.locator('dt', { hasText: name }).locator('xpath=following-sibling::dd[1]').textContent()) ?? '';

/**
 * The insight API as one launch sees it.
 * @param app - The running app.
 * @param launch - The launch whose ltik asks.
 * @param query - The query string, e.g. `?context=…`, or empty.
 * @returns The status and, for 200, the view.
 */
export async function insightAsLaunch(
  app: RealWebApp,
  launch: LaunchSpec & { custom: { contentId: string } },
  query = '',
): Promise<{ status: number; body: unknown }> {
  const { ltik } = await launchFromCanvas(app.tb.app, app.tb.mock.canvas, launch);
  if (!ltik) throw new Error('the launch did not reach the tool');
  const path = `/api/content/${encodeURIComponent(launch.custom.contentId)}/insight${query}`;
  const res = await fetch(`${app.base}${path}`, { headers: { authorization: `Bearer ${ltik}` } });
  return { status: res.status, body: await res.json() };
}
