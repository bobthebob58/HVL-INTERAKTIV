/**
 * userFileRequests — lists every request a page and its frames make for a file an author uploaded: the origin it
 * went to, the kind of path, and how it was answered.
 *
 * Why: `SEC-004` asks that such a file never comes from the app's own origin. The page's settings say where H5P
 *      should ask; only the browser's own requests show where it did ask, also for the addresses H5P builds itself
 *      (its fallback `<url>/content/<id>/…`, a pasted piece's `../<id>/…`). The editor's tests assert on this list
 *      (D-153).
 * Spec: SEC-004
 * Invariants:
 *   - A request counts when its path starts with a path that serves, or once served, an uploaded file:
 *     `/h5p/files/`, `/h5p/editor-files/`, `/h5p/uploads/`, `/h5p/content/` and `/h5p/temp-files/`.
 *   - Only `GET` and `HEAD` count: a save (`PUT /h5p/content/<id>`) is not a request for a file. A request the
 *     page gave up itself (a video still loading when the test opens the next page) is not an answer and is left out.
 *   - An entry holds the origin, the kind and the status only: never the grant, the activity or the file name.
 * Collaborators: playwright-core 1.65.1.
 * Tests: used by apps/server/e2e/editorImageTool.e2e.test.ts and apps/server/e2e/editorFilesOrigin.e2e.test.ts
 */
import type { Page } from 'playwright-core';

/** The first path segments of every address that serves, or once served, an uploaded file. */
const USER_FILE_PATH = /^\/h5p\/(files|editor-files|uploads|content|temp-files)\//;

/** One request for an uploaded file. */
export interface UserFileRequest {
  /** The origin the request went to. */
  readonly origin: string;
  /** The path's kind: `files`, `editor-files`, `uploads`, `content` or `temp-files`. */
  readonly kind: string;
  /** The answer's status, or `failed` when the browser got none (refused by the page policy, for one). */
  readonly status: number | 'failed';
}

/**
 * Starts listing the page's requests for uploaded files.
 * @param page - The page; its frames' requests count too.
 * @returns The list, which grows as the page asks.
 */
export function recordUserFileRequests(page: Page): UserFileRequest[] {
  const seen: UserFileRequest[] = [];
  const note = (method: string, url: string, status: number | 'failed') => {
    if (!url.startsWith('http') || !['GET', 'HEAD'].includes(method)) return;
    const { origin, pathname } = new URL(url);
    const kind = USER_FILE_PATH.exec(pathname)?.[1];
    if (kind) seen.push({ origin, kind, status });
  };
  page.on('response', (response) => note(response.request().method(), response.url(), response.status()));
  page.on('requestfailed', (request) => {
    // WHY: `net::ERR_ABORTED` is the page leaving, not a refusal by a server, a policy or the browser.
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') note(request.method(), request.url(), 'failed');
  });
  return seen;
}

/**
 * The distinct requests of a list, as `<origin> <kind> <status>`, sorted.
 * @param requests - The recorded requests.
 * @returns One line per distinct origin, kind and status.
 */
export const distinctUserFileRequests = (requests: readonly UserFileRequest[]): string[] =>
  [...new Set(requests.map(({ origin, kind, status }) => `${origin} ${kind} ${status}`))].sort();
