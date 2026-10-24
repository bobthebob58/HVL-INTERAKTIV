/**
 * Reflow and motion in the browser. At 320 × 640 CSS px (and turned to 640 × 320) no web view and no content type's
 * player scrolls sideways, in the page or in any frame; H5P.ImageHotspots may pan its image (UD-008's own
 * exception) but nothing else of it may. At both sizes and at 390 × 844, in the page and in full screen, a pointer
 * can press every footer control of CoursePresentation over 24 × 24 px: nothing lies over it and nothing clips it
 * (./support/pointerReach.ts tries every pixel; the other players' controls, and CoursePresentation's next button,
 * are pressed with real pointer clicks by ./support/views.ts `startAndAnswer`, which Playwright refuses on a
 * control covered at its centre). With reduced motion emulated, no CSS animation, transition or script
 * animation moves in any view or player at any moment from loading to answering its first task (recorded in every
 * frame as it starts); a control run without the preference records H5P's feedback motion, so the check can fail.
 *
 * Spec: UD-008, UD-009, UD-005
 */
import { describe, expect, it } from 'vitest';
import { describeA11y } from './support/a11ySuite.js';
import { CONTENT_TYPES, PLAIN_ROUTES, viewName, WEB_VIEWS } from './support/catalogue.js';
import { horizontalOverflow, type Overflow } from './support/layoutChecks.js';
import { recordedMotion, recordMotion } from './support/motionAndNetwork.js';
import { playerFrame } from './support/pages.js';
import { pointerReach } from './support/pointerReach.js';
import { openView, startAndAnswer, waitForStillness } from './support/views.js';

/** How long a check waits after the last action, for feedback motion that starts late (the score star's 800 ms). */
const SETTLE_MS = 1500;

const ORIENTATIONS = [
  ['portrait', { width: 320, height: 640 }],
  ['landscape', { width: 640, height: 320 }],
] as const;

/**
 * UD-008's exception: an image with hotspots needs two dimensions and may pan. Only the hotspot image's own
 * container may be wider than the frame; its page and the rest of the activity must still reflow.
 */
const PANNING_ALLOWED = /image-hotspots|h5p-image-hotspot/;

/** CoursePresentation's footer controls (slide navigation, side menu, full screen), in a strip it sizes as 7 %. */
const CP_FOOTER_CONTROLS = '.h5p-course-presentation .h5p-footer :is(button, [role=button])';
/** The reflow sizes and a common phone (390 × 844), each in the page and in full screen. */
const CP_FOOTER_CASES = [...ORIENTATIONS.map(([, size]) => size), { width: 390, height: 844 }].flatMap(
  (viewport) =>
    (['in the page', 'in full screen'] as const).map(
      (where) => [`${viewport.width} × ${viewport.height}`, where, viewport] as const,
    ),
);

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
        await startAndAnswer(player, type);
        await waitForStillness(player);
        const answered = await horizontalOverflow(page);
        // Assert
        if (type === 'H5P.ImageHotspots') console.info(`UD-008 ${type} panning: ${JSON.stringify(fresh)}`);
        expect(unexcused(type, fresh)).toEqual([]);
        expect(unexcused(type, answered)).toEqual([]);
        await context.close();
      },
    );
  });

  it.each(CP_FOOTER_CASES)(
    '[UD-008][UD-005] at %s %s, a pointer can press all of every footer control of H5P.CoursePresentation',
    async (_size, where, viewport) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ viewport });
      const contentId = app.ids.get('H5P.CoursePresentation') ?? '';
      const player = await playerFrame(await openView(app, context, { kind: 'canvas' }, { contentId }));
      await waitForStillness(player);
      if (where === 'in full screen') {
        await player.locator('.h5p-footer-toggle-full-screen').first().press('Enter');
        await expect.poll(() => player.locator('.h5p-course-presentation.h5p-fullscreen').count()).toBe(1);
      }
      // Act: on the second slide, where both slide buttons are enabled
      await player.locator('.h5p-theme-next').first().press('Enter');
      await waitForStillness(player);
      const { controls, covered } = await pointerReach(player, CP_FOOTER_CONTROLS);
      // Assert
      expect(controls.length).toBeGreaterThanOrEqual(4);
      expect(covered).toEqual([]);
      await context.close();
    },
  );

  it.each(WEB_VIEWS.map((view) => [viewName(view), view] as const))(
    '[UD-009] with reduced motion, nothing moves on %s',
    async (_name, view) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ reducedMotion: 'reduce', storageState: app.authorStorage });
      await recordMotion(context);
      // Act
      const page = await openView(app, context, view, { signedIn: true });
      await page.waitForTimeout(SETTLE_MS);
      // Assert
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
      expect(await recordedMotion(page)).toEqual([]);
      await context.close();
    },
  );

  it.each(CONTENT_TYPES)(
    '[UD-009] with reduced motion, nothing moves in %s, fresh or started and answered',
    async (type) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ reducedMotion: 'reduce' });
      await recordMotion(context);
      const page = await openView(app, context, { kind: 'canvas' }, { contentId: app.ids.get(type) ?? '' });
      // Act
      const fresh = await recordedMotion(page);
      await startAndAnswer(await playerFrame(page), type);
      await page.waitForTimeout(SETTLE_MS);
      const answered = await recordedMotion(page);
      // Assert
      expect(fresh).toEqual([]);
      expect(answered).toEqual([]);
      await context.close();
    },
  );

  it('[UD-009] control: without the preference, the recorder sees the feedback move in H5P.MultiChoice', async () => {
    // Arrange
    const { app, browser } = env();
    const context = await browser.newContext({ reducedMotion: 'no-preference' });
    await recordMotion(context);
    const page = await openView(app, context, { kind: 'canvas' });
    // Act
    await startAndAnswer(await playerFrame(page), 'H5P.MultiChoice');
    await page.waitForTimeout(SETTLE_MS);
    const motion = await recordedMotion(page);
    // Assert
    console.info(`UD-009 control, MultiChoice without reduced motion:\n  ${motion.join('\n  ')}`);
    expect(motion.some((line) => line.startsWith('/lti/play: transition'))).toBe(true);
    await context.close();
  });
});
