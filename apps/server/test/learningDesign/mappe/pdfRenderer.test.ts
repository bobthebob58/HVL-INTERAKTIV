/**
 * Tests for the PDF renderer's rules (D-096 and its probe P4 amendment) with a stand-in browser: the launch options
 * (sandbox, scrubbed environment, explicit executable, no signal handlers), one lazily started shared browser that is
 * started again after a crash, an isolated context per export closed afterwards, the slots (per process and one per
 * person, 503 `hvl:pdf-busy`), and 503 `hvl:pdf-unavailable` without a browser or past the time limit.
 *
 * Spec: MAPPE-004
 */
import type { Browser, LaunchOptions } from 'playwright-core';
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../../src/http/HttpError.js';
import { pdfBrowserLaunchOptions } from '../../../src/learningDesign/mappe/pdf/SharedChromium.js';
import { PdfRenderer } from '../../../src/learningDesign/mappe/pdf/PdfRenderer.js';
import { createLogger } from '../../../src/logging/logger.js';

const PDF = Buffer.from('%PDF-1.4 stand-in');

/** A stand-in browser that records what the renderer asks of it. */
function fakeBrowser(options: { readonly print?: () => Promise<Buffer>; readonly hang?: boolean } = {}) {
  const contexts: { options: unknown; routes: string[]; closed: boolean; pdfOptions?: unknown }[] = [];
  let disconnect: () => void = () => undefined;
  const browser = {
    on: (event: string, listener: () => void) => {
      if (event === 'disconnected') disconnect = listener;
    },
    close: vi.fn(async () => disconnect()),
    newContext: async (contextOptions: unknown) => {
      const record: (typeof contexts)[number] = { options: contextOptions, routes: [], closed: false };
      contexts.push(record);
      return {
        route: async (pattern: string) => void record.routes.push(pattern),
        newPage: async () => ({
          setContent: async () => undefined,
          pdf: async (pdfOptions: unknown) => {
            record.pdfOptions = pdfOptions;
            return options.print ? options.print() : PDF;
          },
        }),
        // WHY: `hang` stands for a browser that never finishes closing the context.
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

const ENV = {
  PDF_ALLOW_NO_SANDBOX: false,
  PDF_MAX_CONCURRENCY: 2,
  PDF_BROWSER_EXECUTABLE: '/usr/bin/chromium',
};

const renderer = (launch: (options: LaunchOptions) => Promise<Browser>, extra: object = {}) =>
  new PdfRenderer({ env: ENV, logger: createLogger({ level: 'silent' }), launch, ...extra });

const codeOf = (error: unknown) =>
  error instanceof HttpError ? `${error.status} ${error.errorCode}` : String(error);

describe('[MAPPE-004] the PDF renderer', () => {
  it('[MAPPE-004] launches Chromium with the sandbox, only PATH and HOME, an explicit executable and no signal handlers', () => {
    // Act
    const options = pdfBrowserLaunchOptions(ENV, {
      PATH: '/bin',
      HOME: '/home/hvli',
      DATABASE_URL: 'postgresql://secret',
    });
    const rootDevelopment = pdfBrowserLaunchOptions({ ...ENV, PDF_ALLOW_NO_SANDBOX: true }, {});
    // Assert
    expect(options).toEqual({
      chromiumSandbox: true,
      env: { PATH: '/bin', HOME: '/home/hvli' },
      executablePath: '/usr/bin/chromium',
      timeout: 20_000,
      handleSIGINT: false,
      handleSIGTERM: false,
      handleSIGHUP: false,
    });
    expect(rootDevelopment).toMatchObject({ chromiumSandbox: false, env: { PATH: '', HOME: '' } });
  });

  it('[MAPPE-004] starts one shared browser on the first export and prints each export in a fresh, closed context', async () => {
    // Arrange
    const fake = fakeBrowser();
    const launch = vi.fn(async () => fake.browser);
    const pdf = renderer(launch);
    // Act
    const launchedBefore = launch.mock.calls.length;
    const files = await Promise.all([
      pdf.render('<html></html>', 'kari'),
      pdf.render('<html></html>', 'ola'),
    ]);
    // Assert
    expect([launchedBefore, launch.mock.calls.length]).toEqual([0, 1]);
    expect(files).toEqual([PDF, PDF]);
    expect(fake.contexts).toEqual([
      expect.objectContaining({
        options: { javaScriptEnabled: false, offline: true },
        routes: ['**/*'],
        closed: true,
      }),
      expect.objectContaining({
        options: { javaScriptEnabled: false, offline: true },
        routes: ['**/*'],
        closed: true,
      }),
    ]);
    expect(fake.contexts[0]?.pdfOptions).toEqual({
      format: 'A4',
      tagged: true,
      outline: true,
      printBackground: true,
    });
  });

  it('[MAPPE-004] answers 503 hvl:pdf-busy for a second export of the same person and when every slot is taken', async () => {
    // Arrange
    let finish: (pdf: Buffer) => void = () => undefined;
    let prints = 0;
    // WHY: the first print waits until the test lets it finish; later ones print at once.
    const fake = fakeBrowser({
      print: () =>
        prints++ === 0 ? new Promise<Buffer>((resolve) => (finish = resolve)) : Promise.resolve(PDF),
    });
    const pdf = renderer(async () => fake.browser, { env: { ...ENV, PDF_MAX_CONCURRENCY: 1 } });
    // Act
    const first = pdf.render('<html></html>', 'kari');
    await vi.waitFor(() => expect(fake.contexts[0]?.routes).toEqual(['**/*']));
    const samePerson = await pdf.render('<html></html>', 'kari').catch(codeOf);
    const otherPerson = await pdf.render('<html></html>', 'ola').catch(codeOf);
    finish(PDF);
    await first;
    // Assert
    expect([samePerson, otherPerson]).toEqual(['503 hvl:pdf-busy', '503 hvl:pdf-busy']);
    await expect(pdf.render('<html></html>', 'ola')).resolves.toBe(PDF);
  });

  it('[MAPPE-004] answers 503 hvl:pdf-unavailable without a browser, and tries again on the next export', async () => {
    // Arrange
    const fake = fakeBrowser();
    const launch = vi
      .fn<(options: LaunchOptions) => Promise<Browser>>()
      .mockRejectedValueOnce(new Error("browserType.launch: Executable doesn't exist"))
      .mockResolvedValue(fake.browser);
    const pdf = renderer(launch);
    // Act
    const missing = await pdf.render('<html></html>', 'kari').catch(codeOf);
    const later = await pdf.render('<html></html>', 'kari');
    // Assert
    expect(missing).toBe('503 hvl:pdf-unavailable');
    expect(later).toBe(PDF);
    expect(launch).toHaveBeenCalledTimes(2);
  });

  it('[MAPPE-004] starts a new browser after the shared one crashed, and none after close', async () => {
    // Arrange
    const fakes = [fakeBrowser(), fakeBrowser()];
    const launch = vi.fn(async () => (fakes[launch.mock.calls.length - 1] ?? fakes[1]!).browser);
    const pdf = renderer(launch);
    await pdf.render('<html></html>', 'kari');
    // Act
    fakes[0]?.crash();
    await pdf.render('<html></html>', 'kari');
    await pdf.close();
    const afterClose = await pdf.render('<html></html>', 'kari').catch(codeOf);
    // Assert
    expect(launch).toHaveBeenCalledTimes(2);
    expect(fakes[1]?.close).toHaveBeenCalledTimes(1);
    expect(afterClose).toBe('503 hvl:pdf-unavailable');
  });

  it('[MAPPE-004] answers 503 hvl:pdf-unavailable past the time limit, and frees the slot even if the close hangs', async () => {
    // Arrange
    const fake = fakeBrowser({ print: () => new Promise<Buffer>(() => undefined), hang: true });
    const pdf = renderer(async () => fake.browser, { timeLimitMs: 50 });
    // Act
    const answer = await pdf.render('<html></html>', 'kari').catch(codeOf);
    // Assert: the same person's next export is not busy, so the hung export's slot is free again
    expect(answer).toBe('503 hvl:pdf-unavailable');
    expect(fake.contexts[0]?.closed).toBe(true);
    await expect(pdf.render('<html></html>', 'kari').catch(codeOf)).resolves.toBe('503 hvl:pdf-unavailable');
  });
});
