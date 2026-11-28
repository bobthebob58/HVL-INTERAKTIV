/**
 * End-to-end test of a Branching Scenario's decisions in the teacher's insight (INS-004): five Canvas learners play
 * the real example in the real player, each choosing the second option of the first decision, coming back through
 * the scenario's loop to choose the first, and then the first option of the last decision, which ends the scenario.
 * The xAPI bridge posts each choice (D-154: H5P keeps the statement and dispatches none). The course's teacher then
 * reads the view through the API, and the scenario's author on the Innsikt tab in the portal: per decision the
 * learners' first choices and how many chose again. The whole server with the built web app and the real content
 * types (../test/support/realWebApp.ts).
 *
 * Spec: INS-004, LTI-010, INS-006
 */
import { randomUUID } from 'node:crypto';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS, type LaunchSpec } from '../../../tools/mock-platform/mockPlatform.mjs';
import { DECISIONS, scenarioSteps } from '../test/h5p/support/branchingScenarioPlay.js';
import { newCanvasLearner } from '../test/support/insightLearners.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { moveStatementsToYesterday } from '../test/support/statementsToYesterday.js';
import { launchCookieTestChromium } from '../test/support/thirdPartyCookies.js';
import { webText } from '../test/support/webAppTexts.js';
import { recordBridgePosts, startedPlayer } from './support/gradeBridgeFlow.js';
import { insightAsLaunch } from './support/insightFlow.js';

const LEARNERS = 5;
const shown = (value: number) => ({ suppressed: false, value });

describeWithRealWebApp('[INS-004] the decisions of a Branching Scenario in the teacher’s insight', () => {
  let browser: Browser;
  let app: RealWebApp;
  let contentId: string;
  const course = { id: `e2e-branching-${randomUUID()}`, label: 'VAL101', title: 'Val' };
  const launchAs = (user: LaunchSpec['user']) => ({
    user,
    course,
    resourceLinkId: `e2e-branching-${course.id}`,
    custom: { contentId },
    platformStorage: true,
  });
  beforeAll(async () => {
    browser = await launchCookieTestChromium();
    app = await openRealWebApp(browser);
    contentId = app.ids.get('H5P.BranchingScenario') ?? '';
  }, 240_000);
  afterAll(async () => {
    await app?.close();
    await browser?.close();
  });

  it('[INS-004] five learners’ choices reach the teacher: first choices per option, and who chose again', async () => {
    // Act: each learner chooses option 1, comes back through the loop, chooses option 0, then ends at the last decision
    for (let learner = 0; learner < LEARNERS; learner += 1) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const posts = recordBridgePosts(page);
      await page.goto(app.tb.mock.canvas.coursePageUrl(launchAs(newCanvasLearner())));
      const player = await startedPlayer(page, '/lti/play');
      const steps = scenarioSteps({ frame: () => player });
      await steps.start();
      await steps.goOn();
      await steps.choose(1, true);
      await steps.goOn();
      await steps.choose(0, true);
      await steps.goOn();
      await steps.choose(0, false);
      // WHY: the bridge posts within its 2-second tick; the context may close only after everything is stored.
      const stored = () => posts.filter((post) => post.status === 202).flatMap((post) => post.verbs);
      await expect
        .poll(() => stored().filter((verb) => verb === 'answered').length, { timeout: 20_000 })
        .toBe(3);
      await expect.poll(() => stored().includes('completed'), { timeout: 20_000 }).toBe(true);
      await context.close();
    }
    const rows = await app.tb.db.xapiStatement.findMany({
      where: { contentId, verb: 'answered' },
      orderBy: [{ learnerKey: 'asc' }, { timestamp: 'asc' }],
    });
    // WHY: a view holds the data up to and including yesterday (D-106's amendment), so today's plays move back.
    await moveStatementsToYesterday(app.tb.db, contentId);
    const launch = launchAs(CANVAS_USERS.teacher);
    const view = await insightAsLaunch(app, launch);
    const body = view.body as { items: unknown[]; branching: { item: string; questionText: string }[] };
    // Assert: three stored choices per learner: the index under the decision's ID, no score, one attempt
    expect(rows.map((row) => `${row.subContentId?.slice(-2)}=${row.response}`).join(' ')).toBe(
      Array<string>(LEARNERS).fill('02=1 02=0 05=0').join(' '),
    );
    expect(rows.every((row) => row.scoreMax === null && row.attemptId.endsWith(':1'))).toBe(true);
    // Assert: the view counts each learner's first choice and who chose again, and lists no decision as a question
    expect(view.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.branching).toMatchObject([
      {
        item: DECISIONS[0],
        questionText: 'Korleis vil du bruke tida før samlinga?',
        learners: shown(LEARNERS),
        options: [{ learners: shown(0) }, { learners: shown(LEARNERS) }],
        choseAgain: shown(LEARNERS),
      },
      {
        item: DECISIONS[1],
        learners: shown(LEARNERS),
        options: [{ learners: shown(LEARNERS) }, { learners: shown(0) }, { learners: shown(0) }],
        choseAgain: shown(0),
      },
    ]);
    // Assert: the scenario's author opens Innsikt in the portal, chooses the course and sees the part
    const context = await browser.newContext({ storageState: app.authorStorage });
    try {
      const page = await context.newPage();
      await page.goto(`${app.base}/aktivitet/${contentId}?fane=insight`);
      const courseOption = webText('insight.query.contextCourse', { label: course.label });
      const select = page.getByRole('combobox', { name: webText('insight.query.context') });
      // WHY: the list of courses is fetched after the page; a poll's own default gives it one second.
      const listed = () => select.locator('option', { hasText: courseOption }).count();
      await expect.poll(listed, { timeout: 30_000 }).toBe(1);
      await select.selectOption({ label: courseOption });
      await page.getByRole('button', { name: webText('insight.query.submit') }).click();
      const part = page.getByRole('region', { name: webText('insight.branching.heading') });
      await expect.poll(() => part.getByRole('heading', { level: 4 }).count(), { timeout: 30_000 }).toBe(2);
      const first = part.getByRole('table').first();
      expect(await first.locator('caption').textContent()).toBe(
        webText('insight.branching.caption', { question: 'Korleis vil du bruke tida før samlinga?' }),
      );
      expect(await first.locator('tbody tr td').allTextContents()).toEqual(['0', String(LEARNERS)]);
      const again = webText('insight.branching.choseAgain');
      expect(await part.locator('p', { hasText: again }).allTextContents()).toEqual([
        `${again} ${LEARNERS}`,
        `${again} 0`,
      ]);
    } finally {
      await context.close();
    }
  }, 300_000);
});
