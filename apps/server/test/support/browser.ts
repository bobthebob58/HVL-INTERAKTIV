/**
 * browser — gives tests a headless Chromium (playwright-core 1.56.1) to see what a browser really renders.
 *
 * Why: SEC-001 and D-044 require benign SVGs to look identical before and after sanitising, which only a real
 *      renderer can show. Locally the tests are skipped when no browser can start; in CI (`CI=true`) a missing
 *      browser is an error, never a skip. The browser build is found through PLAYWRIGHT_BROWSERS_PATH.
 * Spec: SEC-001
 * Tests: used by apps/server/test/security/SvgSanitizer.render.test.ts.
 */
import { afterAll, beforeAll, describe } from 'vitest';
import { chromium, type Browser } from 'playwright-core';

/** Tries to start and stop Chromium once; returns why it failed, or undefined when it works. */
async function launchFailure(): Promise<string | undefined> {
  try {
    const probe = await chromium.launch();
    await probe.close();
    return undefined;
  } catch (error) {
    return error instanceof Error ? (error.message.split('\n')[0] ?? error.name) : String(error);
  }
}

const failure = await launchFailure();
if (failure && process.env.CI === 'true') {
  throw new Error(`CI must run browser tests; Chromium did not start: ${failure}`);
}
if (failure) {
  console.warn(`Browser tests skipped: Chromium did not start (${failure}). Check PLAYWRIGHT_BROWSERS_PATH.`);
}

/**
 * A describe block with one shared Chromium, or a skipped block when no browser can start (outside CI).
 * @param name - The describe title; it starts with a requirement ID.
 * @param body - Defines the tests; `browser()` returns the running browser inside a test.
 */
export function describeWithBrowser(name: string, body: (browser: () => Browser) => void): void {
  (failure ? describe.skip : describe)(name, () => {
    let running: Browser | undefined;
    beforeAll(async () => {
      running = await chromium.launch();
    });
    afterAll(async () => {
      await running?.close();
    });
    body(() => {
      if (!running) throw new Error('Chromium is not running');
      return running;
    });
  });
}
