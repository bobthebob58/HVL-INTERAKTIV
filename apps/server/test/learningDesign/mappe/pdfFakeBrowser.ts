/**
 * pdfFakeBrowser — a stand-in Chromium for the PDF renderer's unit tests: it records each export context (options,
 * routes and their handlers, whether it was closed, the PDF options) and can stall where a real browser may stall.
 *
 * Why: D-096 and its S5 review amendment make rules about how an export uses the shared browser (an isolated context
 *      per export, every request aborted, one time limit from opening the context, a stalled browser replaced). A
 *      real browser cannot be made to stall on cue, so the tests drive these rules with this stand-in (MAPPE-004).
 * Spec: MAPPE-004
 * Invariants:
 *   - Records only; it never prints. `page.pdf` answers the stand-in PDF unless `print` says otherwise.
 *   - `opening` holds `newContext`, `print` holds `page.pdf` and `hang` holds every context close.
 *   - `close()` of the browser fires `disconnected`, as a real browser's close does.
 * Collaborators: ../../../src/learningDesign/mappe/pdf/PdfRenderer.ts, playwright-core (types only).
 * Tests: apps/server/test/learningDesign/mappe/pdfRenderer.test.ts,
 *   apps/server/test/learningDesign/mappe/pdfRendererTimeLimit.test.ts
 */
import type { Browser, LaunchOptions } from 'playwright-core';
import { vi } from 'vitest';
import { HttpError } from '../../../src/http/HttpError.js';
import { PdfRenderer } from '../../../src/learningDesign/mappe/pdf/PdfRenderer.js';
import { createLogger } from '../../../src/logging/logger.js';

/** The bytes every stand-in export prints. */
export const PDF = Buffer.from('%PDF-1.4 stand-in');

/** What one export context was asked. */
export interface FakeContext {
  readonly options: unknown;
  readonly routes: string[];
  /** The handler registered with each route, in order. */
  readonly handlers: ((route: unknown) => unknown)[];
  closed: boolean;
  pdfOptions?: unknown;
}

/** Where the stand-in stalls. */
export interface FakeBrowserOptions {
  /** What `page.pdf` answers; the stand-in PDF at once by default. */
  readonly print?: () => Promise<Buffer>;
  /** Stands for a browser that never finishes closing a context. */
  readonly hang?: boolean;
  /** What `newContext` waits for before it answers; nothing by default. */
  readonly opening?: () => Promise<void>;
}

/**
 * A stand-in browser that records what the renderer asks of it.
 * @param options - Where it stalls.
 * @returns The browser, its contexts, a way to make it crash, and its `close` spy.
 */
export function fakeBrowser(options: FakeBrowserOptions = {}) {
  const contexts: FakeContext[] = [];
  let disconnect: () => void = () => undefined;
  const browser = {
    on: (event: string, listener: () => void) => {
      if (event === 'disconnected') disconnect = listener;
    },
    close: vi.fn(async () => disconnect()),
    newContext: async (contextOptions: unknown) => {
      await options.opening?.();
      const record: FakeContext = { options: contextOptions, routes: [], handlers: [], closed: false };
      contexts.push(record);
      return {
        route: async (pattern: string, handler: (route: unknown) => unknown) => {
          record.routes.push(pattern);
          record.handlers.push(handler);
        },
        newPage: async () => ({
          setContent: async () => undefined,
          pdf: async (pdfOptions: unknown) => {
            record.pdfOptions = pdfOptions;
            return options.print ? options.print() : PDF;
          },
        }),
        close: () => (
          (record.closed = true),
          options.hang ? new Promise<void>(() => undefined) : Promise.resolve()
        ),
      };
    },
  };
  return {
    browser: browser as unknown as Browser,
    contexts,
    crash: () => disconnect(),
    close: browser.close,
  };
}

/** The renderer's settings in these tests. */
export const ENV = {
  PDF_ALLOW_NO_SANDBOX: false,
  PDF_MAX_CONCURRENCY: 2,
  PDF_BROWSER_EXECUTABLE: '/usr/bin/chromium',
};

/**
 * A renderer that starts its browser with `launch`.
 * @param launch - Answers the stand-in browser.
 * @param extra - Overrides, such as `timeLimitMs` or `env`.
 * @returns The renderer, logging nothing.
 */
export const renderer = (launch: (options: LaunchOptions) => Promise<Browser>, extra: object = {}) =>
  new PdfRenderer({ env: ENV, logger: createLogger({ level: 'silent' }), launch, ...extra });

/**
 * An HTTP error as `status errorCode`, anything else as text.
 * @param error - What a render rejected with.
 * @returns E.g. `503 hvl:pdf-busy`.
 */
export const codeOf = (error: unknown) =>
  error instanceof HttpError ? `${error.status} ${error.errorCode}` : String(error);
