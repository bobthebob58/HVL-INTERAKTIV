/**
 * axe on every route of the web app, signed out and signed in as an author, in the light theme and with forced
 * colours emulated: the start page, help, privacy, the new-activity page (with H5P's content-type list), the 404
 * page, the læringsdesign studio's pages (the guide with the real guide text, the planner's course chooser, the
 * content bank and `/mappe` with the author's activities; their seeded states are in axeStudioViews.a11y.test.ts),
 * an activity page on each of its three tabs (the formative-use notice showing on Rediger) and with the publish
 * dialog open, and the Canvas page of a student's launch and of a teacher's launch of their own activity, on Spel and
 * on Rediger with its notice. No serious or critical violation besides the recorded H5P upstream problems; lower-impact findings
 * and checks to review are printed.
 *
 * Spec: UD-030, UD-012, UD-013, UD-011, PROD-011
 */
import { describe, expect, it } from 'vitest';
import { describeA11y } from './support/a11ySuite.js';
import { mergeReports, scanPage } from './support/axeScan.js';
import { COLOUR_MODES, PLAIN_ROUTES } from './support/catalogue.js';
import { noticeRegion } from './support/formativeNotice.js';
import { editorFrame, openLaunch, openWebPage } from './support/pages.js';
import { expectOnlyRecorded, recordedFor } from './support/upstreamFindings.js';
import { openView } from './support/views.js';

describeA11y('[UD-030] axe on the web routes', (env) => {
  describe.each(COLOUR_MODES)('%s', (mode, forcedColors) => {
    const forced = forcedColors === 'active';

    it.each([...PLAIN_ROUTES, '/aktivitet/<id>'])(
      '[UD-030] signed out: %s has no serious or critical violation',
      async (route) => {
        // Arrange
        const { app, browser } = env();
        const context = await browser.newContext({ forcedColors });
        const path = route === '/aktivitet/<id>' ? `/aktivitet/${app.draftId}` : route;
        const page = await openWebPage(context, app.base, path);
        // Act
        const report = await scanPage(page, `${mode}, signed out: ${route}`);
        // Assert
        expectOnlyRecorded(report, []);
        await context.close();
      },
    );

    it.each(PLAIN_ROUTES)('[UD-030] signed in: %s has only recorded upstream problems', async (path) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ forcedColors, storageState: app.authorStorage });
      const page = await openView(app, context, { kind: 'route', path }, { signedIn: true });
      // Act
      const report = await scanPage(page, `${mode}, signed in: ${path}`);
      // Assert
      expectOnlyRecorded(report, path === '/aktivitet/ny' ? recordedFor('hub', '*', { forced }) : []);
      await context.close();
    });

    it.each(['play', 'edit', 'check'] as const)(
      '[UD-030] signed in: an activity page on its %s tab has only recorded upstream problems',
      async (tab) => {
        // Arrange
        const { app, browser } = env();
        const context = await browser.newContext({ forcedColors, storageState: app.authorStorage });
        const page = await openView(app, context, { kind: 'activity', tab });
        if (tab === 'edit') await noticeRegion(page).waitFor({ timeout: 15_000 });
        // Act
        const report = await scanPage(page, `${mode}, signed in: /aktivitet/<MultiChoice draft> (${tab})`);
        // Assert
        const surface = tab === 'edit' ? 'editor' : 'player';
        expectOnlyRecorded(report, recordedFor(surface, 'H5P.MultiChoice', { forced }));
        await context.close();
      },
    );

    it('[UD-030] signed in: the publish dialog has no serious or critical violation', async () => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ forcedColors, storageState: app.authorStorage });
      const page = await openView(app, context, { kind: 'activity', tab: 'check' });
      await page.getByRole('button', { name: 'Publiser', exact: true }).click();
      await page.getByRole('dialog', { name: 'Publiser aktiviteten' }).waitFor();
      // Act
      const report = await scanPage(page, `${mode}, signed in: the publish dialog`);
      // Assert
      expectOnlyRecorded(report, []);
      await context.close();
    });

    it.each([
      ['a student', false],
      ['the teacher', true],
    ])(
      '[UD-030] Canvas: /app/play launched by %s has only recorded upstream problems',
      async (who, teacher) => {
        // Arrange
        const { app, browser } = env();
        const context = await browser.newContext({ forcedColors });
        // WHY: the teacher launches an activity of their own, so the page also has Rediger and its notice.
        const contentId = teacher ? await app.teacherActivity() : (app.ids.get('H5P.MultiChoice') ?? '');
        const page = await openLaunch(context, app, contentId, { teacher });
        // Act
        const reports = [await scanPage(page, `${mode}, Canvas page launched by ${who}`)];
        if (teacher) {
          await page.getByRole('tab', { name: 'Rediger' }).click();
          await editorFrame(page);
          await noticeRegion(page).waitFor({ timeout: 15_000 });
          reports.push(await scanPage(page, `${mode}, Canvas page launched by ${who}, on Rediger`));
        }
        // Assert
        expect(reports).toHaveLength(teacher ? 2 : 1);
        const recorded = [
          ...recordedFor('player', 'H5P.MultiChoice', { forced }),
          ...(teacher ? recordedFor('editor', 'H5P.MultiChoice', { forced }) : []),
        ];
        expectOnlyRecorded(mergeReports(`${mode}, Canvas page launched by ${who}`, reports), recorded);
        await context.close();
      },
    );
  });
});
