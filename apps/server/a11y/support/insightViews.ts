/**
 * insightViews — opens the Innsikt tab the way a teacher sees it: on the portal's activity page and on the Canvas
 * page (`/app/play`), with the insight API answered for the test's own browser context by the fixed, already
 * suppressed view of ./insightFixture.ts, for its default period or one shortened to start on 1 August.
 *
 * Why: UD-030 scans every view in the state a person meets it in, and the Innsikt tab (INS-001…INS-010, INS-008) has
 *      charts, tables, «< k» cells, period notes and a shortlist only once a view has data. The scan needs every kind
 *      of section in one fixed state, whatever the clock and the stored learners, so the view is answered by
 *      Playwright routing, on the server's own origin and for this context only; the activity, the session, the
 *      launch and the validator's findings are real. The real insight API, with learners' stored statements, is
 *      proved in the browser by apps/server/e2e/insightInCanvas.e2e.test.ts.
 * Spec: UD-030, INS-008
 * Invariants:
 *   - Only `/api/content/<id>/insight`, `…/insight/contexts` and `…/insight/export` are answered; every other request
 *     reaches the real server.
 *   - Every view request gets the same answer, whatever period, context or version it asks for; a test that needs
 *     to know what was asked reads the request.
 * Collaborators: ./insightFixture.ts, ./pages.ts, ../../test/support/realWebApp.ts,
 *   ../../test/support/webAppTexts.ts, ../axeInsight.a11y.test.ts, ./dataTabViews.ts.
 * Tests: apps/server/a11y/axeInsight.a11y.test.ts, apps/server/a11y/keyboardJourneys.a11y.test.ts
 */
import type { BrowserContext, Page } from 'playwright-core';
import type { RealWebApp } from '../../test/support/realWebApp.js';
import { webText } from '../../test/support/webAppTexts.js';
import { insightView, LAST_SEVEN_DAYS, type InsightViewPeriod } from './insightFixture.js';
import { openActivityTab, openLaunch } from './pages.js';

/** The insight routes of any activity. */
const INSIGHT_ROUTE = /\/api\/content\/[^/?]+\/insight(\/contexts|\/export)?(\?.*)?$/;
/** A Canvas course of the mock platform, as D-103 keys it. */
const COURSE = { key: '0192f0c4-0000-7000-8000-0000000000a1:a11y-SYK110', label: 'SYK110' };

/**
 * Answers the insight routes of this browser context with the fixed view.
 * @param context - The browser context.
 * @param contentId - The activity.
 * @param viewContext - The context the view covers: the portal, or the launch's course.
 * @param period - The view's period: by default the last 7 days (./insightFixture.ts).
 */
export async function routeInsight(
  context: BrowserContext,
  contentId: string,
  viewContext: { key: string; label: string | null },
  period: InsightViewPeriod = LAST_SEVEN_DAYS,
): Promise<void> {
  await context.route(INSIGHT_ROUTE, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/contexts')) {
      return route.fulfill({ json: { contexts: [{ key: 'portal', label: null }, COURSE] } });
    }
    if (path.endsWith('/export')) {
      return route.fulfill({ contentType: 'text/csv', body: 'del;verdi\n' });
    }
    return route.fulfill({ json: insightView(contentId, viewContext, period) });
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
 * @param period - The view's period: by default the last 7 days (./insightFixture.ts).
 * @returns The page with the tab shown.
 */
export async function openPortalInsight(
  app: RealWebApp,
  context: BrowserContext,
  contentId: string,
  period: InsightViewPeriod = LAST_SEVEN_DAYS,
): Promise<Page> {
  await routeInsight(context, contentId, { key: 'portal', label: null }, period);
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
