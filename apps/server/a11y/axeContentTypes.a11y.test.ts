/**
 * axe inside the H5P player of one example activity of each of the ten content types, as a student opens it from
 * Canvas, in the light theme and with forced colours emulated; fresh, and again after leaving the intro screen
 * (QuestionSet, InteractiveBook, BranchingScenario) and answering the first question where it has a check button
 * (the HVL feedback states). Only the recorded H5P upstream problems may remain, and each of them must
 * still occur.
 *
 * Spec: UD-030, UD-011, UD-012, UD-003
 */
import { describe, it } from 'vitest';
import { describeA11y } from './support/a11ySuite.js';
import { mergeReports, scanPage, type AxeReport } from './support/axeScan.js';
import { CONTENT_TYPES } from './support/catalogue.js';
import { playerFrame } from './support/pages.js';
import { expectOnlyRecorded, recordedFor } from './support/upstreamFindings.js';
import { openView, startAndAnswer, waitForStillness } from './support/views.js';

const MODES = [
  ['light', 'none'],
  ['forced colours', 'active'],
] as const;

describeA11y('[UD-030] axe inside the H5P player of each content type', (env) => {
  describe.each(MODES)('%s', (mode, forcedColors) => {
    it.each(CONTENT_TYPES)(
      '[UD-030] %s has only recorded upstream problems, fresh and started or answered',
      async (type) => {
        // Arrange
        const { app, browser } = env();
        const context = await browser.newContext({ forcedColors });
        const page = await openView(app, context, { kind: 'canvas' }, { contentId: app.ids.get(type) ?? '' });
        // Act
        const player = await playerFrame(page);
        await waitForStillness(player);
        const reports: AxeReport[] = [await scanPage(page, `${mode}, ${type} fresh`)];
        if (await startAndAnswer(player)) {
          await waitForStillness(player);
          reports.push(await scanPage(page, `${mode}, ${type} started or answered`));
        }
        // Assert
        expectOnlyRecorded(
          mergeReports(`${mode}, ${type} in the Canvas page`, reports),
          recordedFor('player', type, { forced: forcedColors === 'active' }),
        );
        await context.close();
      },
    );
  });
});
