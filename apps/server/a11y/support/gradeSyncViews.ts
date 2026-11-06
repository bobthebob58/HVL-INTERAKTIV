/**
 * gradeSyncViews — opens the grade-sync panel the way an author sees it: the portal's **Poeng til Canvas** tab of an
 * activity placed in two courses, and the same tab on the Canvas page (`/app/play`) of a teacher's activity, each
 * with scores in every state.
 *
 * Why: UD-030 scans every view in the state a person meets it in; the panel's states (sent, waiting, failed,
 *      deleted, a link without a gradebook column) only show once placements and jobs exist (LTI-012). The jobs are
 *      written straight into the database, as the grade worker is not running in the test server.
 * Spec: UD-030, LTI-012
 * Invariants:
 *   - Every placement is on the testbed's mock Canvas, so the testbed's close removes it with its jobs (cascade).
 *   - Each call shows its own placements: it removes the activity's earlier ones first, so a scan in the second colour
 *     mode shows the same page as the first, and a test that retries uses an activity of its own.
 * Collaborators: ../../test/support/realWebApp.ts, ../../test/grades/status/support/gradeSyncFixture.ts (`createJobs`),
 *   ./pages.ts, ../axeGradeSync.a11y.test.ts.
 * Tests: apps/server/a11y/axeGradeSync.a11y.test.ts
 */
import { randomUUID } from 'node:crypto';
import type { BrowserContext, Page } from 'playwright-core';
import { createJobs, type JobSpread } from '../../test/grades/status/support/gradeSyncFixture.js';
import type { RealWebApp } from '../../test/support/realWebApp.js';
import { webText } from '../../test/support/webAppTexts.js';
import { openActivityTab, openLaunch } from './pages.js';

/** The spread of scores the scanned placements show: every state at least once. */
export const SCANNED_JOBS: JobSpread = {
  succeeded: 12,
  pending: 3,
  failed: 2,
  failedWithoutSub: 1,
  orphaned: 1,
};

/**
 * Places an activity in a course of the mock Canvas, with a gradebook column unless said, and writes its jobs.
 * @param app - The running server.
 * @param contentId - The activity.
 * @param course - The course label, e.g. `SYK110`.
 * @param jobs - The jobs to write; none for a link without a gradebook column.
 * @returns The placement's ID.
 */
export async function placeWithJobs(
  app: RealWebApp,
  contentId: string,
  course: string,
  jobs?: JobSpread,
): Promise<string> {
  const { id } = await app.tb.db.ltiPlacement.create({
    data: {
      platformId: app.tb.platformId,
      contextId: `a11y-${course}-${randomUUID()}`,
      resourceLinkId: `a11y-grade-sync-${randomUUID()}`,
      contentId,
      contextLabel: course,
      lineItemUrl: jobs ? `${app.tb.mock.canvas.issuer}/api/lti/courses/1/line_items/${randomUUID()}` : null,
    },
  });
  if (jobs) await createJobs(app.tb.db, id, jobs);
  return id;
}

/**
 * Clicks the **Poeng til Canvas** tab and waits until its placements, with a gradebook column's counts, have loaded.
 * @param page - An activity page or Canvas page of an author.
 */
async function showGradeSyncTab(page: Page): Promise<void> {
  await page.getByRole('tab', { name: webText('gradeSync.tab') }).click();
  await page.getByRole('heading', { level: 2, name: webText('gradeSync.heading') }).waitFor();
  await page.locator('[role=tabpanel]:not([hidden]) section dl').first().waitFor();
  await page.waitForLoadState('networkidle');
}

/**
 * Opens the portal's activity page on its **Poeng til Canvas** tab, for an activity placed in a graded course and in
 * a course without a gradebook column.
 * @param app - The running server, with the signed-in author.
 * @param context - A browser context with the author's session.
 * @param contentId - One of the author's activities.
 * @returns The page with the tab shown.
 */
export async function openPortalGradeSync(
  app: RealWebApp,
  context: BrowserContext,
  contentId: string,
): Promise<Page> {
  // WHY: a scan in the other colour mode placed it already; the page shows this call's two placements alone.
  await app.tb.db.ltiPlacement.deleteMany({ where: { contentId } });
  await placeWithJobs(app, contentId, 'SYK110', SCANNED_JOBS);
  await placeWithJobs(app, contentId, 'NAT200');
  const page = await openActivityTab(context, app.base, contentId, 'play');
  await showGradeSyncTab(page);
  return page;
}

/**
 * Launches the teacher's activity from the mock Canvas and opens its Canvas page on the **Poeng til Canvas** tab,
 * with the launch's own placement given a gradebook column and scores.
 * @param app - The running server.
 * @param context - A browser context without a portal session, as in Canvas.
 * @returns The page with the tab shown.
 */
export async function openCanvasGradeSync(app: RealWebApp, context: BrowserContext): Promise<Page> {
  const contentId = await app.teacherActivity();
  const page = await openLaunch(context, app, contentId, { teacher: true });
  const placement = await app.tb.db.ltiPlacement.findFirstOrThrow({
    where: { contentId },
    orderBy: { createdAt: 'desc' },
  });
  // WHY: every launch records a placement of its own; the page then shows this launch's alone, as after one launch.
  await app.tb.db.ltiPlacement.deleteMany({ where: { contentId, id: { not: placement.id } } });
  await app.tb.db.ltiPlacement.update({
    where: { id: placement.id },
    data: { contextLabel: 'SYK110', lineItemUrl: `${app.tb.mock.canvas.issuer}/line_items/${randomUUID()}` },
  });
  await createJobs(app.tb.db, placement.id, SCANNED_JOBS);
  await showGradeSyncTab(page);
  return page;
}
