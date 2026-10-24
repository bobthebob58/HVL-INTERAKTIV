/**
 * Pointer targets of at least 24 × 24 CSS px (WCAG 2.5.8) on every web view and in the player of each content type,
 * fresh and once started or answered (./support/views.ts `startAndAnswer`). A smaller target passes only through
 * one of 2.5.8's exceptions (spacing, a link inside a sentence) or as a slider, and every such target is printed,
 * so the H5P exceptions are on record.
 *
 * Spec: UD-005, UD-011
 */
import { expect, it } from 'vitest';
import { describeA11y } from './support/a11ySuite.js';
import { CONTENT_TYPES, viewName, WEB_VIEWS } from './support/catalogue.js';
import { playerFrame } from './support/pages.js';
import { measureTargets, type MeasuredTarget } from './support/targetSizes.js';
import { openView, startAndAnswer, waitForStillness } from './support/views.js';

/** Prints the targets that pass only through an exception and returns the ones that fail. */
const failing = (label: string, targets: readonly MeasuredTarget[]): string[] => {
  const excepted = targets.filter((t) => t.verdict !== 'size' && t.verdict !== 'fails');
  if (excepted.length) {
    console.info(
      `UD-005 ${label}: smaller than 24 px by exception\n  ${excepted
        .map((t) => `${t.verdict}: ${t.name} ${t.width}×${t.height}`)
        .join('\n  ')}`,
    );
  }
  return targets.filter((t) => t.verdict === 'fails').map((t) => `${t.name} ${t.width}×${t.height}`);
};

describeA11y('[UD-005] target size', (env) => {
  it.each(WEB_VIEWS.map((view) => [viewName(view), view] as const))(
    '[UD-005] %s: every target of the page is 24 × 24 px or excepted',
    async (name, view) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ storageState: app.authorStorage });
      const page = await openView(app, context, view, { signedIn: true });
      // Act
      const targets = await measureTargets(page.mainFrame());
      // Assert
      expect(targets.length).toBeGreaterThanOrEqual(2);
      expect(failing(name, targets)).toEqual([]);
      await context.close();
    },
  );

  it.each(CONTENT_TYPES)(
    '[UD-005] %s: every target of the player is 24 × 24 px or excepted',
    async (type) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext();
      const page = await openView(app, context, { kind: 'canvas' }, { contentId: app.ids.get(type) ?? '' });
      const player = await playerFrame(page);
      // Act
      await waitForStillness(player);
      const fresh = await measureTargets(player);
      const changed = await startAndAnswer(player);
      if (changed) await waitForStillness(player);
      const answered = changed ? await measureTargets(player) : [];
      // Assert
      expect(failing(`${type} fresh`, fresh)).toEqual([]);
      expect(failing(`${type} started or answered`, answered)).toEqual([]);
      await context.close();
    },
  );
});
