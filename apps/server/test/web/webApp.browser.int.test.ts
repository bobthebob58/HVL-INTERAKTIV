/**
 * Browser tests for the built web app (apps/web) served inside Express: Next.js runs under the nonce policy with
 * no blocked script, no console or hydration error, only first-party requests, Express's locale decision and its
 * own translated 404 page.
 *
 * Spec: DATA-011, H5P-009, UD-010, PROD-012
 */
import { existsSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { portalNotFound } from '../../src/http/pages/portalHomeRoutes.js';
import { baseSecurityHeaders } from '../../src/http/securityHeaders.js';
import { loadWebApp, WEB_APP_DIR, type WebApp } from '../../src/web/nextWebApp.js';
import { webRoutes } from '../../src/web/webRoutes.js';
import { describeWithBrowser } from '../support/browser.js';

const BUILT = existsSync(join(WEB_APP_DIR, '.next', 'BUILD_ID'));
if (!BUILT && process.env.CI === 'true')
  throw new Error('CI must run `npm run build` before the web app tests');
if (!BUILT) console.warn('Web app tests skipped: apps/web is not built (npm run build).');

(BUILT ? describe : describe.skip)('[DATA-011] the built web app inside Express', () => {
  let web: WebApp;
  let server: Server;
  let base = '';
  beforeAll(async () => {
    web = await loadWebApp('prod');
    const app = express();
    app.use(baseSecurityHeaders({ https: false }));
    app.use(webRoutes(web));
    app.use(portalNotFound());
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 60_000);
  afterAll(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    await web?.close();
  });

  describeWithBrowser('[DATA-011] web pages in Chromium', (browser) => {
    /** Opens a page and records every problem a strict policy or React could report. */
    const open = async (path: string, headers: Record<string, string> = {}) => {
      const page = await browser().newPage({ extraHTTPHeaders: headers });
      const problems: string[] = [];
      const requests: string[] = [];
      page.on('console', (m) => void (m.type() === 'error' && problems.push(`console: ${m.text()}`)));
      page.on('pageerror', (e) => problems.push(`page: ${e.message}`));
      page.on('request', (r) => requests.push(r.url()));
      await page.addInitScript(() => {
        document.addEventListener('securitypolicyviolation', (e) => {
          console.error(`csp: ${e.violatedDirective} ${e.blockedURI}`);
        });
      });
      const response = await page.goto(`${base}${path}`);
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
      expect(requests.filter((url) => !url.startsWith(`${base}/`))).toEqual([]);
      await page.close();
    });

    it('[PROD-012] an unknown path gets the web app’s translated 404 page', async () => {
      // Act
      const page = await browser().newPage();
      const response = await page.goto(`${base}/finst-ikkje`);
      // Assert
      expect(response?.status()).toBe(404);
      expect(await page.textContent('h1')).toBe('Fann ikkje sida');
      await page.close();
    });
  });
});
