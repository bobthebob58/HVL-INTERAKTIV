/**
 * Reflow and motion in the browser. At 320 × 640 CSS px (and turned to 640 × 320) no web view and no content type's
 * player scrolls sideways, in the page or in any frame; H5P.ImageHotspots may pan its image (UD-008's own
 * exception) but nothing else of it may. With reduced motion emulated, no CSS animation or transition moves in any
 * view or player, fresh or started and answered.
 *
 * Spec: UD-008, UD-009
 */
import { describe, expect, it } from 'vitest';
import { describeA11y } from './support/a11ySuite.js';
import { CONTENT_TYPES, PLAIN_ROUTES, viewName, WEB_VIEWS } from './support/catalogue.js';
import { horizontalOverflow, type Overflow } from './support/layoutChecks.js';
import { runningAnimations } from './support/motionAndNetwork.js';
import { playerFrame } from './support/pages.js';
import { openView, startAndAnswer, waitForStillness } from './support/views.js';

const ORIENTATIONS = [
  ['portrait', { width: 320, height: 640 }],
  ['landscape', { width: 640, height: 320 }],
] as const;

/**
 * UD-008's exception: an image with hotspots needs two dimensions and may pan. Only the hotspot image's own
 * container may be wider than the frame; its page and the rest of the activity must still reflow.
 */
const PANNING_ALLOWED = /image-hotspots|h5p-image-hotspot/;

/** Overflow that UD-008 does not excuse. */
const unexcused = (type: string, found: readonly Overflow[]): Overflow[] =>
  type === 'H5P.ImageHotspots'
    ? found.filter((o) => o.where === 'page' || !o.culprits.every((c) => PANNING_ALLOWED.test(c)))
    : [...found];

describeA11y('[UD-008] reflow and [UD-009] reduced motion', (env) => {
  describe.each(ORIENTATIONS)('%s', (_orientation, viewport) => {
    it.each(PLAIN_ROUTES)('[UD-008] signed out: %s does not scroll sideways', async (path) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ viewport });
      // Act
      const page = await openView(app, context, { kind: 'route', path });
      // Assert
      expect(await horizontalOverflow(page)).toEqual([]);
      await context.close();
    });

    it.each(WEB_VIEWS.map((view) => [viewName(view), view] as const))(
      '[UD-008] the author: %s does not scroll sideways',
      async (_name, view) => {
        // Arrange
        const { app, browser } = env();
        const context = await browser.newContext({ viewport, storageState: app.authorStorage });
        // Act
        const page = await openView(app, context, view, { signedIn: true });
        // Assert
        expect(await horizontalOverflow(page)).toEqual([]);
        await context.close();
      },
    );

    it.each(CONTENT_TYPES)(
      '[UD-008] %s in Canvas does not scroll sideways, fresh or started and answered',
      async (type) => {
        // Arrange
        const { app, browser } = env();
        const context = await browser.newContext({ viewport });
        const page = await openView(app, context, { kind: 'canvas' }, { contentId: app.ids.get(type) ?? '' });
        // Act
        const player = await playerFrame(page);
        await waitForStillness(player);
        const fresh = await horizontalOverflow(page);
        if (await startAndAnswer(player)) await waitForStillness(player);
        const answered = await horizontalOverflow(page);
        // Assert
        if (type === 'H5P.ImageHotspots') console.info(`UD-008 ${type} panning: ${JSON.stringify(fresh)}`);
        expect(unexcused(type, fresh)).toEqual([]);
        expect(unexcused(type, answered)).toEqual([]);
        await context.close();
      },
    );
  });

  it.each(WEB_VIEWS.map((view) => [viewName(view), view] as const))(
    '[UD-009] with reduced motion, nothing moves on %s',
    async (_name, view) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ reducedMotion: 'reduce', storageState: app.authorStorage });
      // Act
      const page = await openView(app, context, view, { signedIn: true });
      // Assert
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
      expect(await runningAnimations(page)).toEqual([]);
      await context.close();
    },
  );

  it.each(CONTENT_TYPES)(
    '[UD-009] with reduced motion, nothing moves in %s, fresh or started and answered',
    async (type) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      const page = await openView(app, context, { kind: 'canvas' }, { contentId: app.ids.get(type) ?? '' });
      // Act
      const fresh = await runningAnimations(page);
      const answered = (await startAndAnswer(await playerFrame(page))) ? await runningAnimations(page) : [];
      // Assert
      expect(fresh).toEqual([]);
      expect(answered).toEqual([]);
      await context.close();
    },
  );
});
