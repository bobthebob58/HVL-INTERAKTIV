/**
 * Browser tests for every page of the built web app served inside Express: no console error, page error or CSP
 * violation; only first-party requests; the skip link first and a `main#main` on every page; no horizontal scrolling
 * at 320 px; and each route's signed-out, no-launch or launch state, the S5 studio pages included (D-089). The API
 * answers as for a signed-out browser.
 *
 * Spec: DATA-011, UD-006, UD-008, UD-013, DATA-006, LTI-003, LTI-006
 */
import type { Page } from 'playwright-core';
import { describe, expect, it } from 'vitest';
import { describeWithBrowser } from '../support/browser.js';
import { ACTIVITY, LTIK, openWebPage, serveBuiltWebApp, WEB_APP_BUILT } from './webTestServer.js';

(WEB_APP_BUILT ? describe : describe.skip)('[DATA-011] every page of the built web app', () => {
  const base = serveBuiltWebApp();

  describeWithBrowser('[DATA-011] pages in Chromium', (browser) => {
    /** Opens a page at 320 px and records every problem a strict policy or React could report. */
    const open = (path: string, documentStatus = 200) =>
      openWebPage(browser(), `${base()}${path}`, {
        context: { viewport: { width: 320, height: 640 } },
        documentStatus,
      });

    /** The shared checks of every page: chrome, skip link, reflow, first-party requests, titled frames. */
    const expectSoundPage = async (page: Page, requests: string[]) => {
      expect(await page.locator('main#main').count()).toBe(1);
      expect(
        await page
          .getByRole('banner')
          .getByRole('link', { name: /^Hjelp/ })
          .count(),
      ).toBe(1);
      expect(
        await page
          .getByRole('contentinfo')
          .getByRole('link', { name: /^Personvern/ })
          .count(),
      ).toBe(1);
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.textContent)).toBe('Gå til hovudinnhaldet');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      expect(requests.filter((url) => !url.startsWith(`${base()}/`))).toEqual([]);
      expect(await page.$$eval('iframe', (frames) => frames.filter((frame) => !frame.title).length)).toBe(0);
    };

    it.each([
      ['/', /Logg inn med Feide/],
      ['/hjelp', /Lage ein aktivitet/],
      ['/personvern', /minst 5 studentar/],
      [`/aktivitet/${ACTIVITY}`, /Du må logge inn for å sjå denne sida/],
      ['/aktivitet/ny', /Du må logge inn for å sjå denne sida/],
      ['/app/play', /Opne aktiviteten frå Canvas/],
      ['/laeringsdesign', /Studentaktiv læring med «HVL læringsdesign»/],
      ['/laeringsdesign/monster/fa-video', /Mønster/],
      ['/laeringsdesign/planlegg', /Du må logge inn for å sjå denne sida/],
      ['/laeringsdesign/innhaldsbank', /Du må logge inn for å sjå denne sida/],
      ['/mappe', /Du må logge inn for å sjå denne sida/],
    ])('[UD-008] %s renders its state with no error, violation or sideways scrolling', async (path, text) => {
      // Act
      const { page, problems, requests, status } = await open(path);
      // Assert
      expect(status).toBe(200);
      await page.getByText(text).first().waitFor();
      await expectSoundPage(page, requests);
      expect(problems).toEqual([]);
      await page.close();
    });

    it('[LTI-003] the Canvas page takes the ltik out of the address bar and frames the player with it', async () => {
      // Act
      const { page, problems, requests } = await open(`/app/play?ltik=${encodeURIComponent(LTIK)}`);
      // Assert
      await page.getByRole('heading', { level: 1, name: 'Celler og vev' }).waitFor();
      expect(new URL(page.url()).search).toBe('');
      expect(await page.getByRole('tab').allTextContents()).toEqual(['Spel', 'Rediger']);
      expect(await page.getByTitle('Spel: Celler og vev').getAttribute('src')).toBe(
        `/lti/play?ltik=${encodeURIComponent(LTIK)}`,
      );
      const privacy = page.getByRole('link', { name: 'Personvern (opnar i ny fane)' });
      expect(await privacy.getAttribute('target')).toBe('_blank');
      await expectSoundPage(page, requests);
      expect(problems).toEqual([]);
      await page.close();
    });

    it.each(['/finst-ikkje', '/laeringsdesign/monster/IKKJE..GYLDIG'])(
      '[UD-013] %s gets the 404 page in the portal chrome',
      async (path) => {
        // Act
        const { page, problems, requests, status } = await open(path, 404);
        // Assert
        expect(status).toBe(404);
        expect(await page.textContent('h1')).toBe('Fann ikkje sida');
        await expectSoundPage(page, requests);
        expect(problems).toEqual([]);
        await page.close();
      },
    );

    it('[UD-013] the portal header has the main menu, which Canvas does not', async () => {
      // Act
      const portal = await open('/hjelp');
      const canvas = await open(`/app/play?ltik=${encodeURIComponent(LTIK)}`);
      // Assert
      const menu = portal.page.getByRole('banner').getByRole('navigation', { name: 'Hovudmeny' });
      expect(await menu.getByRole('link').allTextContents()).toEqual(['Læringsdesign']);
      expect(await canvas.page.getByRole('navigation', { name: 'Hovudmeny' }).count()).toBe(0);
      expect([...portal.problems, ...canvas.problems]).toEqual([]);
      await portal.page.close();
      await canvas.page.close();
    });
  });
});
