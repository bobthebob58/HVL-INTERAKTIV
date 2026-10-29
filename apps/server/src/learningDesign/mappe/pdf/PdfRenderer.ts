/**
 * PdfRenderer — prints a pedagogisk mappe's HTML as a tagged PDF with an outline, in a fresh, isolated context of the
 * process's shared Chromium, within the PDF slots and a time limit.
 *
 * Why: MAPPE-004 asks for a PDF with a structure tree, an outline, the document language, a title and real text;
 *      Chromium's `page.pdf({ tagged, outline })` makes one from semantic HTML (D-096, probe P4). Author text ends up
 *      in that HTML, so each export runs with JavaScript off, offline, and with every request aborted.
 * Spec: MAPPE-004, MAPPE-003
 * Invariants:
 *   - SECURITY: a fresh context per export (`javaScriptEnabled: false`, `offline: true`), every request aborted so a
 *     crafted link or image can never make the server fetch anything (SSRF), and the context closed in `finally`
 *     (waiting at most one time limit for it, so a hung browser cannot keep a slot taken).
 *   - At most `PDF_MAX_CONCURRENCY` exports per process and one per person; otherwise 503 `hvl:pdf-busy` at once.
 *   - No browser (none installed, or it will not start) or an export over the time limit: 503
 *     `hvl:pdf-unavailable`; the Markdown export always works. The log line names no person and no content.
 *   - PRIVACY: the PDF exists only in memory and is returned; no file is written (MAPPE-003).
 *   - `close()` closes the browser at the server's shutdown.
 * Collaborators: ./SharedChromium.ts, ./PdfSlots.ts, ./mappeHtml.ts, ../../../server/studioServices.ts (builds it),
 *   ../../http/mappeRoutes.ts, ../../../http/learningDesignErrors.ts.
 * Tests: apps/server/test/learningDesign/mappe/mappePdf.browser.int.test.ts,
 *   apps/server/test/learningDesign/mappe/pdfRenderer.test.ts
 */
import type { Logger } from 'pino';
import type { Browser } from 'playwright-core';
import type { Env } from '../../../config/env.js';
import { HttpError } from '../../../http/HttpError.js';
import { learningDesignError } from '../../../http/learningDesignErrors.js';
import { PdfSlots } from './PdfSlots.js';
import { pdfBrowserLaunchOptions, SharedChromium, type LaunchBrowser } from './SharedChromium.js';

/** How long one export may take, from taking a slot to the last byte of the PDF. */
export const PDF_EXPORT_TIME_LIMIT_MS = 30_000;

/** What the renderer is built from. */
export interface PdfRendererDeps {
  readonly env: Pick<Env, 'PDF_BROWSER_EXECUTABLE' | 'PDF_ALLOW_NO_SANDBOX' | 'PDF_MAX_CONCURRENCY'>;
  readonly logger: Logger;
  /** Starts the browser; `chromium.launch` by default (tests replace it). */
  readonly launch?: LaunchBrowser;
  /** The time limit of one export; `PDF_EXPORT_TIME_LIMIT_MS` by default. */
  readonly timeLimitMs?: number;
}

const firstLine = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).split('\n')[0] ?? 'unknown error';

/** Prints portfolio HTML as tagged PDFs. */
export class PdfRenderer {
  private readonly browser: SharedChromium;
  private readonly slots: PdfSlots;
  private readonly timeLimitMs: number;

  /** @param deps - The configuration, the logger and, for tests, the launcher and the time limit. */
  constructor(private readonly deps: PdfRendererDeps) {
    this.browser = new SharedChromium(pdfBrowserLaunchOptions(deps.env), deps.launch);
    this.slots = new PdfSlots(deps.env.PDF_MAX_CONCURRENCY);
    this.timeLimitMs = deps.timeLimitMs ?? PDF_EXPORT_TIME_LIMIT_MS;
  }

  /**
   * Prints one portfolio.
   * @param html - The self-contained document (./mappeHtml.ts).
   * @param userId - Whose export it is, for the one-per-person slot.
   * @returns The PDF.
   * @throws HttpError 503 `hvl:pdf-busy` without a free slot, and 503 `hvl:pdf-unavailable` without a browser or
   *   past the time limit.
   */
  async render(html: string, userId: string): Promise<Buffer> {
    const release = this.slots.take(userId);
    if (!release) throw learningDesignError('hvl:pdf-busy');
    try {
      const browser = await this.browser.browser().catch((error: unknown) => {
        this.deps.logger.warn({ reason: firstLine(error) }, 'pdf browser unavailable');
        throw learningDesignError('hvl:pdf-unavailable');
      });
      return await this.print(browser, html);
    } finally {
      release();
    }
  }

  /** Closes the shared browser; called once at shutdown. */
  close(): Promise<void> {
    return this.browser.close();
  }

  private async print(browser: Browser, html: string): Promise<Buffer> {
    const context = await browser
      .newContext({ javaScriptEnabled: false, offline: true })
      .catch((error: unknown) => this.unavailable(error));
    let timer: NodeJS.Timeout | undefined;
    const overTime = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('the export took longer than its time limit')),
        this.timeLimitMs,
      );
    });
    try {
      const printing = (async () => {
        // SECURITY: abort every request, so nothing in the document can reach the network or the server (SSRF).
        await context.route('**/*', (route) => route.abort());
        const page = await context.newPage();
        await page.setContent(html, { waitUntil: 'load', timeout: this.timeLimitMs });
        return page.pdf({ format: 'A4', tagged: true, outline: true, printBackground: true });
      })();
      // WHY: a lost race leaves `printing` to reject when the context closes; that rejection is already handled.
      printing.catch(() => undefined);
      return await Promise.race([printing, overTime]);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      return this.unavailable(error);
    } finally {
      clearTimeout(timer);
      // WHY: a browser that hangs may never finish closing the context; waiting at most one time limit for it frees
      // the person's slot and the process's, so a hung export cannot leave every later one answered as busy.
      let closeTimer: NodeJS.Timeout | undefined;
      await Promise.race([
        context.close().catch(() => undefined),
        new Promise<void>((resolve) => (closeTimer = setTimeout(resolve, this.timeLimitMs))),
      ]);
      clearTimeout(closeTimer);
    }
  }

  private unavailable(error: unknown): never {
    this.deps.logger.warn({ reason: firstLine(error) }, 'pdf export failed');
    throw learningDesignError('hvl:pdf-unavailable');
  }
}
