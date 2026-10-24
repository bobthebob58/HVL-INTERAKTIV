/**
 * axe on every route of the web app, signed out and signed in as an author, in the light theme and with forced
 * colours emulated: the start page, help, privacy, the new-activity page (with H5P's content-type list), the 404
 * page, an activity page on each of its three tabs and with the publish dialog open, and the Canvas page of a
 * student's and a teacher's launch. No serious or critical violation besides the recorded H5P upstream problems;
 * lower-impact findings and checks to review are printed.
 *
 * Spec: UD-030, UD-012, UD-013, UD-011
 */
import { describe, it } from 'vitest';
import { describeA11y } from './support/a11ySuite.js';
import { scanPage } from './support/axeScan.js';
import { PLAIN_ROUTES } from './support/catalogue.js';
import { openLaunch, openWebPage } from './support/pages.js';
import { expectOnlyRecorded, recordedFor } from './support/upstreamFindings.js';
import { openView } from './support/views.js';

const MODES = [
  ['light', 'none'],
  ['forced colours', 'active'],
] as const;

describeA11y('[UD-030] axe on the web routes', (env) => {
  describe.each(MODES)('%s', (mode, forcedColors) => {
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
        const page = await openLaunch(context, app, app.ids.get('H5P.MultiChoice') ?? '', { teacher });
        // Act
        const report = await scanPage(page, `${mode}, Canvas page launched by ${who}`);
        // Assert
        expectOnlyRecorded(report, recordedFor('player', 'H5P.MultiChoice', { forced }));
        await context.close();
      },
    );
  });
});
