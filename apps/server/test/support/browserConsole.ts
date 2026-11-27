/**
 * browserConsole — reads the pinned Chromium's console messages for the browser tests: which messages are errors of
 * the page, and which address the page policy refused.
 *
 * Why: tests that open a real page fail on any console error, and some count what the page policy refused.
 *      Chromium words these messages itself and changes them between versions: 141 said «Refused to frame '…'»,
 *      159 says «Framing '…' violates the following Content Security Policy directive». From 159 it also reports
 *      H5P Core's own request for the `unload` event as a policy violation on every player and editor page. One
 *      place reads the wording, so a browser update is one change (D-149).
 * Spec: H5P-001, DATA-011
 * Invariants:
 *   - Exactly one message is not an error of the page: Chromium's notice that it refused an `unload` listener.
 *     UPSTREAM: https://github.com/h5p/h5p-php-library/blob/1.28.0/js/h5p.js#L2925 registers `beforeunload unload`
 *     beside `pagehide`; Chromium no longer allows `unload` (https://developer.chrome.com/docs/web-platform/deprecating-unload).
 *     The other two listeners still save a learner's progress; apps/server/test/http/player.browser.int.test.ts
 *     pins the notice, so the day H5P or Chromium changes it the exception goes.
 *   - The wording is that of the pinned Chromium only (playwright-core 1.65.1); another wording is not recognised,
 *     so a test fails instead of passing on a message nobody read.
 * Collaborators: playwright-core (`ConsoleMessage`).
 * Tests: used by the browser tests under apps/server/test and apps/server/e2e; pinned in
 *   apps/server/test/http/player.browser.int.test.ts and apps/server/test/http/h5pPageCsp.browser.int.test.ts.
 */
import type { ConsoleMessage } from 'playwright-core';

/** Chromium's notice when a page asks for the `unload` event, which it no longer gives by default. */
export const UNLOAD_REFUSED = 'Permissions policy violation: unload is not allowed in this document.';

/**
 * Says whether a console message is an error of the page.
 * @param message - A message from `page.on('console', …)`.
 * @returns True for type `error`, except Chromium's notice about H5P Core's `unload` listener.
 */
export const isPageError = (message: ConsoleMessage): boolean =>
  message.type() === 'error' && message.text() !== UNLOAD_REFUSED;

/**
 * Reads the address of a frame the page policy refused.
 * @param text - A console message's text.
 * @returns The frame's address, or undefined when the message says something else.
 */
export const refusedFrame = (text: string): string | undefined =>
  /^Framing '(https?:\/\/[^']+)' violates the following Content Security Policy directive/.exec(text)?.[1];

/**
 * Reads the address of a script the page policy refused.
 * @param text - A console message's text.
 * @returns The script's address, or undefined when the message says something else.
 */
export const refusedScript = (text: string): string | undefined =>
  /^Loading the script '([^']+)' violates the following Content Security Policy directive/.exec(text)?.[1];
