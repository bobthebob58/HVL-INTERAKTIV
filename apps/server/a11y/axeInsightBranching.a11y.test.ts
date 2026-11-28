/**
 * The Innsikt tab of a Branching Scenario (INS-004) under axe: the portal's tab with the decisions' part, each
 * decision a figure with its summary, chart and table, «< 5» cells with their spoken reason, a decision and an
 * option without text named by their place; in the light theme and with forced colours emulated, and at phone
 * width without sideways scrolling of the page or of a decision's table. No serious or critical violation. The view is answered by routing
 * (./support/insightViews.ts, ./support/insightBranchingFixture.ts).
 *
 * Spec: UD-030, UD-008, INS-004, INS-008, INS-006
 */
import { describe, expect, it } from 'vitest';
import { webText } from '../test/support/webAppTexts.js';
import { describeA11y } from './support/a11ySuite.js';
import { scanPage } from './support/axeScan.js';
import { COLOUR_MODES } from './support/catalogue.js';
import { FIRST_DECISION } from './support/insightBranchingFixture.js';
import { openPortalBranchingInsight } from './support/insightViews.js';
import { expectOnlyRecorded } from './support/upstreamFindings.js';

const PANEL = '[role=tabpanel]:not([hidden])';

describeA11y('[UD-030] axe on the Innsikt tab of a Branching Scenario', (env) => {
  describe.each(COLOUR_MODES)('%s', (mode, forcedColors) => {
    it('[UD-030][INS-004] the decisions’ part has no serious or critical violation', async () => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ forcedColors, storageState: app.authorStorage });
      const page = await openPortalBranchingInsight(app, context);
      // Act
      const report = await scanPage(page, `${mode}: /aktivitet/[id] Innsikt, Branching Scenario`);
      // Assert: the part is a named region with one figure, summary and captioned table per decision
      const part = page.getByRole('region', { name: webText('insight.branching.heading') });
      expect(await part.getByRole('heading', { level: 4 }).allTextContents()).toEqual([
        FIRST_DECISION,
        'Korleis gjer du materiellet tilgjengeleg for alle?',
        webText('insight.branching.untitled', { number: 3 }),
      ]);
      expect(await part.locator('figure').count()).toBe(3);
      expect(await part.locator('figure figcaption').count()).toBe(3);
      expect(await part.locator('figure table caption').count()).toBe(3);
      // Assert: every hidden value says why (INS-006): 2 options of the second decision, 4 cells of the third
      const hidden = part.locator('.sr-only', { hasText: webText('insight.suppressedSr') });
      expect(await hidden.count()).toBe(6);
      expectOnlyRecorded(report, []);
      await context.close();
    });
  });

  it('[UD-008][INS-004] at phone width the decisions’ part scrolls neither the page nor its tables sideways', async () => {
    // Arrange
    const { app, browser } = env();
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: app.authorStorage,
    });
    // Act
    const page = await openPortalBranchingInsight(app, context);
    // Assert: the page itself never scrolls sideways
    const widths = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(widths[0]).toBeLessThanOrEqual(widths[1] ?? 0);
    // Assert: a decision's table has two columns and fits: its region has nothing to scroll to
    const part = page.getByRole('region', { name: webText('insight.branching.heading') });
    const overflow = await part
      .locator('[role=region]')
      .evaluateAll((regions) => regions.map((region) => region.scrollWidth - region.clientWidth));
    expect(overflow).toEqual([0, 0, 0]);
    expect(await page.locator(`${PANEL} figure table`).count()).toBe(3);
    await context.close();
  });
});
