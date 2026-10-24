/**
 * Browser tests of the cues the HVL theme raises to 3 : 1 in the real content types (D-078), as drawn: DragText's
 * empty drop zone has an ink-muted border on the surface-alt behind it, and an answered CoursePresentation task dot
 * is filled with its own ring colour (ink on a slide already reached, band on one not yet reached), and in forced
 * colours is a disc drawn by its ring. The colour pairs are checked in packages/design-tokens/test/contrast.test.ts.
 *
 * Spec: UD-001, UD-011, UD-012
 */
import type { Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithBrowser } from '../support/browser.js';
import { describeWithRealPackages } from '../support/realPackages.js';
import {
  checkAnswers,
  openRealPlayer,
  openRealTypesServer,
  type RealTypesServer,
} from '../support/realTypesPlayer.js';
import { describeWithServices } from '../support/services.js';

/** The computed colour of a token in the page, as `rgb(…)`. */
const token = (page: Page, name: string) =>
  page.evaluate((property) => {
    const probe = document.body.appendChild(document.createElement('i'));
    probe.style.color = `var(${property})`;
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, name);

/** The task dot: fill, ring width, ring colour, inner width, outer size and whether its slide was reached. */
const dot = (page: Page) =>
  page.locator('.h5p-progressbar-part-has-task').evaluate((el) => {
    const style = getComputedStyle(el);
    const shown = el.closest('.h5p-progressbar-part-show') !== null;
    const size = el.getBoundingClientRect().width;
    return [
      style.backgroundColor,
      style.borderTopWidth,
      style.borderTopColor,
      style.width,
      size,
      shown,
    ] as const;
  });

type Presentation = { H5P: { instances: { jumpToSlide(slide: number): void }[] } };
const jumpTo = (page: Page, slide: number) =>
  page.evaluate((n) => (window as unknown as Presentation).H5P.instances[0]?.jumpToSlide(n), slide);

describeWithServices('the cues of where an answer goes and which tasks are answered', () => {
  describeWithRealPackages('[UD-011] the real content types with the HVL theme', () => {
    let server: RealTypesServer;
    beforeAll(async () => {
      server = await openRealTypesServer();
    }, 180_000);
    afterAll(() => server?.close());

    describeWithBrowser('[UD-011] in Chromium', (browser) => {
      it('[UD-011] DragText: an empty drop zone is framed in ink-muted on the surface-alt behind it', async () => {
        // Arrange
        const page = await openRealPlayer(browser(), server, 'H5P.DragText');
        // Act: the zone's border and the first painted background behind it
        const drawn = await page
          .locator('.h5p-dropzone--inline [aria-dropeffect]')
          .first()
          .evaluate((el) => {
            let behind: Element | null = el.parentElement;
            while (behind && getComputedStyle(behind).backgroundColor === 'rgba(0, 0, 0, 0)')
              behind = behind.parentElement;
            return [getComputedStyle(el).borderTopColor, behind && getComputedStyle(behind).backgroundColor];
          });
        // Assert
        expect(drawn).toEqual([await token(page, '--hvl-ink-muted'), await token(page, '--hvl-surface-alt')]);
        await page.close();
      }, 60_000);

      it('[UD-011][UD-012] CoursePresentation: an answered task dot is filled with its ring colour, also in forced colours', async () => {
        // Arrange: slide 2 holds a MultiChoice
        const page = await openRealPlayer(browser(), server, 'H5P.CoursePresentation');
        const [ink, band] = [await token(page, '--hvl-ink'), await token(page, '--hvl-band')];
        await jumpTo(page, 1);
        const open = (await dot(page))[4];
        // Act: answer it, look at the dot on its own slide, then from the first slide, then in forced colours
        await page.locator('.h5p-multichoice .h5p-answer:visible').first().click();
        await checkAnswers(page);
        await expect.poll(() => page.locator('.h5p-answered').count()).toBe(1);
        const reached = await dot(page);
        await jumpTo(page, 0);
        await expect.poll(async () => (await dot(page))[5]).toBe(false);
        const ahead = await dot(page);
        await page.emulateMedia({ forcedColors: 'active' });
        const [, ring, , inner, size] = await dot(page);
        // Assert: the fill is the ring colour, ink once reached and band ahead, at the open dot's size; in forced
        // colours no inner area is left and the ring is half the dot wide, so the disc is solid
        expect([reached[0], reached[2], reached[4]]).toEqual([ink, ink, open]);
        expect([ahead[0], ahead[2], ahead[4]]).toEqual([band, band, open]);
        expect([inner, Math.round(2 * parseFloat(ring)) === Math.round(size)]).toEqual(['0px', true]);
        expect(open - size).toBeLessThan(2);
        await page.close();
      }, 60_000);
    });
  });
});
