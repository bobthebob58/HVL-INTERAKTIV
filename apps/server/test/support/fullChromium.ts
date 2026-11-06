/**
 * fullChromium — a describe block with one shared full Chromium build (`channel: 'chromium'`, new headless mode),
 * not the headless shell that `chromium.launch()` starts by default.
 *
 * Why: D-065 found that the headless shell differs from the browser learners use (it ignored the cookie switches
 *      the LTI tests need), so tests that pin what the real player does run in the full build, which CI installs.
 *      As in ./browser.ts, a missing browser skips the block locally and fails it in CI (`CI=true`).
 * Spec: H5P-009, LTI-010
 * Invariants: the browser starts once per block and is closed in `afterAll`; nothing else is launched.
 * Collaborators: playwright-core 1.56.1 (`PLAYWRIGHT_BROWSERS_PATH` finds the build), ./browser.ts (same rule for
 *   the headless shell), ./thirdPartyCookies.ts (the full build with cookie switches).
 * Tests: used by apps/server/test/h5p/xapiQuestionTypes.browser.int.test.ts and
 *   apps/server/test/h5p/xapiContainerTypes.browser.int.test.ts.
 */
import { afterAll, beforeAll, describe } from 'vitest';
import { chromium, type Browser } from 'playwright-core';

/** Tries to start and stop the full build once; returns why it failed, or undefined when it works. */
async function launchFailure(): Promise<string | undefined> {
  try {
    await (await chromium.launch({ channel: 'chromium' })).close();
    return undefined;
  } catch (error) {
    return error instanceof Error ? (error.message.split('\n')[0] ?? error.name) : String(error);
  }
}

const failure = await launchFailure();
if (failure && process.env.CI === 'true') {
  throw new Error(`CI must run browser tests; full Chromium did not start: ${failure}`);
}
if (failure) {
  console.warn(
    `Full-Chromium tests skipped: the build did not start (${failure}). Check PLAYWRIGHT_BROWSERS_PATH.`,
  );
}

/**
 * A describe block with one shared full Chromium, or a skipped block when it cannot start (outside CI).
 * @param name - The describe title; it starts with a requirement ID.
 * @param body - Defines the tests; `browser()` returns the running browser inside a test.
 */
export function describeWithFullChromium(name: string, body: (browser: () => Browser) => void): void {
  (failure ? describe.skip : describe)(name, () => {
    let running: Browser | undefined;
    beforeAll(async () => {
      running = await chromium.launch({ channel: 'chromium' });
    });
    afterAll(async () => {
      await running?.close();
    });
    body(() => {
      if (!running) throw new Error('full Chromium is not running');
      return running;
    });
  });
}
