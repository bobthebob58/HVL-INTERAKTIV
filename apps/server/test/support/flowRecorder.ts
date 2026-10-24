/**
 * flowRecorder — records what goes wrong while a browser flow uses the tool (failed requests, console and page
 * errors, policy violations, the cookies the tool tries to set) and turns a failed step into an error that names
 * the step and what it saw, with every ltik and Bearer token redacted.
 *
 * Why: an end-to-end flow that times out should say why. A bare Playwright timeout names neither the step nor
 *      the requests that failed before it, and Vitest can point at the wrong line. The record must not leak
 *      the ltik either: H5P's failed AJAX requests carry it in the URL that Chromium logs with the console message,
 *      and CI keeps the test output (LTI-003, DATA-009). With third-party cookies blocked, the browser drops a
 *      tool cookie before it reaches the context's cookie jar, so only the response headers show that the tool
 *      tried to set one.
 * Spec: LTI-003, DATA-009, NFR-004
 * Invariants:
 *   - Nothing that leaves this module contains an ltik value, a JWT or a Bearer token (`redactTokens`).
 *   - `failed` and `requests` hold paths only, never query strings; `setCookies` holds cookie names, never values.
 *   - Only responses from the tool's origin count as failed requests or cookies.
 * Collaborators: playwright-core 1.56.1 (`Response.headerValue` reads the raw headers, Set-Cookie included).
 * Tests: apps/server/e2e/flowRecord.e2e.test.ts; used by apps/server/e2e/appPlayEditor.e2e.test.ts and
 *   apps/server/e2e/publishWithReason.e2e.test.ts
 */
import type { ConsoleMessage, Page } from 'playwright-core';

/**
 * Replaces ltik values, JWTs and Bearer tokens in `text` with placeholders.
 * @param text - A URL, console message, error message or stack.
 * @returns The text without tokens.
 * @spec DATA-009
 */
export function redactTokens(text: string): string {
  return text
    .replace(/(ltik=)[^&\s)'"]+/gi, '$1[redacted]')
    .replace(/(Bearer\s+)[^\s'"]+/g, '$1[redacted]')
    .replace(/eyJ[\w-]*\.[\w-]+\.[\w-]*/g, '[redacted JWT]');
}

/** What a flow saw of the tool, for its assertions and for the explanation of a failure. */
export interface FlowRecord {
  /** Tool responses with status 400 or above, as `<status> <path>`. */
  readonly failed: readonly string[];
  /** Console errors, page errors and policy violations that are not ignored, redacted. */
  readonly problems: readonly string[];
  /** Cookies the tool's responses tried to set, as `<path> <name>`, whether or not the browser kept them. */
  readonly setCookies: readonly string[];
  /** Requests to the tool, as `<method> <path>`. */
  readonly requests: readonly string[];
  /** The step the flow is in; a failure names it. */
  step: string;
  /** Waits until the Set-Cookie headers of the responses so far are read. */
  settled(): Promise<void>;
  /**
   * Builds the error a failed step throws: the step, the redacted error, what failed so far and `facts`.
   * @param error - What the step threw.
   * @param facts - What the flow knows about its state (rendered as JSON, redacted).
   * @returns An error whose cause is a redacted copy of `error` that keeps its stack.
   */
  explain(error: unknown, facts?: Record<string, unknown>): Error;
  /**
   * Runs a flow's steps and rethrows a failure as {@link FlowRecord.explain} with `facts()`.
   * @param steps - The steps; they set `step` as they go.
   * @param facts - Reads what the flow knows at the moment of the failure.
   * @returns What `steps` returns.
   */
  run<T>(steps: () => Promise<T>, facts?: () => Promise<Record<string, unknown>>): Promise<T>;
}

/** How {@link recordFlow} filters the console. */
export interface FlowRecordOptions {
  /** Console errors the flow does not test (each caller says why); page errors are never ignored. */
  readonly ignoreConsole?: (message: ConsoleMessage) => boolean;
}

/** `<path>` of a URL, without its query string. */
const pathOnly = (url: string): string =>
  url.startsWith('http') ? new URL(url).pathname : url.split('?')[0]!;

/** A redacted copy of `error` that keeps its stack, so Vitest still shows where it was thrown. */
function redactedCopy(error: unknown): Error {
  const original = error instanceof Error ? error : new Error(String(error));
  const copy = new Error(redactTokens(original.message));
  copy.name = original.name;
  copy.stack = redactTokens(original.stack ?? copy.message);
  return copy;
}

/**
 * Starts recording a page's flow against the tool; call it before the page's first navigation.
 * @param page - The page that runs the flow (its frames, including cross-site ones, are recorded too).
 * @param toolOrigin - The tool's origin, e.g. `http://localhost:<port>`.
 * @param options - Console errors to ignore.
 * @returns The live record.
 * @spec LTI-003
 */
export async function recordFlow(
  page: Page,
  toolOrigin: string,
  options: FlowRecordOptions = {},
): Promise<FlowRecord> {
  const failed: string[] = [];
  const problems: string[] = [];
  const setCookies: string[] = [];
  const requests: string[] = [];
  const pending: Promise<void>[] = [];
  const fromTool = (url: string) => url.startsWith(`${toolOrigin}/`) || url === toolOrigin;
  // WHY: a policy violation is reported to the page, not the console; this makes it a console error in every frame.
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => {
      console.error(`csp: ${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  page.on('request', (r) => {
    if (fromTool(r.url())) requests.push(`${r.method()} ${pathOnly(r.url())}`);
  });
  page.on('response', (r) => {
    if (!fromTool(r.url())) return;
    if (r.status() >= 400) failed.push(`${r.status()} ${pathOnly(r.url())}`);
    const names = r.headerValue('set-cookie').then((header) => {
      for (const line of header?.split('\n') ?? []) {
        setCookies.push(`${pathOnly(r.url())} ${line.split('=')[0]?.trim() ?? ''}`);
      }
    });
    // WHY: a response of a page that closed meanwhile has no headers to read; it set no cookie we could see.
    pending.push(names.catch(() => undefined));
  });
  page.on('console', (m) => {
    if (m.type() !== 'error' || options.ignoreConsole?.(m)) return;
    problems.push(redactTokens(`${m.text()} (${m.location().url})`));
  });
  page.on('pageerror', (e) => problems.push(redactTokens(e.message)));
  const record: FlowRecord = {
    failed,
    problems,
    setCookies,
    requests,
    step: 'start',
    settled: async () => void (await Promise.all(pending)),
    explain: (error, facts = {}) => {
      const cause = redactedCopy(error);
      const seen = JSON.stringify({ failed, problems, setCookies, ...facts });
      const message = `the flow failed at "${record.step}": ${cause.name}: ${cause.message.split('\n')[0]} ${seen}`;
      return new Error(redactTokens(message), { cause });
    },
    run: async (steps, facts = async () => ({})) => {
      try {
        return await steps();
      } catch (error) {
        const known = await facts().catch((e: unknown) => ({ facts: `unreadable (${String(e)})` }));
        throw record.explain(error, known);
      }
    },
  };
  return record;
}
