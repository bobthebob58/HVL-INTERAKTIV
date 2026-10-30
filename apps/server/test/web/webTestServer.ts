/**
 * webTestServer — Express in front of the built web app for the browser tests of its pages: a signed-out API with the
 * real public studio routes, stand-in H5P frames, resolved Canvas launches for fixed test ltiks, a page opener that
 * records every problem, a reader of a title the page may set late, and the lifecycle that serves the built web app
 * for a test block.
 *
 * Why: the page tests (./webPages.browser.int.test.ts) and the chrome tests (./webChrome.browser.int.test.ts) need the
 *      same server and the same strict checks (no console error, page error or CSP violation); one helper keeps them
 *      the same. ./webApp.browser.int.test.ts shares only the lifecycle (`serveBuiltWebApp`) and keeps its own bare
 *      Express app, without the signed-out API or the stand-in frames. The launches stand in for
 *      apps/server/src/lti/play/appLaunchRoutes.ts, which resolves a real ltik.
 * Spec: DATA-011, LTI-003, LTI-006, DATA-006
 * Invariants:
 *   - Only `LAUNCHES`' ltiks get a launch; any other `/app/play` request reaches the web app without one.
 *   - The public studio routes (`/api/studio…`, D-089) answer from the real content with the fixture guide and the
 *     fixture pattern `fixture-check` (../support/guideFixture.ts), every pattern available; the tests assert only
 *     fixture texts, never ALU's.
 *   - Expected 401 answers of the signed-out API and a page's own expected status are not reported as problems.
 *   - `serveBuiltWebApp` starts and stops the server in the caller's describe block; an unbuilt web app skips the
 *     tests locally and is an error in CI.
 *   - `settledTitle` waits a bounded time for the expected title to stay a second, then returns the real title, so the
 *     caller's comparison stays strict and a title that only flashed fails it.
 * Collaborators: ../../src/web/webRoutes.ts, ../../src/web/appLaunch.ts, ../../src/web/nextWebApp.ts,
 *   ../../src/learningDesign/http/studioContentRoutes.ts, ../support/browser.ts, ../support/loopbackServers.ts,
 *   ../support/guideFixture.ts.
 * Tests: used by ./webPages.browser.int.test.ts, ./webChrome.browser.int.test.ts and ./webApp.browser.int.test.ts.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express, { type Express } from 'express';
import { errors, type Browser, type BrowserContextOptions, type Page } from 'playwright-core';
import { afterAll, beforeAll } from 'vitest';
import { h5pErrorHandler } from '../../src/http/h5pErrorHandler.js';
import { portalNotFound } from '../../src/http/pages/portalHomeRoutes.js';
import { findPattern } from '../../src/learningDesign/content/patternAccessors.js';
import { studioContentRoutes } from '../../src/learningDesign/http/studioContentRoutes.js';
import type { StudioRouteDeps } from '../../src/learningDesign/http/studioRouteDeps.js';
import { createLogger } from '../../src/logging/logger.js';
import { baseSecurityHeaders } from '../../src/http/securityHeaders.js';
import { setAppLaunch, type AppLaunch } from '../../src/web/appLaunch.js';
import { loadWebApp, WEB_APP_DIR, type WebApp } from '../../src/web/nextWebApp.js';
import { webRoutes } from '../../src/web/webRoutes.js';
import { studioContentWithFixtures } from '../support/guideFixture.js';
import { closeLoopbackServers, listenOnLoopback } from '../support/loopbackServers.js';

/** Whether `npm run build` has built apps/web; the tests skip otherwise (and CI fails). */
export const WEB_APP_BUILT = existsSync(join(WEB_APP_DIR, '.next', 'BUILD_ID'));
if (!WEB_APP_BUILT && process.env.CI === 'true')
  throw new Error('CI must run `npm run build` before the web app tests');

/** The activity every test launch opens. */
export const ACTIVITY = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';
/** The ltik of a Nynorsk author launch. */
export const LTIK = 'test-ltik.value';
/** The ltik of an English learner launch of a Nynorsk activity. */
export const LTIK_EN = 'test-ltik.english';

/** The pattern page the browser tests open: the fixture pattern, whose texts the tests own. */
export const FIXTURE_PATTERN_PATH = '/laeringsdesign/monster/fixture-check';

/** The public studio routes on the real content with the fixtures, every pattern available (no H5P engine here). */
function publicStudioRoutes(): express.Router {
  const content = studioContentWithFixtures({ pattern: true });
  const patternCreator = {
    availability: async (id: string) =>
      findPattern(content.patterns, id) ? { available: true, contentTypes: [] } : undefined,
  };
  return studioContentRoutes({ studio: { content, patternCreator } } as unknown as StudioRouteDeps);
}

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
  app.use('/api', publicStudioRoutes(), h5pErrorHandler(createLogger({ level: 'silent' })));
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
 * Loads the built web app and serves it on a free loopback port for the enclosing `describe` block.
 * @param build - The Express app around the web app; `webTestServer` by default.
 * @returns The server's address (`http://127.0.0.1:<port>`), set once `beforeAll` has run.
 */
export function serveBuiltWebApp(build: (web: WebApp) => Express = webTestServer): () => string {
  let web: WebApp | undefined;
  let base = '';
  beforeAll(async () => {
    web = await loadWebApp('prod');
    base = await listenOnLoopback(build(web));
  }, 60_000);
  afterAll(async () => {
    await closeLoopbackServers();
    await web?.close();
  });
  return () => base;
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
    // When the document title last changed, for `settledTitle`.
    let title = document.title;
    new MutationObserver(() => {
      if (document.title === title) return;
      title = document.title;
      (window as unknown as { hvliTitleChangedAt?: number }).hvliTitleChangedAt = performance.now();
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  const response = await page.goto(url);
  // WHY: `window.next` is set by Next.js's client bootstrap, so it proves the nonced scripts ran and hydrated.
  await page.waitForFunction(() => 'next' in window, undefined, { timeout: 10_000 });
  await page.waitForLoadState('networkidle');
  return { page, problems, requests, status: response?.status() };
}

/**
 * The page's document title once it has been the expected one for a second, or as it is when the wait runs out.
 * @param page - A page `openWebPage` opened (its init script records when the title last changed).
 * @param expected - The title the test expects; it is only waited for, never returned in place of the real title.
 * @param timeout - How long to wait, in milliseconds.
 * @returns The real document title, for the caller's strict comparison.
 */
export async function settledTitle(page: Page, expected: string, timeout = 10_000): Promise<string> {
  // WHY: a view that loads its data in the browser names the page in an effect once the answer is there (the pattern
  // page, apps/web PatternDetailView.tsx). Under CPU load the network goes idle while Next.js still hydrates, before
  // that effect sends its request, so `openWebPage` can return with the server's title still in place. The title must
  // also stay: when React commits the metadata `<title>` after that effect, it writes the server's title back (seen
  // up to 342 ms later), so a title that only flashed must fail. A server-rendered title has been stable since parsing,
  // so it costs at most the rest of that second.
  await page
    .waitForFunction(
      ({ title, quiet }) =>
        document.title === title &&
        performance.now() -
          ((window as unknown as { hvliTitleChangedAt?: number }).hvliTitleChangedAt ?? 0) >=
          quiet,
      { title: expected, quiet: 1_000 },
      { timeout, polling: 50 },
    )
    .catch((error: unknown) => {
      if (!(error instanceof errors.TimeoutError)) throw error;
    });
  return page.title();
}
