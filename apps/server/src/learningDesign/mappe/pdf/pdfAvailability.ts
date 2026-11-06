/**
 * pdfAvailability — the start-up probe of the PDF export: starts Chromium with the export's own launch options, opens
 * one offline page, closes the browser, and logs one line saying whether the export works and keeps its sandbox.
 *
 * Why: a container whose runtime refuses Chromium's sandbox (Docker's default seccomp profile, a root user) answers
 *      every PDF export with 503 `hvl:pdf-unavailable`, and nobody learns why until a teacher asks (D-096). One line
 *      at start-up tells the operator, by a reason code, before anyone exports (D-110 amendment of 2026-11-05).
 * Spec: MAPPE-004
 * Invariants:
 *   - Uses `pdfBrowserLaunchOptions` unchanged: the same sandbox setting, scrubbed environment and executable as an
 *     export, so the probe proves what an export would meet.
 *   - The page is offline with JavaScript off and loads nothing; the browser is always closed.
 *   - Never throws; the result says why the export is unavailable.
 *   - SECURITY/PRIVACY: the log line holds `pdfAvailable`, `pdfSandbox` and a reason code only, never Chromium's error
 *     text, which can carry paths and command lines.
 * Collaborators: ./SharedChromium.ts (`pdfBrowserLaunchOptions`, `LaunchBrowser`), ./pdfCheckCli.ts,
 *   ../../../server/main.ts (calls `logPdfAvailability` once after listening), playwright-core 1.56.1.
 * Tests: apps/server/test/learningDesign/mappe/pdfAvailability.test.ts
 */
import { chromium, type Browser } from 'playwright-core';
import type { Logger } from 'pino';
import type { Env } from '../../../config/env.js';
import { pdfBrowserLaunchOptions, type LaunchBrowser } from './SharedChromium.js';

/** Why the export is or is not available. */
export type PdfAvailabilityReason =
  | 'ok'
  | 'sandbox-off'
  | 'no-browser'
  | 'no-usable-sandbox'
  | 'root-without-no-sandbox'
  | 'launch-timeout'
  | 'launch-failed'
  | 'page-failed';

/** What the probe found. */
export interface PdfAvailability {
  /** Whether a PDF export can print. */
  readonly available: boolean;
  /** Whether Chromium runs with its sandbox (always false when `PDF_ALLOW_NO_SANDBOX` is true). */
  readonly sandbox: boolean;
  readonly reason: PdfAvailabilityReason;
}

/** What the probe is built from. */
export interface PdfAvailabilityDeps {
  readonly env: Pick<Env, 'PDF_BROWSER_EXECUTABLE' | 'PDF_ALLOW_NO_SANDBOX'>;
  /** Starts the browser; `chromium.launch` by default (tests replace it). */
  readonly launch?: LaunchBrowser;
  /** How long opening the page may take; the launch has its own limit in the launch options. */
  readonly pageTimeLimitMs?: number;
}

/** How long opening the probe's page may take by default. */
export const PDF_PROBE_PAGE_TIME_LIMIT_MS = 10_000;

/**
 * The reason code for a failed launch, read from Chromium's and Playwright's messages.
 * @param error - What `chromium.launch` threw.
 * @returns The reason code; `launch-failed` for anything not recognised.
 * @spec MAPPE-004
 */
export function launchFailureReason(error: unknown): PdfAvailabilityReason {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  // WHY: the namespace sandbox chroots after it creates its namespaces; that fails without CAP_SYS_CHROOT.
  if (/No usable sandbox|sys_chroot\(/i.test(message)) return 'no-usable-sandbox';
  if (/Running as root without --no-sandbox/i.test(message)) return 'root-without-no-sandbox';
  if (/Executable doesn't exist|ENOENT/i.test(message)) return 'no-browser';
  if (/TimeoutError|Timeout \d+ms exceeded/i.test(message)) return 'launch-timeout';
  return 'launch-failed';
}

const withinTimeLimit = <T>(work: Promise<T>, ms: number): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('the probe page did not open in time')), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
};

/**
 * Starts Chromium as an export would, opens one offline page and closes the browser.
 * @param deps - The PDF settings and, for tests, the launcher and the page's time limit.
 * @returns Whether the export is available, whether it keeps the sandbox, and why.
 * @spec MAPPE-004
 */
export async function checkPdfAvailability(deps: PdfAvailabilityDeps): Promise<PdfAvailability> {
  const sandbox = !deps.env.PDF_ALLOW_NO_SANDBOX;
  const launch = deps.launch ?? ((options) => chromium.launch(options));
  let browser: Browser;
  try {
    browser = await launch(pdfBrowserLaunchOptions(deps.env));
  } catch (error) {
    return { available: false, sandbox, reason: launchFailureReason(error) };
  }
  try {
    await withinTimeLimit(
      (async () => {
        // SECURITY: the same isolation as an export: no JavaScript, offline, nothing loaded.
        const context = await browser.newContext({ javaScriptEnabled: false, offline: true });
        await context.newPage();
        await context.close();
      })(),
      deps.pageTimeLimitMs ?? PDF_PROBE_PAGE_TIME_LIMIT_MS,
    );
  } catch {
    return { available: false, sandbox, reason: 'page-failed' };
  } finally {
    // WHY: a stalled browser may never finish closing; the probe waits for it at most one more time limit.
    await withinTimeLimit(browser.close(), deps.pageTimeLimitMs ?? PDF_PROBE_PAGE_TIME_LIMIT_MS).catch(
      () => undefined,
    );
  }
  return { available: true, sandbox, reason: sandbox ? 'ok' : 'sandbox-off' };
}

/**
 * Runs the probe and logs its one line: info when the export works with its sandbox, warn otherwise.
 * @param deps - The probe's settings and the logger.
 * @returns What the probe found.
 * @spec MAPPE-004
 */
export async function logPdfAvailability(
  deps: PdfAvailabilityDeps & { readonly logger: Logger },
): Promise<PdfAvailability> {
  const found = await checkPdfAvailability(deps);
  const line = { pdfAvailable: found.available, pdfSandbox: found.sandbox, reason: found.reason };
  if (found.reason === 'ok') deps.logger.info(line, 'PDF export availability');
  else deps.logger.warn(line, 'PDF export availability');
  return found;
}
