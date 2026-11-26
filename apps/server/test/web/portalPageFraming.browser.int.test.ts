/**
 * Browser tests of who may frame a portal page (D-125), with the built web app inside Express: a page of our own
 * origin under the player's policy cannot frame a portal page, because its `frame-src` names no origin of ours; and
 * a page of our own origin that may frame our origin (the editor's policy) is still refused by the portal page's
 * own `frame-ancestors 'none'`. The portal page itself opens as before.
 *
 * Spec: DATA-011, LTI-003
 */
import express from 'express';
import type { Page } from 'playwright-core';
import { describe, expect, it } from 'vitest';
import { h5pPageCsp } from '../../src/http/h5pPageCsp.js';
import { portalNotFound } from '../../src/http/pages/portalHomeRoutes.js';
import { baseSecurityHeaders } from '../../src/http/securityHeaders.js';
import { webRoutes } from '../../src/web/webRoutes.js';
import { describeWithBrowser } from '../support/browser.js';
import { serveBuiltWebApp, WEB_APP_BUILT } from './webTestServer.js';

const SETTINGS = { externalMediaOrigins: [] };
/** A page of our own origin with an H5P page's policy, standing for the player or the editor document. */
const h5pLikePage = (player: boolean) => (_req: express.Request, res: express.Response) => {
  res.set('Content-Security-Policy', h5pPageCsp(SETTINGS, ["'self'"], { playerFiles: player }));
  res.type('html').send('<!doctype html><title>H5P</title><main>content</main>');
};

/** Puts a frame of `/hjelp` into the page and says what became of it. */
async function frameHelpPage(page: Page): Promise<{ violations: string[]; shown: boolean }> {
  await page.evaluate(() => {
    (window as { hvlViolations?: string[] }).hvlViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      (window as { hvlViolations?: string[] }).hvlViolations?.push(event.violatedDirective);
    });
    const frame = document.createElement('iframe');
    frame.src = '/hjelp';
    document.body.append(frame);
  });
  await page.waitForTimeout(1_500);
  const violations = await page.evaluate(() => (window as { hvlViolations?: string[] }).hvlViolations ?? []);
  const child = page.frames().find((frame) => frame !== page.mainFrame());
  // WHY: a refused frame holds the browser's own error page, which our page cannot read and which has no heading.
  const shown = child
    ? await child
        .locator('h1')
        .count()
        .then(
          (n) => n > 0,
          () => false,
        )
    : false;
  return { violations, shown };
}

(WEB_APP_BUILT ? describe : describe.skip)('[DATA-011] who may frame a portal page', () => {
  const base = serveBuiltWebApp((web) =>
    express()
      .use(baseSecurityHeaders({ https: false }))
      .get(
        '/api/me',
        (_req, res) => void res.status(401).json({ success: false, errorCode: 'hvl:unauthenticated' }),
      )
      .get('/player-like', h5pLikePage(true))
      .get('/editor-like', h5pLikePage(false))
      .use(webRoutes(web))
      .use(portalNotFound()),
  );

  describeWithBrowser('[DATA-011] frames in Chromium', (browser) => {
    it('[DATA-011] a page under the player’s policy cannot frame a portal page: its own policy refuses the frame', async () => {
      // Arrange
      const page = await browser().newPage();
      await page.goto(`${base()}/player-like`);
      // Act
      const framed = await frameHelpPage(page);
      // Assert
      expect(framed).toEqual({ violations: ['frame-src'], shown: false });
      await page.close();
    });

    it('[DATA-011] a page of ours that may frame our origin is refused by the portal page itself', async () => {
      // Arrange
      const page = await browser().newPage();
      await page.goto(`${base()}/editor-like`);
      // Act
      const framed = await frameHelpPage(page);
      // Assert: no violation of the framing page's policy; the portal page's `frame-ancestors 'none'` kept it out
      expect(framed).toEqual({ violations: [], shown: false });
      await page.close();
    });

    it('[DATA-011] the portal page itself opens as before', async () => {
      // Act
      const page = await browser().newPage();
      const response = await page.goto(`${base()}/hjelp`);
      // Assert
      expect(response?.status()).toBe(200);
      expect(await response?.headerValue('x-frame-options')).toBe('DENY');
      expect(await page.textContent('h1')).toBe('Hjelp');
      await page.close();
    });
  });
});
