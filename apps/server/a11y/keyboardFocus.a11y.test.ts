/**
 * Keyboard focus in the browser. On every page of the web app the first Tab reaches the skip link, which moves focus
 * to `main#main`. Tabbing through every web view, and through the player of each content type in its Canvas page,
 * every element that receives focus shows a focus indicator, is inside the viewport and is not covered (sticky
 * header included, checked with `elementFromPoint`), and focus never gets stuck. A CoursePresentation slide that
 * takes focus shows the ring around the whole slide (HVL theme).
 *
 * Spec: UD-004, UD-006, UD-011
 */
import { expect, it } from 'vitest';
import type { Page } from 'playwright-core';
import { describeA11y } from './support/a11ySuite.js';
import { CONTENT_TYPES, viewName, WEB_VIEWS } from './support/catalogue.js';
import { tabTo, walkFocus, type FocusStop } from './support/focusWalk.js';
import { playerFrame } from './support/pages.js';
import { openView } from './support/views.js';

const DESKTOP = { width: 1280, height: 800 };

/** The views a page load opens; the activity page's other tabs are the same page after a click. */
const LOADED_VIEWS = WEB_VIEWS.filter((view) => view.kind !== 'activity' || view.tab === 'play');

/** The stops that break UD-004, each with what is wrong. */
const problems = (stops: readonly FocusStop[]): string[] =>
  stops.flatMap((stop) => [
    ...(stop.indicator ? [] : [`${stop.name}: no focus indicator`]),
    ...(stop.inViewport ? [] : [`${stop.name}: outside the viewport`]),
    ...(stop.coveredBy ? [`${stop.name}: covered by ${stop.coveredBy}`] : []),
  ]);

/** Tabs through a page and prints where focus went. */
const walk = async (page: Page, label: string, maxStops: number) => {
  const result = await walkFocus(page, maxStops);
  console.info(
    `UD-004 ${label}: ${result.stops.length} focus stops\n  ${result.stops.map((s) => s.name).join('\n  ')}`,
  );
  return result;
};

describeA11y('[UD-004] visible focus and [UD-006] keyboard access', (env) => {
  it.each(LOADED_VIEWS.map((view) => [viewName(view), view] as const))(
    '[UD-006] %s: the first Tab reaches the skip link, which moves focus to main',
    async (_name, view) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ viewport: DESKTOP, storageState: app.authorStorage });
      const page = await openView(app, context, view, { signedIn: true });
      // Act
      await page.keyboard.press('Tab');
      const first = await page.evaluate(() => document.activeElement?.textContent?.trim());
      await page.keyboard.press('Enter');
      // Assert
      expect(first).toBe('Gå til hovudinnhaldet');
      await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('main');
      await context.close();
    },
  );

  it.each(WEB_VIEWS.map((view) => [viewName(view), view] as const))(
    '[UD-004] %s: every focused element is visible and not covered',
    async (name, view) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ viewport: DESKTOP, storageState: app.authorStorage });
      const page = await openView(app, context, view, { signedIn: true });
      // Act
      const { stops, trapped } = await walk(page, name, 50);
      // Assert
      expect(trapped).toBeUndefined();
      expect(stops.length).toBeGreaterThan(2);
      expect(problems(stops)).toEqual([]);
      await context.close();
    },
  );

  it.each(CONTENT_TYPES)(
    '[UD-004] %s in Canvas: every focused element is visible and not covered',
    async (type) => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({ viewport: DESKTOP });
      const page = await openView(app, context, { kind: 'canvas' }, { contentId: app.ids.get(type) ?? '' });
      // Act
      const { stops, trapped } = await walk(page, `${type} in Canvas`, 40);
      // Assert
      expect(trapped).toBeUndefined();
      expect(stops.some((stop) => stop.name.includes(' in IFRAME'))).toBe(true);
      expect(problems(stops)).toEqual([]);
      await context.close();
    },
  );

  it('[UD-004] a CoursePresentation slide that has focus shows the two-tone ring around the slide', async () => {
    // Arrange
    const { app, browser } = env();
    const context = await browser.newContext({ viewport: DESKTOP });
    const contentId = app.ids.get('H5P.CoursePresentation') ?? '';
    const player = await playerFrame(await openView(app, context, { kind: 'canvas' }, { contentId }));
    // Act
    await tabTo(player.page(), '.h5p-slide > [role=document]');
    const ring = await player
      .locator('.h5p-slide.h5p-current')
      .evaluate((slide) => [getComputedStyle(slide).outline, getComputedStyle(slide).boxShadow]);
    // Assert
    expect(ring).toEqual(['rgb(0, 67, 87) solid 3px', 'rgb(255, 255, 255) 0px 0px 0px 5px inset']);
    await context.close();
  });
});
