/**
 * SharedChromium — the one Chromium a server process prints PDFs with: started on the first export, shared by every
 * export after it, started again after a crash, and closed at shutdown.
 *
 * Why: starting a browser takes far longer than printing a portfolio (probe P4: 50–100 ms per export), so D-096 keeps
 *      one browser per process and isolates each export in a fresh context instead. The launch options are D-096's
 *      probe amendment exactly: playwright-core's defaults would hand Chromium the server's whole environment, its
 *      secrets included, and turn the sandbox off.
 * Spec: MAPPE-004
 * Invariants:
 *   - SECURITY: the browser gets only PATH and HOME, and keeps Chromium's sandbox unless `PDF_ALLOW_NO_SANDBOX` is
 *     true, which production refuses (../../../config/productionChecks.ts); the root development container needs it.
 *   - Nothing is started until the first `browser()`; exports that ask while it starts share the one launch.
 *   - A failed launch, or a browser that disconnects (a crash), is forgotten, so the next export starts a new one.
 *   - A browser that stops answering while still connected is discarded (`discard`): forgotten the same way and
 *     closed without waiting, since a stalled browser may never finish closing (D-096 S5 review amendment).
 *   - Playwright installs no signal handlers: the server's own shutdown closes the browser (`close`).
 *   - After `close`, no browser is started again.
 * Collaborators: ./PdfRenderer.ts, playwright-core 1.56.1, ../../../config/env.ts (`PDF_*`).
 * Tests: apps/server/test/learningDesign/mappe/mappePdf.browser.int.test.ts,
 *   apps/server/test/learningDesign/mappe/pdfRenderer.test.ts,
 *   apps/server/test/learningDesign/mappe/pdfRendererTimeLimit.test.ts
 */
import { chromium, type Browser, type LaunchOptions } from 'playwright-core';
import type { Env } from '../../../config/env.js';

/** How long a launch may take before the export is answered as unavailable. */
export const BROWSER_LAUNCH_TIMEOUT_MS = 20_000;

/** Starts a browser; `chromium.launch` outside tests. */
export type LaunchBrowser = (options: LaunchOptions) => Promise<Browser>;

/**
 * The launch options of D-096, all explicit.
 * @param env - The configuration: `PDF_BROWSER_EXECUTABLE` and `PDF_ALLOW_NO_SANDBOX`.
 * @param processEnv - The server's environment, of which only PATH and HOME are passed on.
 * @returns The options for `chromium.launch`.
 * @spec MAPPE-004
 */
export function pdfBrowserLaunchOptions(
  env: Pick<Env, 'PDF_BROWSER_EXECUTABLE' | 'PDF_ALLOW_NO_SANDBOX'>,
  processEnv: NodeJS.ProcessEnv = process.env,
): LaunchOptions {
  return {
    // SECURITY: the sandbox confines a renderer that parses author text; only a root development container lifts it.
    chromiumSandbox: !env.PDF_ALLOW_NO_SANDBOX,
    // SECURITY: a scrubbed environment, so no secret of the server (database URL, keys) reaches the browser.
    env: { PATH: processEnv.PATH ?? '', HOME: processEnv.HOME ?? '' },
    executablePath: env.PDF_BROWSER_EXECUTABLE ?? chromium.executablePath(),
    timeout: BROWSER_LAUNCH_TIMEOUT_MS,
    // WHY: playwright's handlers would kill the browser on a signal before the server finishes its requests.
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false,
  };
}

/** The shared browser of a process. */
export class SharedChromium {
  private starting: Promise<Browser> | undefined;
  private closed = false;
  /** The launch each running browser came from, so forgetting one never forgets a newer launch. */
  private readonly launchOf = new WeakMap<Browser, Promise<Browser>>();

  /**
   * @param options - The launch options (`pdfBrowserLaunchOptions`).
   * @param launch - Starts a browser; `chromium.launch` by default.
   */
  constructor(
    private readonly options: LaunchOptions,
    private readonly launch: LaunchBrowser = (launchOptions) => chromium.launch(launchOptions),
  ) {}

  /**
   * The running browser, started on the first call.
   * @returns The browser.
   * @throws Error when it cannot start, or after `close`.
   */
  browser(): Promise<Browser> {
    if (this.closed) return Promise.reject(new Error('the PDF browser is closed'));
    if (this.starting) return this.starting;
    const attempt = this.launch(this.options).then((browser) => {
      this.launchOf.set(browser, attempt);
      // WHY: a crashed or killed browser disconnects; forgetting it lets the next export start a new one.
      browser.on('disconnected', () => this.forget(browser));
      return browser;
    });
    this.starting = attempt;
    attempt.catch(() => {
      if (this.starting === attempt) this.starting = undefined;
    });
    return attempt;
  }

  /**
   * Discards a browser that stopped answering: the next `browser()` starts a new one.
   * @param browser - The browser an export got from `browser()`; a newer one is kept.
   */
  discard(browser: Browser): void {
    this.forget(browser);
    // WHY: a stalled browser may never finish closing; nothing waits for it, and playwright kills it at exit.
    browser.close().catch(() => undefined);
  }

  private forget(browser: Browser): void {
    if (this.starting !== undefined && this.starting === this.launchOf.get(browser))
      this.starting = undefined;
  }

  /** Closes the browser if one runs; later calls of `browser` fail. */
  async close(): Promise<void> {
    this.closed = true;
    const starting = this.starting;
    this.starting = undefined;
    const browser = await starting?.catch(() => undefined);
    await browser?.close();
  }
}
