/**
 * realTypesPlayer — a running server with every real content type imported and published, and helpers that open
 * one type's player page in Chromium, press its check button and read its accessibility tree.
 *
 * Why: the theme tests (UD-003, UD-011) need the real H5P markup of all ten types (D-078) behind the production
 *      router, in more than one test file; one setup keeps them consistent.
 * Spec: UD-003, UD-011
 * Tests: apps/server/test/h5p/hvlTheme.browser.int.test.ts, apps/server/test/h5p/hvlFeedback.browser.int.test.ts
 */
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import type { Browser, Page } from 'playwright-core';
import { openHttpTestbed, type HttpTestbed, type TestActor } from './httpTestbed.js';
import { packageExamples, REAL_PACKAGES_DIR } from './realPackages.js';

/** The server, its people and the activity of each type. */
export interface RealTypesServer {
  readonly tb: HttpTestbed;
  /** `http://127.0.0.1:<port>`. */
  readonly base: string;
  readonly author: TestActor;
  readonly learner: TestActor;
  /** Main library name (e.g. `H5P.MultiChoice`) → activity ID. */
  readonly ids: ReadonlyMap<string, string>;
  close(): Promise<void>;
}

/**
 * Seeds the real packages, imports each example as a published activity and starts listening.
 * @returns The running server; call `close` in `afterAll`.
 */
export async function openRealTypesServer(): Promise<RealTypesServer> {
  const tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
  const author = await tb.actor('author');
  const learner = await tb.actor('learner');
  const ids = new Map<string, string>();
  for (const example of await packageExamples()) {
    const id = await tb.importPackage(author, join(REAL_PACKAGES_DIR, example.file), { published: true });
    ids.set(example.library.split(' ')[0] ?? '', id);
  }
  const server: Server = tb.app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  return {
    tb,
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    author,
    learner,
    ids,
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      await tb.close();
    },
  };
}

/**
 * Opens the player page of one type as `actor` and waits until H5P has started the activity.
 * @param browser - The running Chromium.
 * @param server - From `openRealTypesServer`.
 * @param library - Main library name, e.g. `H5P.MultiChoice`, or the ID of another activity.
 * @param actor - Who views it; the learner by default.
 * @returns The page.
 */
export async function openRealPlayer(
  browser: Browser,
  server: RealTypesServer,
  library: string,
  actor: TestActor = server.learner,
): Promise<Page> {
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ [actor.header[0]]: actor.header[1] });
  await page.goto(`${server.base}/h5p/play/${server.ids.get(library) ?? library}`);
  await page.waitForFunction(
    () => (window as unknown as { H5P?: { instances?: unknown[] } }).H5P?.instances?.length,
  );
  return page;
}

/**
 * Presses the visible check button (JoubelUI in MultiChoice and Blanks, Daylight in DragText).
 * @param page - A player page.
 */
export async function checkAnswers(page: Page): Promise<void> {
  await page.locator('.h5p-question-check-answer:visible, .h5p-theme-check:visible').first().click();
}

/**
 * The accessibility tree of the activity, as Playwright's ARIA snapshot.
 * @param page - A player page.
 * @returns The snapshot text.
 */
export function contentTree(page: Page): Promise<string> {
  return page.locator('.h5p-content').ariaSnapshot();
}
