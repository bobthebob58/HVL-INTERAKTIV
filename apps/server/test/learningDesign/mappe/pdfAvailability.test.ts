/**
 * Tests for the PDF export's start-up probe (D-110 amendment of 2026-11-05) with a stand-in browser: it launches with
 * the export's own options, opens one offline page without JavaScript and closes the browser, names the reason when
 * Chromium will not start, gives up on a page that does not open, and logs one line with a reason code and no error
 * text.
 *
 * Spec: MAPPE-004
 */
import type { Browser, LaunchOptions } from 'playwright-core';
import type { Logger } from 'pino';
import { describe, expect, it, vi } from 'vitest';
import {
  checkPdfAvailability,
  launchFailureReason,
  logPdfAvailability,
} from '../../../src/learningDesign/mappe/pdf/pdfAvailability.js';
import { pdfBrowserLaunchOptions } from '../../../src/learningDesign/mappe/pdf/SharedChromium.js';
import { ENV, fakeBrowser } from './pdfFakeBrowser.js';

const failing = (message: string, name = 'Error') => {
  const error = new Error(message);
  error.name = name;
  return vi.fn(async (): Promise<Browser> => Promise.reject(error));
};
const fakeLogger = () => ({ info: vi.fn(), warn: vi.fn() });

describe('[MAPPE-004] the PDF availability probe', () => {
  it('[MAPPE-004] launches exactly as an export does, opens one offline page without JavaScript, and closes the browser', async () => {
    // Arrange
    const fake = fakeBrowser();
    const launch = vi.fn(async (_options: LaunchOptions) => fake.browser);
    // Act
    const found = await checkPdfAvailability({ env: ENV, launch });
    // Assert
    expect(found).toEqual({ available: true, sandbox: true, reason: 'ok' });
    expect(launch).toHaveBeenCalledWith(pdfBrowserLaunchOptions(ENV));
    expect(launch.mock.calls[0]?.[0]).toMatchObject({ chromiumSandbox: true });
    expect(fake.contexts.map((c) => [c.options, c.closed])).toEqual([
      [{ javaScriptEnabled: false, offline: true }, true],
    ]);
    expect(fake.close).toHaveBeenCalledTimes(1);
  });

  it('[MAPPE-004] reports a development run without the sandbox as available but sandbox-off', async () => {
    // Act
    const found = await checkPdfAvailability({
      env: { ...ENV, PDF_ALLOW_NO_SANDBOX: true },
      launch: async () => fakeBrowser().browser,
    });
    // Assert
    expect(found).toEqual({ available: true, sandbox: false, reason: 'sandbox-off' });
  });

  it.each([
    ['[FATAL:zygote_host_impl_linux.cc(128)] No usable sandbox! ...', 'Error', 'no-usable-sandbox'],
    ['[err] Check failed: sys_chroot("/proc/self/fdinfo/") == 0', 'Error', 'no-usable-sandbox'],
    ['Running as root without --no-sandbox is not supported.', 'Error', 'root-without-no-sandbox'],
    ["Executable doesn't exist at /ms-playwright/chromium-1194/chrome-linux/chrome", 'Error', 'no-browser'],
    ['browserType.launch: Timeout 20000ms exceeded.', 'TimeoutError', 'launch-timeout'],
    ['Target page, context or browser has been closed', 'Error', 'launch-failed'],
  ] as const)(
    '[MAPPE-004] names the reason when Chromium will not start: %s',
    async (message, name, reason) => {
      // Act
      const found = await checkPdfAvailability({ env: ENV, launch: failing(message, name) });
      // Assert
      expect(found).toEqual({ available: false, sandbox: true, reason });
      expect(launchFailureReason('not an error')).toBe('launch-failed');
    },
  );

  it('[MAPPE-004] gives up on a page that does not open within the time limit and still closes the browser', async () => {
    // Arrange: a browser that never answers `newContext`.
    const fake = fakeBrowser({ opening: () => new Promise<void>(() => undefined) });
    // Act
    const found = await checkPdfAvailability({
      env: ENV,
      launch: async () => fake.browser,
      pageTimeLimitMs: 20,
    });
    // Assert
    expect(found).toEqual({ available: false, sandbox: true, reason: 'page-failed' });
    expect(fake.close).toHaveBeenCalledTimes(1);
  });

  it('[MAPPE-004] logs one line with the reason code only: info when the sandboxed export works, warn otherwise', async () => {
    // Arrange
    const working = fakeLogger();
    const refused = fakeLogger();
    // Act
    await logPdfAvailability({
      env: ENV,
      launch: async () => fakeBrowser().browser,
      logger: working as unknown as Logger,
    });
    await logPdfAvailability({
      env: ENV,
      launch: failing('No usable sandbox! see /home/hvli/.config/chromium/crash at line 128'),
      logger: refused as unknown as Logger,
    });
    // Assert
    expect(working.info.mock.calls).toEqual([
      [{ pdfAvailable: true, pdfSandbox: true, reason: 'ok' }, 'PDF export availability'],
    ]);
    expect(working.warn).not.toHaveBeenCalled();
    expect(refused.warn.mock.calls).toEqual([
      [{ pdfAvailable: false, pdfSandbox: true, reason: 'no-usable-sandbox' }, 'PDF export availability'],
    ]);
    expect(JSON.stringify(refused.warn.mock.calls)).not.toContain('/home/hvli');
  });

  it('[MAPPE-004] warns when the export works only because the sandbox is off', async () => {
    // Arrange
    const unsandboxed = fakeLogger();
    // Act
    await logPdfAvailability({
      env: { ...ENV, PDF_ALLOW_NO_SANDBOX: true },
      launch: async () => fakeBrowser().browser,
      logger: unsandboxed as unknown as Logger,
    });
    // Assert
    expect(unsandboxed.info).not.toHaveBeenCalled();
    expect(unsandboxed.warn.mock.calls).toEqual([
      [{ pdfAvailable: true, pdfSandbox: false, reason: 'sandbox-off' }, 'PDF export availability'],
    ]);
  });
});
