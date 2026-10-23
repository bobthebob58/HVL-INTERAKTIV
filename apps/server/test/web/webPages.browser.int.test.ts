/**
 * Browser tests for every page of the built web app served inside Express: no console error, page error or CSP
 * violation; only first-party requests; the skip link first and a `main#main` on every page; no horizontal scrolling
 * at 320 px; and each route's signed-out, no-launch or launch state. The API answers as for a signed-out browser.
 *
 * Spec: DATA-011, UD-006, UD-008, UD-013, DATA-006, LTI-003, LTI-006
 */
import { existsSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import express from 'express';
import type { Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { portalNotFound } from '../../src/http/pages/portalHomeRoutes.js';
import { baseSecurityHeaders } from '../../src/http/securityHeaders.js';
import { setAppLaunch } from '../../src/web/appLaunch.js';
import { loadWebApp, WEB_APP_DIR, type WebApp } from '../../src/web/nextWebApp.js';
import { webRoutes } from '../../src/web/webRoutes.js';
import { describeWithBrowser } from '../support/browser.js';

const BUILT = existsSync(join(WEB_APP_DIR, '.next', 'BUILD_ID'));
if (!BUILT && process.env.CI === 'true')
  throw new Error('CI must run `npm run build` before the web app tests');

const ACTIVITY = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';
const LTIK = 'test-ltik.value';
const SIGNED_OUT = {
  success: false,
  errorCode: 'hvl:unauthenticated',
  httpStatusCode: 401,
  message: 'Logg inn.',
};
/** Requests a signed-out browser makes on purpose; Chromium logs their 401 as a console error. */
const EXPECTED_401 = /\/(auth\/session|api\/[\w/-]+)$/;

/** Express with the web app, a signed-out API, stand-in H5P frames and a resolved launch for `/app/play?ltik=…`. */
function testServer(web: WebApp) {
  const app = express();
  app.use(baseSecurityHeaders({ https: false }));
  app.get(['/auth/session', '/api/{*rest}'], (_req, res) => void res.status(401).json(SIGNED_OUT));
  app.get(
    ['/lti/play', '/lti/edit'],
    (_req, res) => void res.type('html').send('<!doctype html><title>H5P</title>'),
  );
  app.get('/app/play', (req, res, next) => {
    // WHY: the LTI router resolves a real ltik here (apps/server/src/lti/play/appLaunchRoutes.ts); this stands in.
    if (req.query.ltik === LTIK)
      setAppLaunch(res, { contentId: ACTIVITY, title: 'Celler og vev', mayEdit: true, locale: 'nn' });
    next();
  });
  app.use(webRoutes(web));
  app.use(portalNotFound());
  return app;
}

(BUILT ? describe : describe.skip)('[DATA-011] every page of the built web app', () => {
  let web: WebApp;
  let server: Server;
  let base = '';
  beforeAll(async () => {
    web = await loadWebApp('prod');
    server = testServer(web).listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 60_000);
  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await web?.close();
  });

  describeWithBrowser('[DATA-011] pages in Chromium', (browser) => {
    /** Opens a page at 320 px and records every problem a strict policy or React could report. */
    const open = async (path: string, documentStatus = 200) => {
      const page = await browser().newPage({ viewport: { width: 320, height: 640 } });
      const problems: string[] = [];
      const requests: string[] = [];
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        if (/status of 401/.test(m.text()) && EXPECTED_401.test(m.location().url)) return;
        // WHY: Chromium also logs the page's own error status, which the 404 test expects.
        if (m.text().includes(`status of ${documentStatus}`) && m.location().url === `${base}${path}`) return;
        problems.push(`console: ${m.text()} (${m.location().url})`);
      });
      page.on('pageerror', (e) => problems.push(`page: ${e.message}`));
      page.on('request', (r) => requests.push(r.url()));
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) => {
          console.error(`csp: ${e.violatedDirective} ${e.blockedURI}`);
        });
      });
      const response = await page.goto(`${base}${path}`);
      await page.waitForFunction(() => 'next' in window, undefined, { timeout: 10_000 });
      await page.waitForLoadState('networkidle');
      return { page, problems, requests, status: response?.status() };
    };

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
      expect(requests.filter((url) => !url.startsWith(`${base}/`))).toEqual([]);
      expect(await page.$$eval('iframe', (frames) => frames.filter((frame) => !frame.title).length)).toBe(0);
    };

    it.each([
      ['/', /Logg inn med Feide/],
      ['/hjelp', /Lage ein aktivitet/],
      ['/personvern', /minst 5 studentar/],
      [`/aktivitet/${ACTIVITY}`, /Du må logge inn for å sjå denne sida/],
      ['/aktivitet/ny', /Du må logge inn for å sjå denne sida/],
      ['/app/play', /Opne aktiviteten frå Canvas/],
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

    it('[UD-013] an unknown path gets the 404 page in the portal chrome', async () => {
      // Act
      const { page, problems, requests, status } = await open('/finst-ikkje', 404);
      // Assert
      expect(status).toBe(404);
      expect(await page.textContent('h1')).toBe('Fann ikkje sida');
      await expectSoundPage(page, requests);
      expect(problems).toEqual([]);
      await page.close();
    });
  });
});
