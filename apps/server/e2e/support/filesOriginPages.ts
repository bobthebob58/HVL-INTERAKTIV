/**
 * filesOriginPages — what the files-origin flow watches in the browser: every request sent to the files origin with
 * its headers, the console of a page, and a file of ours served with chosen headers stripped, as a careless proxy or
 * browser might.
 *
 * Why: `SEC-004` is about what a browser does with our answers: whether cookies, the ltik or a Referer reach the files
 *      origin, and whether a crafted SVG can run script there. Only Chromium can say; the server tests cannot (D-110
 *      amendment of 2026-11-05).
 * Spec: SEC-004
 * Invariants:
 *   - Headers are read with `allHeaders()`, which includes `Cookie` and `Referer` as the browser sent them.
 *   - A stripped answer is the server's own answer for that path (fetched with supertest, since Node does not resolve
 *     `files.localhost`), with only the named headers removed; its body and every other header stay.
 * Collaborators: playwright-core 1.56.1, ../../test/support/filesOriginFixtures.ts, ../filesOrigin.e2e.test.ts.
 * Tests: apps/server/e2e/filesOrigin.e2e.test.ts
 */
import type { BrowserContext, Page } from 'playwright-core';
import type { AppTestbed } from '../../test/support/appTestbed.js';
import { onFilesOrigin } from '../../test/support/filesOriginFixtures.js';

/** One request the browser sent to the files origin. */
export interface SentRequest {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
}

/**
 * Records every request a context sends to an origin, with its headers.
 * @param context - The browser context.
 * @param origin - e.g. `http://files.localhost:<port>`.
 * @returns A function that waits for the headers seen so far and returns them.
 */
export function requestsTo(context: BrowserContext, origin: string): () => Promise<SentRequest[]> {
  const pending: Promise<SentRequest>[] = [];
  context.on('request', (request) => {
    if (!request.url().startsWith(`${origin}/`)) return;
    pending.push(request.allHeaders().then((headers) => ({ url: request.url(), headers })));
  });
  return () => Promise.all(pending);
}

/**
 * Collects a page's console messages, those of its frames included.
 * @param page - The page.
 * @returns The texts, filled as they come.
 */
export function consoleOf(page: Page): string[] {
  const texts: string[] = [];
  page.on('console', (message) => texts.push(message.text()));
  return texts;
}

/**
 * Serves a files-origin URL to this context with some of our headers removed, everything else as the server answers.
 * @param context - The browser context.
 * @param tb - The app test bed behind the files origin.
 * @param url - The absolute files-origin URL.
 * @param strip - Lower-case header names to drop, e.g. `content-disposition`.
 */
export async function servedWithout(
  context: BrowserContext,
  tb: AppTestbed,
  url: string,
  strip: readonly string[],
): Promise<void> {
  const answer = await onFilesOrigin(tb, new URL(url).pathname);
  const headers = Object.fromEntries(
    Object.entries(answer.headers as Record<string, string>).filter(
      ([name]) => !strip.includes(name.toLowerCase()),
    ),
  );
  await context.route(url, (route) =>
    route.fulfill({ status: answer.status, headers, body: answer.body as Buffer }),
  );
}
