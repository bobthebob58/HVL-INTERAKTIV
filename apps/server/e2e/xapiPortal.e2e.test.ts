/**
 * End-to-end test of the xAPI bridge in the portal (LTI-010, D-102): a signed-in Feide learner plays a published
 * MultiChoice on its activity page and answers right; the bridge posts with the session's CSRF token, and the
 * server stores each statement once with no course (a portal play, D-103) and the academic year of the learner's
 * key (D-107), and queues no grade (no Canvas placement). The run's author previews the same activity: no bridge, no
 * post, nothing stored. Full Chromium on the built web app with the real content types (../test/support/realWebApp.ts).
 *
 * Spec: LTI-010, LTI-011, DATA-012, H5P-009
 */
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { academicYearOf } from '../src/privacy/academicYear.js';
import { recordFlow } from '../test/support/flowRecorder.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { signInRunAuthor } from '../test/support/runFeideAuthor.js';
import { launchCookieTestChromium } from '../test/support/thirdPartyCookies.js';
import {
  answerMultiChoiceRight,
  recordBridgePosts,
  startedPlayer,
  XAPI_PATH,
} from './support/gradeBridgeFlow.js';

describeWithRealWebApp('[LTI-010] the xAPI bridge in the portal, for learners only', () => {
  let browser: Browser;
  let app: RealWebApp;
  let contentId: string;
  const statements = () =>
    app.tb.db.xapiStatement.findMany({ where: { contentId }, orderBy: { timestamp: 'asc' } });
  /** Opens the activity page as `storageState`'s person, answers right and reads what the player page carries. */
  const playAs = async (storageState: Awaited<ReturnType<typeof signInRunAuthor>>) => {
    const context = await browser.newContext({ storageState });
    const page = await context.newPage();
    const posts = recordBridgePosts(page);
    const flow = await recordFlow(page, app.base);
    const bridge = await flow.run(async () => {
      flow.step = 'open';
      await page.goto(`${app.base}/aktivitet/${contentId}`);
      const player = await startedPlayer(page, `/h5p/play/${contentId}`);
      flow.step = 'answer';
      await answerMultiChoiceRight(app, player, contentId);
      return player.evaluate(() => ({
        config: document.getElementById('hvl-xapi-bridge') !== null,
        reporting: (window as unknown as { H5PIntegration?: { reportingIsEnabled?: boolean } }).H5PIntegration
          ?.reportingIsEnabled,
      }));
    });
    return { context, page, posts, flow, bridge };
  };
  beforeAll(async () => {
    browser = await launchCookieTestChromium();
    app = await openRealWebApp(browser);
    contentId = app.ids.get('H5P.MultiChoice') ?? '';
  }, 240_000);
  afterAll(async () => {
    await app?.close();
    await browser?.close();
  });

  it('[LTI-010] the author’s preview loads no bridge, posts nothing and stores nothing (D-102)', async () => {
    // Arrange
    const before = (await statements()).length;
    // Act
    const run = await playAs(app.authorStorage);
    // WHY: three of the bridge's 2-second ticks: had it run, it would have posted by now.
    await run.page.waitForTimeout(6_000);
    // Assert
    expect(run.bridge).toEqual({ config: false, reporting: undefined });
    expect(run.posts).toEqual([]);
    expect(run.flow.requests.filter((request) => request.endsWith(XAPI_PATH))).toEqual([]);
    expect((await statements()).length).toBe(before);
    expect(run.flow.problems).toEqual([]);
    await run.context.close();
  }, 120_000);

  it('[LTI-010][LTI-011][DATA-012] a Feide learner’s answer is posted with the CSRF token and stored once, with no course', async () => {
    // Arrange: the mock Feide's student signs in through the start page
    const learner = await signInRunAuthor(browser, app.tb, 'student');
    const before = (await statements()).length;
    // Act
    const run = await playAs(learner);
    await expect
      .poll(() => run.posts.some((post) => post.verbs.includes('answered')), { timeout: 20_000 })
      .toBe(true);
    const rows = (await statements()).slice(before);
    // Assert: the session's credential, accepted; stored once each, a portal play in the key's year, no grade queued
    expect(run.bridge).toEqual({ config: true, reporting: true });
    expect(run.posts.every((post) => post.credential === 'csrf' && post.status === 202)).toBe(true);
    const answered = rows.filter((row) => row.verb === 'answered' && row.subContentId === null);
    expect(answered).toHaveLength(1);
    expect(answered[0]).toMatchObject({
      scaled: 1,
      contextId: null,
      academicYear: academicYearOf(new Date()),
    });
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
    expect(await app.tb.db.gradeSyncJob.count({ where: { placement: { contentId } } })).toBe(0);
    expect(run.flow.failed).toEqual([]);
    expect(run.flow.problems).toEqual([]);
    await run.context.close();
  }, 120_000);
});
