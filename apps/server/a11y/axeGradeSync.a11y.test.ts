/**
 * The grade-sync panel (S6) under axe and the keyboard: the portal's **Poeng til Canvas** tab of an activity placed in
 * a graded course and a course without a gradebook column, and the same tab on a teacher's Canvas page, each with
 * scores sent, waiting, failed and deleted, in the light theme and with forced colours emulated; then a keyboard-only
 * retry: Tab reaches «Send feila poeng på nytt», Enter sends, the outcome is said in the panel's status region, and
 * focus moves to the placement's heading once the button is gone. No serious or critical violation.
 *
 * Spec: UD-030, UD-006, LTI-012, LTI-013
 */
import { describe, expect, it } from 'vitest';
import { webText } from '../test/support/webAppTexts.js';
import { describeA11y } from './support/a11ySuite.js';
import { scanPage } from './support/axeScan.js';
import { COLOUR_MODES } from './support/catalogue.js';
import { tabTo } from './support/focusWalk.js';
import { openCanvasGradeSync, openPortalGradeSync, placeWithJobs } from './support/gradeSyncViews.js';
import { openActivityTab } from './support/pages.js';
import { expectOnlyRecorded } from './support/upstreamFindings.js';

describeA11y('[UD-030] axe on the grade-sync panel', (env) => {
  describe.each(COLOUR_MODES)('%s', (mode, forcedColors) => {
    it('[UD-030][LTI-012] the portal’s Poeng til Canvas tab has no serious or critical violation', async () => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ forcedColors, storageState: app.authorStorage });
      const page = await openPortalGradeSync(app, context, app.ids.get('H5P.MultiChoice') ?? '');
      // Act
      const report = await scanPage(page, `${mode}: /aktivitet/[id] Poeng til Canvas`);
      // Assert: the formative label is there, and every state is named in words
      expect(await page.getByRole('region', { name: webText('notice.formativeUse.title') }).count()).toBe(1);
      expect(await page.getByText(webText('gradeSync.orphaned')).count()).toBe(1);
      expect(await page.getByText(webText('gradeSync.notGraded')).count()).toBe(1);
      expectOnlyRecorded(report, []);
      await context.close();
    });

    it('[UD-030][LTI-012] the Canvas page’s Poeng til Canvas tab has no serious or critical violation', async () => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ forcedColors });
      const page = await openCanvasGradeSync(app, context);
      // Act
      const report = await scanPage(page, `${mode}: /app/play Poeng til Canvas`);
      // Assert
      expect(await page.locator('[role=tabpanel]:not([hidden]) section dl').count()).toBe(1);
      expectOnlyRecorded(report, []);
      await context.close();
    });
  });

  it('[UD-006][LTI-012] keyboard: Tab reaches the retry, Enter sends it, the outcome is announced and focus is on the heading', async () => {
    // Arrange: an activity of its own, so the retry changes nothing the scans see
    const { app, browser } = env();
    const contentId = app.ids.get('H5P.Blanks') ?? '';
    await placeWithJobs(app, contentId, 'KEY100', { succeeded: 1, failed: 2 });
    const { name: platform } = await app.tb.db.ltiPlatform.findUniqueOrThrow({
      where: { id: app.tb.platformId },
    });
    const heading = webText('gradeSync.placementHeading', { course: 'KEY100', platform });
    const context = await browser.newContext({ storageState: app.authorStorage });
    const page = await openActivityTab(context, app.base, contentId, 'play');
    // Act: the tab list's last tab with End, chosen with Enter; then Tab to the button and Enter
    await tabTo(page, '[role=tab][aria-selected=true]');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: webText('gradeSync.retry') }).waitFor();
    await tabTo(page, '[role=tabpanel]:not([hidden]) section button');
    await page.keyboard.press('Enter');
    // Assert: said in the panel's status region, the button gone, focus on the placement's heading
    const said = `${heading}: ${webText('gradeSync.retriedOther', { count: 2 })}`;
    const panel = page.locator('[role=tabpanel]:not([hidden])');
    await expect.poll(() => panel.locator('p[role=status]').first().textContent()).toBe(said);
    await expect
      .poll(() =>
        page.evaluate(() => `${document.activeElement?.tagName} ${document.activeElement?.textContent}`),
      )
      .toBe(`H3 ${heading}`);
    expect(await panel.getByRole('button', { name: webText('gradeSync.retry') }).count()).toBe(0);
    await context.close();
  });
});
