/**
 * insightViews — opens the Innsikt tab the way a teacher sees it: on the portal's activity page and on the Canvas
 * page (`/app/play`), with the insight API answered for the test's own browser context by a fixed, already suppressed
 * view: participation, three questions (one hidden below k), a choice and a gap task.
 *
 * Why: UD-030 scans every view in the state a person meets it in, and the Innsikt tab (INS-001…INS-010, INS-008) has
 *      charts, tables, «< k» cells and a shortlist only once a view has data. The scan needs every kind of section in
 *      one fixed state (a choice question, a gap task, a question hidden below k), whatever the clock and the stored
 *      learners, so the view is answered by Playwright routing, on the server's own origin and for this context
 *      only; the activity, the session, the launch and the validator's findings are real. The real insight API, with
 *      learners' stored statements, is proved in the browser by apps/server/e2e/insightInCanvas.e2e.test.ts.
 * Spec: UD-030, INS-008
 * Invariants:
 *   - The answer has the shape of apps/web/src/features/insight/insightReportShape.ts; a suppressed cell carries no
 *     value (INS-006), as the server's would.
 *   - Only `/api/content/<id>/insight`, `…/insight/contexts` and `…/insight/export` are answered; every other request
 *     reaches the real server.
 * Collaborators: ./pages.ts, ../../test/support/realWebApp.ts, ../../test/support/webAppTexts.ts,
 *   ../axeInsight.a11y.test.ts.
 * Tests: apps/server/a11y/axeInsight.a11y.test.ts
 */
import type { BrowserContext, Page } from 'playwright-core';
import type { RealWebApp } from '../../test/support/realWebApp.js';
import { webText } from '../../test/support/webAppTexts.js';
import { openActivityTab, openLaunch } from './pages.js';

/** The insight routes of any activity. */
const INSIGHT_ROUTE = /\/api\/content\/[^/?]+\/insight(\/contexts|\/export)?(\?.*)?$/;
const shown = (value: number) => ({ suppressed: false, value });
const HIDDEN = { suppressed: true };
/** A Canvas course of the mock platform, as D-103 keys it. */
const COURSE = { key: '0192f0c4-0000-7000-8000-0000000000a1:a11y-SYK110', label: 'SYK110' };

/**
 * The view the routed API answers.
 * @param contentId - The activity.
 * @param context - The context the view covers.
 * @returns The insight answer.
 */
export function insightView(contentId: string, context: { key: string; label: string | null }) {
  const question = 'Kva gjer mitokondriane?';
  return {
    scope: {
      contentId,
      contentVersion: 2,
      currentVersion: 2,
      context,
      period: '7d',
      periodStart: '2026-10-27T23:00:00.000Z',
      periodEnd: '2026-11-03T23:00:00.000Z',
      k: 5,
    },
    activity: { mainLibrary: 'H5P.QuestionSet', sendsLearningData: true, sendsRootResult: true },
    participation: {
      started: shown(24),
      completed: shown(18),
      completionRate: shown(0.75),
      completionBase: 'started',
      courseLearners: null,
      medianMinutesOnTask: shown(4.5),
      medianAttempts: shown(1.5),
    },
    items: [
      {
        item: 'q1',
        library: 'H5P.MultiChoice',
        questionText: question,
        learners: shown(20),
        firstCorrect: shown(0.4),
        latestCorrect: shown(0.65),
      },
      {
        item: 'q2',
        library: 'H5P.Blanks',
        questionText: 'Fyll inn namnet på organellen.',
        learners: shown(19),
        firstCorrect: shown(10 / 19),
        latestCorrect: shown(15 / 19),
      },
      {
        item: 'q3',
        library: 'H5P.TrueFalse',
        questionText: 'Celler har kjerne.',
        learners: HIDDEN,
        firstCorrect: HIDDEN,
        latestCorrect: HIDDEN,
      },
    ],
    misconceptions: [
      {
        kind: 'choice',
        item: 'q1',
        questionText: question,
        learners: shown(20),
        options: [
          { index: 0, text: 'Lagar energi', correct: true, feedback: null, learners: shown(8) },
          {
            index: 1,
            text: 'Lagrar arvestoff',
            correct: false,
            feedback: 'Arvestoffet ligg i cellekjernen.',
            learners: shown(9),
          },
          { index: 2, text: 'Byggjer protein', correct: false, feedback: null, learners: HIDDEN },
        ],
        noAnswer: HIDDEN,
      },
      {
        kind: 'gaps',
        item: 'q2',
        questionText: 'Fyll inn namnet på organellen.',
        learners: shown(19),
        gaps: [
          {
            index: 0,
            correctAnswers: ['mitokondrie', 'mitokondria'],
            correct: shown(10),
            wrongAnswers: [{ answer: 'ribosom', learners: shown(6) }],
            otherWrong: HIDDEN,
            // PRIVACY: the server hides the 0 too, so «Andre feil svar» cannot be worked out (INS-006)
            empty: HIDDEN,
          },
        ],
      },
    ],
    videoEngagement: null,
  };
}

/**
 * Answers the insight routes of this browser context with the fixed view.
 * @param context - The browser context.
 * @param contentId - The activity.
 * @param viewContext - The context the view covers: the portal, or the launch's course.
 */
export async function routeInsight(
  context: BrowserContext,
  contentId: string,
  viewContext: { key: string; label: string | null },
): Promise<void> {
  await context.route(INSIGHT_ROUTE, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/contexts')) {
      return route.fulfill({ json: { contexts: [{ key: 'portal', label: null }, COURSE] } });
    }
    if (path.endsWith('/export')) {
      return route.fulfill({ contentType: 'text/csv', body: 'del;verdi\n' });
    }
    return route.fulfill({ json: insightView(contentId, viewContext) });
  });
}

/**
 * Clicks the **Innsikt** tab and waits until the view, its tables and the findings have loaded.
 * @param page - An activity page or Canvas page of an author.
 */
export async function showInsightTab(page: Page): Promise<void> {
  await page.getByRole('tab', { name: webText('insight.tab') }).click();
  await page.getByRole('heading', { level: 3, name: webText('insight.participation.heading') }).waitFor();
  await page.locator('[role=tabpanel]:not([hidden]) table').first().waitFor();
  await page.waitForLoadState('networkidle');
}

/**
 * Opens the portal's activity page on its **Innsikt** tab.
 * @param app - The running server, with the signed-in author.
 * @param context - A browser context with the author's session.
 * @param contentId - One of the author's activities.
 * @returns The page with the tab shown.
 */
export async function openPortalInsight(
  app: RealWebApp,
  context: BrowserContext,
  contentId: string,
): Promise<Page> {
  await routeInsight(context, contentId, { key: 'portal', label: null });
  const page = await openActivityTab(context, app.base, contentId, 'play');
  await showInsightTab(page);
  return page;
}

/**
 * Launches the teacher's activity from the mock Canvas and opens its Canvas page on the **Innsikt** tab.
 * @param app - The running server.
 * @param context - A browser context without a portal session, as in Canvas.
 * @returns The page with the tab shown.
 */
export async function openCanvasInsight(app: RealWebApp, context: BrowserContext): Promise<Page> {
  const contentId = await app.teacherActivity();
  await routeInsight(context, contentId, COURSE);
  const page = await openLaunch(context, app, contentId, { teacher: true });
  await showInsightTab(page);
  return page;
}
