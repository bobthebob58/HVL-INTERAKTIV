/**
 * thirdPartyCookieCanary — two local sites that show what a cross-site frame can store and send, so a test can
 * prove that third-party cookies really are blocked before it relies on it.
 *
 * Why: a browser can ignore a blocking switch or setting without saying so (D-065, D-149). The canary is a platform
 *      page that frames a tool page from another site; the frame reports whether its cookie was stored and sent and
 *      whether its storage can be reached, and a top-level page of the tool sets a `__Host-` cookie.
 * Spec: LTI-003
 * Invariants:
 *   - The platform page is served from http://127.0.0.1 and the tool from http://localhost: different sites.
 *   - Both servers listen on loopback only and answer with `no-store`.
 * Collaborators: ./thirdPartyCookies.ts (starts the browser the canary is opened in).
 * Tests: apps/server/test/browser/thirdPartyCookies.browser.test.ts
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Page } from 'playwright-core';

/** What the cross-site tool frame could do, as it reported to the platform page. */
export interface CrossSiteFrameReport {
  /** `document.cookie` in the frame after its response set `canary=1; SameSite=None; Secure; Path=/`. */
  readonly documentCookie: string;
  /** The Cookie header the tool received on the frame's follow-up `fetch` with credentials. */
  readonly followUpCookie: string;
  /** `'ok'`, or the name of the error that reaching `localStorage.setItem` threw. */
  readonly localStorage: string;
  /** `'ok'`, or the name of the error that reaching `sessionStorage.setItem` threw. */
  readonly sessionStorage: string;
}

/** Two local sites: a platform page on http://127.0.0.1 that frames a tool page from http://localhost. */
export interface CookieCanary {
  /** The tool's origin, `http://localhost:<port>`; its `/top-level` page sets a `__Host-canary` cookie. */
  readonly toolOrigin: string;
  /** Loads the platform page in `page` and returns the tool frame's first report. */
  open(page: Page): Promise<CrossSiteFrameReport>;
  /** Navigates the tool frame of a platform page opened by {@link CookieCanary.open} again; returns its report. */
  reloadFrame(page: Page): Promise<CrossSiteFrameReport>;
  /** Stops both servers. */
  close(): Promise<void>;
}

const FRAME_PAGE = `<!doctype html><title>Tool</title><script>
(async () => {
  const attempt = (store) => { try { store().setItem('canary', '1'); return 'ok'; } catch (e) { return e.name; } };
  const report = { documentCookie: document.cookie, localStorage: attempt(() => localStorage),
    sessionStorage: attempt(() => sessionStorage) };
  report.followUpCookie = await fetch('/echo', { credentials: 'include' }).then((response) => response.text());
  parent.postMessage(report, '*');
})();
</script>`;

const platformPage = (toolOrigin: string): string => `<!doctype html><title>Platform</title><script>
window.reports = [];
addEventListener('message', (event) => { if (event.origin === '${toolOrigin}') window.reports.push(event.data); });
</script><iframe title="Tool" src="${toolOrigin}/frame"></iframe>`;

/** Answers the tool's routes: the framed page, an echo of the Cookie header, and a top-level page. */
function toolServer(): Server {
  return createServer((request, response) => {
    const headers: Record<string, string> = { 'cache-control': 'no-store', 'content-type': 'text/html' };
    if (request.url?.startsWith('/frame')) {
      response.writeHead(200, { ...headers, 'set-cookie': 'canary=1; SameSite=None; Secure; Path=/' });
      response.end(FRAME_PAGE);
    } else if (request.url === '/echo') {
      response.writeHead(200, { ...headers, 'content-type': 'text/plain' }).end(request.headers.cookie ?? '');
    } else if (request.url === '/top-level') {
      const cookie = '__Host-canary=1; Secure; HttpOnly; SameSite=Lax; Path=/';
      response.writeHead(200, { ...headers, 'set-cookie': cookie }).end('<!doctype html><title>Tool</title>');
    } else {
      response.writeHead(404, headers).end();
    }
  });
}

/** Starts `server` on a free loopback port and returns the port. */
async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  return (server.address() as AddressInfo).port;
}

/** Waits until the platform page in `page` holds more than `seen` reports and returns report number `seen`. */
async function nextReport(page: Page, seen: number): Promise<CrossSiteFrameReport> {
  type Reports = { reports: CrossSiteFrameReport[] };
  await page.waitForFunction((count) => (window as unknown as Reports).reports.length > count, seen);
  return page.evaluate((index) => (window as unknown as Reports).reports[index]!, seen);
}

/**
 * Starts the platform and tool servers of the third-party-cookie canary.
 * @returns The canary; call `close()` when done.
 * @spec LTI-003
 */
export async function startCookieCanary(): Promise<CookieCanary> {
  const tool = toolServer();
  const toolOrigin = `http://localhost:${await listen(tool)}`;
  const platform = createServer((_request, response) => {
    response.writeHead(200, { 'cache-control': 'no-store', 'content-type': 'text/html' });
    response.end(platformPage(toolOrigin));
  });
  const platformUrl = `http://127.0.0.1:${await listen(platform)}/`;
  const reportCount = (page: Page) =>
    page.evaluate(() => (window as unknown as { reports: [] }).reports.length);
  return {
    toolOrigin,
    async open(page) {
      await page.goto(platformUrl);
      return nextReport(page, 0);
    },
    async reloadFrame(page) {
      const seen = await reportCount(page);
      const url = `${toolOrigin}/frame?load=${seen + 1}`;
      await page.evaluate((src) => document.querySelector('iframe')!.setAttribute('src', src), url);
      return nextReport(page, seen);
    },
    async close() {
      for (const server of [tool, platform]) server.closeAllConnections();
      await Promise.all([tool, platform].map((server) => new Promise((resolve) => server.close(resolve))));
    },
  };
}
