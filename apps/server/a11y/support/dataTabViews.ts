/**
 * dataTabViews — opens a tab that shows learning data (./catalogue.ts `DATA_TABS`) the way an author meets it, for the
 * suites that walk every web view: «Poeng til Canvas» with scores in every state, and «Innsikt» with suppressed
 * cells, on the portal's activity page and on the Canvas page of a teacher's launch.
 *
 * Why: UD-008, UD-009, UD-004, UD-005, UD-002, UD-010 and DATA-011 hold for every view, and these two tabs (S6) show
 *      their tables, buttons and notes only once placements, scores or an insight view exist. The suites that walk
 *      ./catalogue.ts's `WEB_VIEWS` reach them through here, in the same state the axe scans see
 *      (../axeGradeSync.a11y.test.ts, ../axeInsight.a11y.test.ts).
 * Spec: UD-030, UD-008, LTI-012, INS-008
 * Invariants:
 *   - The portal's grade sync shows the published MultiChoice's own placements and the portal's insight the
 *     published QuestionSet, as the axe scans do; the Canvas tabs are the teacher's activity (`teacherActivity`).
 *   - Each call opens a new page in the given context and leaves the tab shown, its content loaded.
 * Collaborators: ./gradeSyncViews.ts, ./insightViews.ts, ./views.ts (`openView`), ./catalogue.ts.
 * Tests: apps/server/a11y/reflowAndMotion.a11y.test.ts and every suite that walks ./catalogue.ts's `WEB_VIEWS`.
 */
import type { BrowserContext, Page } from 'playwright-core';
import type { RealWebApp } from '../../test/support/realWebApp.js';
import type { WebView } from './catalogue.js';
import { openCanvasGradeSync, openPortalGradeSync } from './gradeSyncViews.js';
import { openCanvasInsight, openPortalInsight } from './insightViews.js';

/** A view of a tab that shows learning data. */
export type DataTabView = Extract<WebView, { kind: 'dataTab' }>;

/**
 * Opens a data tab in the portal or in Canvas.
 * @param app - The running server, with the signed-in author.
 * @param context - A browser context; for the portal, one with the author's session.
 * @param view - Which tab, and where.
 * @returns The page with the tab shown.
 */
export async function openDataTab(
  app: RealWebApp,
  context: BrowserContext,
  view: DataTabView,
): Promise<Page> {
  if (view.tab === 'gradeSync') {
    return view.where === 'portal'
      ? openPortalGradeSync(app, context, app.ids.get('H5P.MultiChoice') ?? '')
      : openCanvasGradeSync(app, context);
  }
  return view.where === 'portal'
    ? openPortalInsight(app, context, app.ids.get('H5P.QuestionSet') ?? '')
    : openCanvasInsight(app, context);
}
