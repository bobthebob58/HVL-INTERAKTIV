/**
 * thirdPartyCookies — Chromium with third-party cookies blocked, and a canary that proves the block is on.
 *
 * Why: LTI-003 requires launch → play → resume in a cross-site iframe with third-party cookies blocked (D-065).
 *      The headless shell that `chromium.launch()` starts by default silently ignores both the blocking switch
 *      and the profile setting `profile.cookie_controls_mode`, and CDP `Network.setCookieControls` stops covering
 *      a site-isolated frame after its first load. So tests start the full Chromium build (`channel: 'chromium'`,
 *      new headless mode) with `--test-third-party-cookie-phaseout`. Playwright also turns off storage
 *      partitioning (playwright#32230), so a blocked frame loses localStorage as well, unlike stock Chrome;
 *      `partitionedStorage` restores the stock behaviour.
 * Spec: LTI-003
 * Invariants:
 *   - A test that relies on the block asserts the canary first: an ignored switch must fail, never pass.
 *   - The platform page is served from http://127.0.0.1 and the tool from http://localhost: different sites.
 * Collaborators: playwright-core 1.56.1 (its internal Chromium switch list, read for `partitionedStorage`).
 * Tests: apps/server/test/browser/thirdPartyCookies.browser.test.ts
 */
import { createServer, type Server } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { dirname, join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';

/** The Chromium switch that blocks third-party cookies in every context; only the full build honours it. */
export const BLOCK_THIRD_PARTY_COOKIES_SWITCH = '--test-third-party-cookie-phaseout';

/** How {@link launchCookieTestChromium} starts the browser. */
export interface CookieTestChromiumOptions {
  /** Blocks third-party cookies (default `true`); `false` starts the control browser. */
  readonly blockThirdPartyCookies?: boolean;
  /** Restores the storage partitioning that Playwright turns off, as in stock Chrome (default `false`). */
  readonly partitionedStorage?: boolean;
}

const requireFromHere = createRequire(import.meta.url);

/** Playwright's own `--disable-features=…` switch for Chromium, read from its internal (pinned) module. */
function playwrightDisableFeaturesSwitch(): string {
  const root = dirname(requireFromHere.resolve('playwright-core/package.json'));
  const internal = requireFromHere(join(root, 'lib/server/chromium/chromiumSwitches.js')) as {
    chromiumSwitches: (assistantMode: boolean, channel: string) => string[];
  };
  const found = internal.chromiumSwitches(false, 'chromium').find((s) => s.startsWith('--disable-features='));
  if (!found)
    throw new Error('playwright-core passes no --disable-features switch; recheck partitionedStorage');
  return found;
}

/**
 * Starts the full Chromium build in new headless mode, by default with third-party cookies blocked.
 * @param options - Blocking on or off (control), and whether storage partitioning is restored.
 * @returns A running browser; the caller closes it.
 * @throws When the full Chromium build is not installed (`npx playwright-core install chromium` installs it).
 * @spec LTI-003
 */
export async function launchCookieTestChromium(options: CookieTestChromiumOptions = {}): Promise<Browser> {
  const args = options.blockThirdPartyCookies === false ? [] : [BLOCK_THIRD_PARTY_COOKIES_SWITCH];
  const ignoreDefaultArgs: string[] = [];
  if (options.partitionedStorage) {
    // WHY: listing ThirdPartyStoragePartitioning in --enable-features does not win over Playwright's disable
    // list; replacing that list without the feature does.
    const disabled = playwrightDisableFeaturesSwitch();
    const kept = disabled.slice(disabled.indexOf('=') + 1).split(',');
    ignoreDefaultArgs.push(disabled);
    args.push(
      `--disable-features=${kept.filter((name) => name !== 'ThirdPartyStoragePartitioning').join(',')}`,
    );
  }
  return chromium.launch({ channel: 'chromium', args, ignoreDefaultArgs });
}

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
