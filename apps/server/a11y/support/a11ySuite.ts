/**
 * a11ySuite — the describe block every accessibility suite runs in: services, the real H5P packages, the built web
 * app and Chromium must all be there; then one server (../../test/support/realWebApp.ts) and one browser are shared
 * by the block's tests.
 *
 * Why: UD-030's checks mean nothing on stand-ins, so the suite needs the real content types (D-078) and the built
 *      Next.js app (D-068). Locally a missing prerequisite skips the suite with the command that provides it; in CI
 *      (`CI=true`) it is an error, never a silent skip, as for the other browser tests.
 * Spec: UD-030, NFR-004
 * Invariants:
 *   - Chromium starts once per block and closes after it; the server closes before the browser.
 *   - The prerequisites are checked when the file loads, so a skipped suite says why.
 * Collaborators: ../../test/support/realWebApp.ts, ../../test/support/services.ts,
 *   ../../test/support/realPackages.ts, ../../test/support/browser.ts.
 * Tests: apps/server/a11y/axeWebRoutes.a11y.test.ts and every other suite in apps/server/a11y/.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright-core';
import { afterAll, beforeAll, describe } from 'vitest';
import { WEB_APP_DIR } from '../../src/web/nextWebApp.js';
import { hasRealPackages } from '../../test/support/realPackages.js';
import { openRealWebApp, type RealWebApp } from '../../test/support/realWebApp.js';
import { describeWithServices } from '../../test/support/services.js';

/** What a suite's tests use. */
export interface A11yEnv {
  readonly app: RealWebApp;
  readonly browser: Browser;
}

/** Why the suite cannot run here, or undefined when everything is in place. */
async function missingPrerequisite(): Promise<string | undefined> {
  // WHY: services.ts already fails in CI without them; outside CI it hands out `describe.skip`.
  if (describeWithServices !== describe) {
    return 'the services are not configured (copy apps/server/.env.example to apps/server/.env, D-023)';
  }
  if (!hasRealPackages()) return 'the real H5P packages are missing (run npm run h5p:fetch-libraries)';
  if (!existsSync(join(WEB_APP_DIR, '.next', 'BUILD_ID')))
    return 'the web app is not built (run npm run build)';
  try {
    await (await chromium.launch()).close();
  } catch (error) {
    return `Chromium did not start (${error instanceof Error ? error.message.split('\n')[0] : String(error)})`;
  }
  return undefined;
}

const missing = await missingPrerequisite();
if (missing && process.env.CI === 'true') throw new Error(`CI must run the accessibility suite: ${missing}`);

/**
 * A describe block with the running server and browser, or a skipped block that says what is missing (outside CI).
 * @param name - The block's title; it starts with a requirement ID.
 * @param body - Defines the tests; `env()` returns the server and browser inside a test.
 */
export function describeA11y(name: string, body: (env: () => A11yEnv) => void): void {
  if (missing) {
    describe.skip(`${name} (skipped: ${missing})`, () => body(() => ({}) as A11yEnv));
    return;
  }
  describe(name, () => {
    let browser: Browser | undefined;
    let app: RealWebApp | undefined;
    beforeAll(async () => {
      browser = await chromium.launch();
      app = await openRealWebApp(browser);
    }, 240_000);
    afterAll(async () => {
      await app?.close();
      await browser?.close();
    });
    body(() => {
      if (!app || !browser) throw new Error('the accessibility server is not running');
      return { app, browser };
    });
  });
}
