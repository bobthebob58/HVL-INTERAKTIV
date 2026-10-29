/**
 * Tests for the PDF renderer's rules (D-096 and its probe P4 amendment) with a stand-in browser: the launch options
 * (sandbox, scrubbed environment, explicit executable, no signal handlers), one lazily started shared browser that is
 * started again after a crash, an isolated context per export closed afterwards whose request handler aborts every
 * request, the slots (per process and one per person, 503 `hvl:pdf-busy`), and 503 `hvl:pdf-unavailable` without a
 * browser. The time limit is tested in ./pdfRendererTimeLimit.test.ts.
 *
 * Spec: MAPPE-004
 */
import type { Browser, LaunchOptions } from 'playwright-core';
import { describe, expect, it, vi } from 'vitest';
import { pdfBrowserLaunchOptions } from '../../../src/learningDesign/mappe/pdf/SharedChromium.js';
import { codeOf, ENV, fakeBrowser, PDF, renderer } from './pdfFakeBrowser.js';

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

  it('[MAPPE-004] the export context’s request handler aborts every request and lets none through', async () => {
    // Arrange
    const fake = fakeBrowser();
    const pdf = renderer(async () => fake.browser);
    await pdf.render('<html><img src="http://127.0.0.1/x"></html>', 'kari');
    const route = { abort: vi.fn(), continue: vi.fn(), fallback: vi.fn(), fulfill: vi.fn() };
    // Act
    await fake.contexts[0]?.handlers[0]?.(route);
    // Assert
    expect(fake.contexts[0]?.handlers).toHaveLength(1);
    expect(route.abort).toHaveBeenCalledTimes(1);
    expect([route.continue, route.fallback, route.fulfill].map((call) => call.mock.calls.length)).toEqual([
      0, 0, 0,
    ]);
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
});
