/**
 * Text resizing and spacing on every web view: at 200 % zoom (a 1280 × 800 window shows 640 × 400 CSS px) no text is
 * clipped and nothing scrolls sideways (WCAG 1.4.4, 1.4.10), and with the WCAG 1.4.12 text-spacing styles added no
 * text is clipped (UD-002's "bookmarklet" check), signed out and as the author.
 *
 * Spec: UD-002, UD-008
 */
import { describe, expect, it } from 'vitest';
import { describeA11y } from './support/a11ySuite.js';
import { PLAIN_ROUTES, viewName, WEB_VIEWS, type WebView } from './support/catalogue.js';
import { addUserStyles, clippedText, horizontalOverflow, TEXT_SPACING_CSS } from './support/layoutChecks.js';
import { openView } from './support/views.js';

/** A 1280 × 800 window at 200 % zoom: half the CSS pixels, twice the device pixels. */
const ZOOM_200 = { viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 };

const CASES: readonly (readonly [string, WebView, boolean])[] = [
  ...PLAIN_ROUTES.map((path) => [`signed out: ${path}`, { kind: 'route', path } as const, false] as const),
  ...WEB_VIEWS.map((view) => [`the author: ${viewName(view)}`, view, true] as const),
];

describeA11y('[UD-002] text resizing and spacing', (env) => {
  describe.each(CASES)('%s', (_name, view, signedIn) => {
    it('[UD-002] at 200 % zoom no text is clipped and nothing scrolls sideways', async () => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext({
        ...ZOOM_200,
        ...(signedIn ? { storageState: app.authorStorage } : {}),
      });
      // Act
      const page = await openView(app, context, view, { signedIn });
      // Assert
      expect(await clippedText(page.mainFrame())).toEqual([]);
      expect(await horizontalOverflow(page)).toEqual([]);
      await context.close();
    });

    it('[UD-002] with the 1.4.12 text-spacing styles no text is clipped', async () => {
      // Arrange
      const { app, browser } = env();
      const context = await browser.newContext(signedIn ? { storageState: app.authorStorage } : {});
      const page = await openView(app, context, view, { signedIn });
      // Act
      await addUserStyles(page, TEXT_SPACING_CSS);
      // Assert
      expect(await page.evaluate(() => getComputedStyle(document.body).letterSpacing)).not.toBe('normal');
      expect(await clippedText(page.mainFrame())).toEqual([]);
      await context.close();
    });
  });
});
