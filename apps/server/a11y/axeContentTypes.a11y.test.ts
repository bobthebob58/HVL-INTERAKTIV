/**
 * axe inside the H5P player of one example activity of each of the ten content types, as a student opens it from
 * Canvas, in the light theme and with forced colours emulated; fresh, and again once its first task is answered
 * (./support/views.ts `startAndAnswer`: past the intro screen, on CoursePresentation's question slide, in
 * InteractiveVideo's question, with a DragText word dropped, the HVL feedback states shown) or, for ImageHotspots
 * and BranchingScenario, opened. Only the recorded H5P upstream problems may remain, and each of them must
 * still occur. Every scan must reach inside the player's frame (./support/axeFrames.ts); a control scan whose axe
 * cannot be injected into frames fails.
 *
 * Spec: UD-030, UD-011, UD-012, UD-003
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { AxeBuilder } from '@axe-core/playwright';
import { describe, expect, it } from 'vitest';
import { describeA11y } from './support/a11ySuite.js';
import { mergeReports, scanPage, WCAG_TAGS, type AxeReport } from './support/axeScan.js';
import { CONTENT_TYPES } from './support/catalogue.js';
import { playerFrame } from './support/pages.js';
import { expectOnlyRecorded, recordedFor } from './support/upstreamFindings.js';
import { openView, startAndAnswer, waitForStillness } from './support/views.js';

/** axe's own source (the copy @axe-core/playwright injects), made to fail in every frame but the top one, as an
 * injection that times out does. */
const FRAMELESS_AXE = `${readFileSync(
  createRequire(createRequire(import.meta.url).resolve('@axe-core/playwright')).resolve(
    'axe-core/axe.min.js',
  ),
  'utf8',
)}\nif (window !== window.top) throw new Error('Script Timeout');`;

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
        await startAndAnswer(player, type);
        await waitForStillness(player);
        reports.push(await scanPage(page, `${mode}, ${type} started or answered`));
        // Assert
        expectOnlyRecorded(
          mergeReports(`${mode}, ${type} in the Canvas page`, reports),
          recordedFor('player', type, { forced: forcedColors === 'active' }),
        );
        await context.close();
      },
    );
  });

  it('[UD-030] control: a scan that cannot enter the player frame fails instead of passing on the Canvas page', async () => {
    // Arrange
    const { app, browser } = env();
    const context = await browser.newContext();
    const page = await openView(app, context, { kind: 'canvas' });
    await playerFrame(page);
    // Act
    const frameless = new AxeBuilder({ page, axeSource: FRAMELESS_AXE }).withTags([...WCAG_TAGS]);
    const scan = scanPage(page, 'control, MultiChoice without its frame', frameless);
    // Assert
    await expect(scan).rejects.toThrow(/axe did not scan inside http:\/\/localhost:\d+\/lti\/play$/);
    await context.close();
  });
});
