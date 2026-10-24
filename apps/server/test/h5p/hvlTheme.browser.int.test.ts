/**
 * Browser tests of HVL's H5P theme with the real content types (D-078): the theme is active in the document of every
 * type and in the editor's iframe, and a control focused from the keyboard shows the two-tone ring, also in forced
 * colours; transitions and H5P's jQuery animations stop with reduced motion. Answer prefixes:
 * ./hvlFeedback.browser.int.test.ts, ./hvlFeedbackContainers.browser.int.test.ts and
 * ./hvlFeedbackHotspot.browser.int.test.ts; drop zones and task dots: ./hvlThemeIndicators.browser.int.test.ts.
 *
 * Spec: UD-004, UD-009, UD-011, UD-012
 */
import type { Frame } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithBrowser } from '../support/browser.js';
import { describeWithRealPackages } from '../support/realPackages.js';
import { openRealPlayer, openRealTypesServer, type RealTypesServer } from '../support/realTypesPlayer.js';
import { describeWithServices } from '../support/services.js';

const THEME_SHEETS = [
  'tokens.css',
  'h5p-daylight.css',
  'hvl-h5p-theme.css',
  'hvl-h5p-feedback.css',
  'hvl-h5p-indicators.css',
  'hvl-feedback-prefixes.css',
];
const THEMED = {
  sheets: THEME_SHEETS,
  mainCta: '#004357',
  font: 'Arial',
  lineHeight: 1.55,
  prefixScript: true,
};

/** What the theme changed in one H5P document, read from the element that holds H5P there. */
const themeProbe = (frame: Frame, selector: string) =>
  frame.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return 'no H5P element';
    const style = getComputedStyle(element);
    const started = (window as unknown as { hvlFeedbackPrefixesStarted?: boolean })
      .hvlFeedbackPrefixesStarted;
    return {
      sheets: [...document.styleSheets].flatMap(
        (s) => /\/h5p\/theme\/([\w.-]+)\?/.exec(s.href ?? '')?.[1] ?? [],
      ),
      mainCta: style.getPropertyValue('--h5p-theme-main-cta-base').trim(),
      font: style.fontFamily.split(',')[0]?.trim(),
      lineHeight: Math.round((parseFloat(style.lineHeight) / parseFloat(style.fontSize)) * 100) / 100,
      prefixScript: Boolean(started),
    };
  }, selector);

describeWithServices('the HVL theme inside H5P', () => {
  describeWithRealPackages('[UD-011] the real content types with the HVL theme', () => {
    let server: RealTypesServer;
    beforeAll(async () => {
      server = await openRealTypesServer();
    }, 180_000);
    afterAll(() => server?.close());

    describeWithBrowser('[UD-011] in Chromium', (browser) => {
      it('[UD-011] every type renders with the theme active in each document that holds H5P content', async () => {
        const report: Record<string, unknown[]> = {};
        for (const library of server.ids.keys()) {
          // Arrange
          const page = await openRealPlayer(browser(), server, library);
          // Act: our player page renders the content itself; an iframe H5P Core writes gets the same core assets
          const documents = [];
          for (const frame of page.frames()) {
            if (await frame.locator('.h5p-content').count())
              documents.push(await themeProbe(frame, '.h5p-content'));
          }
          report[library] = documents;
          await page.close();
        }
        // Assert
        expect(report).toEqual(
          Object.fromEntries([...server.ids.keys()].map((library) => [library, [THEMED]])),
        );
      }, 300_000);

      it("[UD-011] the editor's iframe loads the theme", async () => {
        // Arrange
        const page = await browser().newPage();
        await page.setExtraHTTPHeaders({ [server.author.header[0]]: server.author.header[1] });
        await page.goto(`${server.base}/h5p/edit/${server.ids.get('H5P.MultiChoice')}`);
        // Act
        await page.frameLocator('iframe.h5p-editor-iframe').locator('.h5peditor-form').first().waitFor();
        const editorFrame = page.frames().find((f) => f.parentFrame() === page.mainFrame());
        // Assert
        expect(editorFrame && (await themeProbe(editorFrame, '.h5peditor'))).toMatchObject({
          sheets: THEME_SHEETS,
          mainCta: '#004357',
          font: 'Arial',
          prefixScript: true,
        });
        await page.close();
      }, 60_000);

      it('[UD-004][UD-012] a control focused from the keyboard shows the two-tone ring, widened in forced colours', async () => {
        // Arrange
        const page = await openRealPlayer(browser(), server, 'H5P.MultiChoice');
        const ring = () =>
          page.evaluate(() => {
            const s = getComputedStyle(document.activeElement ?? document.body);
            const outer = getComputedStyle(document.documentElement)
              .getPropertyValue('--hvl-focus-outer')
              .trim();
            return [s.outlineStyle, s.outlineWidth, s.outlineColor, s.outlineOffset, s.boxShadow, outer];
          });
        // Act
        await page.keyboard.press('Tab');
        const normal = await ring();
        await page.emulateMedia({ forcedColors: 'active' });
        const forced = await ring();
        // Assert
        expect(await page.evaluate(() => document.activeElement?.closest('.h5p-content') !== null)).toBe(
          true,
        );
        expect(normal).toEqual([
          'solid',
          '3px',
          'rgb(0, 67, 87)',
          '2px',
          'rgb(255, 255, 255) 0px 0px 0px 2px',
          '#004357',
        ]);
        expect(forced.slice(0, 2)).toEqual(['solid', '5px']);
        expect(forced[5]).toBe('Highlight');
        await page.close();
      }, 60_000);

      it('[UD-009] transitions stop when the reader asks for reduced motion', async () => {
        const page = await openRealPlayer(browser(), server, 'H5P.MultiChoice');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const button = page.locator('.h5p-question-check-answer');
        const duration = await button.evaluate((el) => getComputedStyle(el).transitionDuration);
        expect(parseFloat(duration)).toBeLessThan(0.001);
        await page.close();
      }, 60_000);

      it("[UD-009] H5P's jQuery motion stops too: a DragText word dropped outside a gap is back at once", async () => {
        // Arrange: without the preference DragText slides the word back for 400 ms (`$draggable.animate`)
        const page = await openRealPlayer(browser(), server, 'H5P.DragText');
        const fxOff = () =>
          page.evaluate(
            () => (window as unknown as { H5P: { jQuery: { fx: { off?: boolean } } } }).H5P.jQuery.fx.off,
          );
        await page.emulateMedia({ reducedMotion: 'reduce' });
        // WHY: a media query's change event arrives with the next frame, not with emulateMedia's promise.
        await expect.poll(fxOff).toBe(true);
        const word = page.locator('.h5p-drag-text .h5p-draggable').first();
        const box = await word.boundingBox();
        if (!box) throw new Error('the word is not on screen');
        // Act: drag it up and away from every gap, and let go
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + 120, box.y - 80, { steps: 6 });
        await page.mouse.up();
        const offset = await word.evaluate((el) => [el.style.left, el.style.top]);
        // Assert: home at once; and the switch follows the setting back
        expect(offset).toEqual(['0px', '0px']);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await expect.poll(fxOff).toBe(false);
        await page.close();
      }, 60_000);
    });
  });
});
