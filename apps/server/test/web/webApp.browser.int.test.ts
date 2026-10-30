/**
 * Browser tests for the built web app (apps/web) served inside Express: Next.js runs under the nonce policy with
 * no blocked script, no console or hydration error, only first-party requests, Express's locale decision and its
 * own translated 404 page. The bare app answers only `/api/me`, which the portal header's main menu asks (D-089), as
 * for a signed-out browser.
 *
 * Spec: DATA-011, H5P-009, UD-010, PROD-012
 */
import express from 'express';
import { describe, expect, it } from 'vitest';
import { portalNotFound } from '../../src/http/pages/portalHomeRoutes.js';
import { baseSecurityHeaders } from '../../src/http/securityHeaders.js';
import { webRoutes } from '../../src/web/webRoutes.js';
import { describeWithBrowser } from '../support/browser.js';
import { serveBuiltWebApp, WEB_APP_BUILT } from './webTestServer.js';

if (!WEB_APP_BUILT) console.warn('Web app tests skipped: apps/web is not built (npm run build).');

const SIGNED_OUT = {
  success: false,
  errorCode: 'hvl:unauthenticated',
  httpStatusCode: 401,
  message: 'Logg inn.',
};

(WEB_APP_BUILT ? describe : describe.skip)('[DATA-011] the built web app inside Express', () => {
  const base = serveBuiltWebApp((web) =>
    express()
      .use(baseSecurityHeaders({ https: false }))
      .get('/api/me', (_req, res) => void res.status(401).json(SIGNED_OUT))
      .use(webRoutes(web))
      .use(portalNotFound()),
  );

  describeWithBrowser('[DATA-011] web pages in Chromium', (browser) => {
    /** Opens a page and records every problem a strict policy or React could report. */
    const open = async (path: string, headers: Record<string, string> = {}) => {
      const page = await browser().newPage({ extraHTTPHeaders: headers });
      const problems: string[] = [];
      const requests: string[] = [];
      page.on('console', (m) => {
        if (m.type() !== 'error') return;
        // WHY: Chromium logs the signed-out answer to the header's own `/api/me` request, which is expected.
        if (/status of 401/.test(m.text()) && m.location().url === `${base()}/api/me`) return;
        problems.push(`console: ${m.text()}`);
      });
      page.on('pageerror', (e) => problems.push(`page: ${e.message}`));
      page.on('request', (r) => requests.push(r.url()));
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) => {
          console.error(`csp: ${e.violatedDirective} ${e.blockedURI}`);
        });
      });
      const response = await page.goto(`${base()}${path}`);
      // WHY: `window.next` is set by Next.js's client bootstrap, so it proves the nonced scripts ran and hydrated.
      await page.waitForFunction(() => 'next' in window, undefined, { timeout: 10_000 });
      await page.waitForLoadState('networkidle');
      return { page, problems, requests, response };
    };

    it('[H5P-009] every script carries the response nonce; the page hydrates with no violation or error', async () => {
      // Act
      const { page, problems, response } = await open('/hjelp');
      // Assert
      const csp = (await response?.headerValue('content-security-policy')) ?? '';
      const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
      expect(nonce).toBeDefined();
      const html = (await response?.text()) ?? '';
      const scripts = html.match(/<script\b[^>]*>/g) ?? [];
      expect(scripts.length).toBeGreaterThan(0);
      for (const tag of scripts) expect(tag).toContain(`nonce="${nonce}"`);
      expect(problems).toEqual([]);
      expect(await page.textContent('h1')).toBe('Hjelp');
      await page.close();
    });

    it('[UD-010] the page language is Express’s decision, not the client’s header', async () => {
      const { page, problems } = await open('/hjelp', { 'x-hvli-locale': 'en' });
      expect(await page.getAttribute('html', 'lang')).toBe('nn');
      expect(problems).toEqual([]);
      await page.close();
    });

    it('[DATA-011] every request the page makes is first-party', async () => {
      const { page, requests } = await open('/hjelp');
      expect(requests.length).toBeGreaterThan(1);
      expect(requests.filter((url) => !url.startsWith(`${base()}/`))).toEqual([]);
      await page.close();
    });

    it('[PROD-012] an unknown path gets the web app’s translated 404 page', async () => {
      // Act
      const page = await browser().newPage();
      const response = await page.goto(`${base()}/finst-ikkje`);
      // Assert
      expect(response?.status()).toBe(404);
      expect(await page.textContent('h1')).toBe('Fann ikkje sida');
      await page.close();
    });
  });
});
