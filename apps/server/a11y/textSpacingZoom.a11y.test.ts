/**
 * Text resizing and spacing on every web view and in the player of each content type: at 200 % zoom (a 1280 × 800
 * window zoomed to show 640 × 400 CSS px) no text is clipped and nothing scrolls sideways (WCAG 1.4.4, 1.4.10), and
 * with the WCAG 1.4.12 text-spacing styles added to every document no text is clipped (UD-002's "bookmarklet"
 * check), signed out and as the author. In the page every clipped text counts; inside the H5P frames (player,
 * editor, content-type list) what the zoom or the spacing cuts off counts, since H5P clips some containers on
 * purpose (./support/layoutChecks.ts); text pushed further out of such a container counts too, which a control
 * (CoursePresentation's footer moved out of its root, with each change) shows.
 *
 * Spec: UD-002, UD-008, UD-011
 */
import { describe, expect, it } from 'vitest';
import type { BrowserContextOptions, Page } from 'playwright-core';
import { describeA11y, type A11yEnv } from './support/a11ySuite.js';
import {
  CONTENT_TYPES,
  PLAIN_ROUTES,
  viewName,
  WEB_VIEWS,
  type ContentType,
  type WebView,
} from './support/catalogue.js';
import {
  addUserStyles,
  clippedTextEverywhere,
  horizontalOverflow,
  markClippedText,
  TEXT_SPACING_CSS,
} from './support/layoutChecks.js';
import { playerFrame } from './support/pages.js';
import { openView, waitForStillness } from './support/views.js';

/** A 1280 × 800 window at 200 % zoom shows half the CSS pixels with twice the device pixels. */
const WINDOW = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 };
const ZOOMED = { width: 640, height: 400 };

/** The control's rule: CoursePresentation's footer, inside the root that clips the player, moved out of it. */
const FOOTER_PUSHED_OUT = '.h5p-footer { position: relative !important; top: 2000px !important; }';

/** One view to check: what to open, whether as the signed-in author, and the content type of a Canvas view. */
type Case = { readonly view: WebView; readonly signedIn: boolean; readonly type?: ContentType };

const CASES: readonly (readonly [string, Case])[] = [
  ...PLAIN_ROUTES.map(
    (path) => [`signed out: ${path}`, { view: { kind: 'route', path }, signedIn: false }] as const,
  ),
  ...WEB_VIEWS.map((view) => [`the author: ${viewName(view)}`, { view, signedIn: true }] as const),
  ...CONTENT_TYPES.map(
    (type) => [`${type} in Canvas`, { view: { kind: 'canvas' }, signedIn: false, type }] as const,
  ),
];

/** Opens a case and, for a Canvas view, waits until its player stands still. */
async function open({ app, browser }: A11yEnv, kase: Case, options: BrowserContextOptions): Promise<Page> {
  const context = await browser.newContext({
    ...options,
    ...(kase.signedIn ? { storageState: app.authorStorage } : {}),
  });
  const contentId = kase.type ? app.ids.get(kase.type) : undefined;
  const page = await openView(app, context, kase.view, {
    signedIn: kase.signedIn,
    ...(contentId ? { contentId } : {}),
  });
  if (kase.view.kind === 'canvas') await waitForStillness(await playerFrame(page));
  return page;
}

describeA11y('[UD-002] text resizing and spacing', (env) => {
  describe.each(CASES)('%s', (_name, kase) => {
    it('[UD-002] at 200 % zoom no text is clipped and nothing scrolls sideways', async () => {
      // Arrange
      const page = await open(env(), kase, WINDOW);
      await markClippedText(page);
      // Act
      await page.setViewportSize(ZOOMED);
      await page.waitForTimeout(1000);
      // Assert
      expect(await clippedTextEverywhere(page)).toEqual([]);
      expect(await horizontalOverflow(page)).toEqual([]);
      await page.context().close();
    });

    it('[UD-002] with the 1.4.12 text-spacing styles no text is clipped', async () => {
      // Arrange
      const page = await open(env(), kase, {});
      await markClippedText(page);
      // Act
      const documents = await addUserStyles(page, TEXT_SPACING_CSS);
      await page.waitForTimeout(500);
      // Assert
      expect(documents).toBe(page.frames().length);
      expect(await page.evaluate(() => getComputedStyle(document.body).letterSpacing)).not.toBe('normal');
      expect(await clippedTextEverywhere(page)).toEqual([]);
      await page.context().close();
    });
  });

  it.each(['text spacing', '200 % zoom'] as const)(
    '[UD-002] control (%s): text pushed out of a box H5P already clips is reported (CoursePresentation footer)',
    async (change) => {
      // Arrange: CoursePresentation's root clips on purpose, so it is recorded before the change
      const kase: Case = { view: { kind: 'canvas' }, signedIn: false, type: 'H5P.CoursePresentation' };
      const zoom = change === '200 % zoom';
      const page = await open(env(), kase, zoom ? WINDOW : {});
      const recorded = await markClippedText(page);
      // Act: the change, plus a rule that moves the footer navigation below the root's bottom edge
      if (zoom) await page.setViewportSize(ZOOMED);
      await addUserStyles(page, zoom ? FOOTER_PUSHED_OUT : `${TEXT_SPACING_CSS} ${FOOTER_PUSHED_OUT}`);
      await page.waitForTimeout(1000);
      const reported = await clippedTextEverywhere(page);
      // Assert
      expect(recorded.some((line) => line.includes('.h5p-course-presentation'))).toBe(true);
      expect(reported.filter((line) => line.includes('.h5p-course-presentation'))).toHaveLength(1);
      await page.context().close();
    },
  );
});
