/**
 * axe on the pages Express renders itself (D-067), in the light theme and with forced colours emulated: the friendly
 * pages for a missing or invalid ltik, an unavailable activity in Canvas, an unknown activity in the player and
 * editor frames and the signed-out page, and the Deep Linking picker with its formative notice. No serious or
 * critical violation.
 *
 * Spec: UD-030, UD-012, UD-013, LTI-005
 */
import { describe, expect, it } from 'vitest';
import { describeA11y } from './support/a11ySuite.js';
import { scanPage } from './support/axeScan.js';
import { openFramed, openServerAnswer, openWebPage } from './support/pages.js';
import { expectOnlyRecorded } from './support/upstreamFindings.js';

const MODES = [
  ['light', 'none'],
  ['forced colours', 'active'],
] as const;

/** An activity ID no activity has. */
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

describeA11y('[UD-030] axe on the server-rendered pages', (env) => {
  describe.each(MODES)('%s', (mode, forcedColors) => {
    it.each([
      ['the signed-out page', '/auth/logged-out', 200],
      ['the Canvas page without an ltik', '/app/play', 401],
      ['the Canvas page with an invalid ltik', '/app/play?ltik=not-a-launch', 401],
      ['the picker without an ltik', '/lti/deeplink', 401],
    ])('[UD-030] %s has no serious or critical violation', async (name, path, status) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ forcedColors });
      const page = await context.newPage();
      // Act
      const response = await page.goto(`${app.base}${path}`);
      const report = await scanPage(page, `${mode}, ${name}`);
      // Assert
      expect(response?.status()).toBe(status);
      expectOnlyRecorded(report, []);
      await context.close();
    });

    it('[UD-030] the "not available" answer to a launch of a draft has no serious or critical violation', async () => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ forcedColors });
      const { status, html } = await app.refusedLaunch(app.draftId);
      // Act
      const page = await openServerAnswer(context, app.base, html);
      const report = await scanPage(page, `${mode}, the answer to a launch of a draft`);
      // Assert
      expect(status).toBeGreaterThanOrEqual(400);
      expect(await page.locator('h1').count()).toBe(1);
      expectOnlyRecorded(report, []);
      await context.close();
    });

    it.each(['play', 'edit'])(
      '[UD-030] the "not available" page in a %s frame has no serious or critical violation',
      async (kind) => {
        // Arrange
        const { app, browser } = env();
        const context = await browser.newContext({ forcedColors, storageState: app.authorStorage });
        const path = `/h5p/${kind}/${UNKNOWN_ID}`;
        // Act
        const { page, frame } = await openFramed(context, app.base, path, `Ramme: ${kind}`);
        const report = await scanPage(page, `${mode}, ${path} in a frame`);
        // Assert
        expect(await frame.locator('h1').count()).toBe(1);
        expectOnlyRecorded(report, []);
        await context.close();
      },
    );

    it('[UD-030] the Deep Linking picker with its formative notice has no serious or critical violation', async () => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ forcedColors });
      const ltik = await app.deepLink();
      const page = await openWebPage(
        context,
        app.base,
        `/lti/deeplink?ltik=${encodeURIComponent(ltik)}`,
        false,
      );
      // Act
      const report = await scanPage(page, `${mode}, the Deep Linking picker`);
      // Assert
      expect(await page.locator('input[name=contentId]').count()).toBe(2);
      expectOnlyRecorded(report, []);
      await context.close();
    });
  });
});
