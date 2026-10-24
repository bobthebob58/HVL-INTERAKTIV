/**
 * axe on the H5P editor of one example activity of each of the ten content types, framed by the activity page's
 * **Rediger** tab as an author sees it, in the light theme and with forced colours emulated. Only the recorded H5P
 * upstream problems may remain, and each of them must still occur. BranchingScenario's editor opens with a guided
 * tour, so it is scanned with the tour open and again after the tour is closed.
 *
 * Spec: UD-030, UD-011, UD-012
 */
import { describe, expect, it } from 'vitest';
import { describeA11y } from './support/a11ySuite.js';
import { scanPage } from './support/axeScan.js';
import { COLOUR_MODES, CONTENT_TYPES } from './support/catalogue.js';
import { editorFrame } from './support/pages.js';
import { expectOnlyRecorded, recordedFor } from './support/upstreamFindings.js';
import { closeBranchingTour, openView } from './support/views.js';

describeA11y('[UD-030] axe on the H5P editor of each content type', (env) => {
  describe.each(COLOUR_MODES)('%s', (mode, forcedColors) => {
    const forced = forcedColors === 'active';

    it.each(CONTENT_TYPES)('[UD-030] the editor of %s has only recorded upstream problems', async (type) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ forcedColors, storageState: app.authorStorage });
      const contentId = app.ids.get(type) ?? '';
      const page = await openView(app, context, { kind: 'activity', tab: 'edit' }, { contentId });
      // Act
      const report = await scanPage(page, `${mode}, the editor of ${type}`);
      // Assert
      expectOnlyRecorded(report, recordedFor('editor', type, { forced }));
      await context.close();
    });

    it('[UD-030] the BranchingScenario editor after its guided tour has only recorded upstream problems', async () => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ forcedColors, storageState: app.authorStorage });
      const contentId = app.ids.get('H5P.BranchingScenario') ?? '';
      const page = await openView(app, context, { kind: 'activity', tab: 'edit' }, { contentId });
      // Act
      expect(await closeBranchingTour(await editorFrame(page))).toBeGreaterThan(0);
      const report = await scanPage(page, `${mode}, the BranchingScenario editor after its tour`);
      // Assert
      expectOnlyRecorded(report, recordedFor('editor', 'H5P.BranchingScenario', { forced, tour: false }));
      await context.close();
    });
  });
});
