/**
 * webTestServer — Express in front of the built web app for the browser tests of its pages: a signed-out API, stand-in
 * H5P frames, resolved Canvas launches for fixed test ltiks, and a page opener that records every problem.
 *
 * Why: the page tests (./webPages.browser.int.test.ts) and the chrome tests (./webChrome.browser.int.test.ts) need the
 *      same server and the same strict checks (no console error, page error or CSP violation); one helper keeps them
 *      the same. The launches stand in for apps/server/src/lti/play/appLaunchRoutes.ts, which resolves a real ltik.
 * Spec: DATA-011, LTI-003, LTI-006, DATA-006
 * Invariants:
 *   - Only `LAUNCHES`' ltiks get a launch; any other `/app/play` request reaches the web app without one.
 *   - Expected 401 answers of the signed-out API and a page's own expected status are not reported as problems.
 * Collaborators: ../../src/web/webRoutes.ts, ../../src/web/appLaunch.ts, ../../src/web/nextWebApp.ts,
 *   ../support/browser.ts.
 * Tests: used by ./webPages.browser.int.test.ts and ./webChrome.browser.int.test.ts.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express, { type Express } from 'express';
import type { Browser, BrowserContextOptions } from 'playwright-core';
import { portalNotFound } from '../../src/http/pages/portalHomeRoutes.js';
import { baseSecurityHeaders } from '../../src/http/securityHeaders.js';
import { setAppLaunch, type AppLaunch } from '../../src/web/appLaunch.js';
import { WEB_APP_DIR, type WebApp } from '../../src/web/nextWebApp.js';
import { webRoutes } from '../../src/web/webRoutes.js';

/** Whether `npm run build` has built apps/web; the tests skip otherwise (and CI fails). */
export const WEB_APP_BUILT = existsSync(join(WEB_APP_DIR, '.next', 'BUILD_ID'));

/** The activity every test launch opens. */
export const ACTIVITY = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';
/** The ltik of a Nynorsk author launch. */
export const LTIK = 'test-ltik.value';
/** The ltik of an English learner launch of a Nynorsk activity. */
export const LTIK_EN = 'test-ltik.english';

/** The launches Express resolves for the test ltiks. */
export const LAUNCHES: Readonly<Record<string, AppLaunch>> = {
  [LTIK]: { contentId: ACTIVITY, title: 'Celler og vev', mayEdit: true, locale: 'nn' },
  [LTIK_EN]: { contentId: ACTIVITY, title: 'Celler og vev', mayEdit: false, locale: 'en', language: 'nn' },
};

const SIGNED_OUT = {
  success: false,
  errorCode: 'hvl:unauthenticated',
  httpStatusCode: 401,
  message: 'Logg inn.',
};
/** Requests a signed-out browser makes on purpose; Chromium logs their 401 as a console error. */
const EXPECTED_401 = /\/(auth\/session|api\/[\w/-]+)$/;

/**
 * Express with the web app, a signed-out API, stand-in H5P frames and the test launches.
 * @param web - The loaded web app.
 * @returns The app to listen with.
 */
export function webTestServer(web: WebApp): Express {
  const app = express();
  app.use(baseSecurityHeaders({ https: false }));
  app.get(['/auth/session', '/api/{*rest}'], (_req, res) => void res.status(401).json(SIGNED_OUT));
  app.get(
    ['/lti/play', '/lti/edit'],
    (_req, res) => void res.type('html').send('<!doctype html><title>H5P</title>'),
  );
  app.get('/app/play', (req, res, next) => {
    const launch = typeof req.query.ltik === 'string' ? LAUNCHES[req.query.ltik] : undefined;
    if (launch) setAppLaunch(res, launch);
    next();
  });
  app.use(webRoutes(web));
  app.use(portalNotFound());
  return app;
}

/**
 * Opens a page and records every problem a strict policy or React could report, and every request.
 * @param browser - The running Chromium.
 * @param url - The page's full address.
 * @param options - The browser context (viewport, forced colours) and the page's expected document status.
 * @returns The page, its problems and requests, and the document status.
 */
export async function openWebPage(
  browser: Browser,
  url: string,
  options: { readonly context?: BrowserContextOptions; readonly documentStatus?: number } = {},
) {
  const page = await browser.newPage(options.context);
  const problems: string[] = [];
  const requests: string[] = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (/status of 401/.test(m.text()) && EXPECTED_401.test(m.location().url)) return;
    // WHY: Chromium also logs the page's own error status, which the 404 test expects.
    if (m.text().includes(`status of ${options.documentStatus ?? 200}`) && m.location().url === url) return;
    problems.push(`console: ${m.text()} (${m.location().url})`);
  });
  page.on('pageerror', (e) => problems.push(`page: ${e.message}`));
  page.on('request', (r) => requests.push(r.url()));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`csp: ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  const response = await page.goto(url);
  // WHY: `window.next` is set by Next.js's client bootstrap, so it proves the nonced scripts ran and hydrated.
  await page.waitForFunction(() => 'next' in window, undefined, { timeout: 10_000 });
  await page.waitForLoadState('networkidle');
  return { page, problems, requests, status: response?.status() };
}
