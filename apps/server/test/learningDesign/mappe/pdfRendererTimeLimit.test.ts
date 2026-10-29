/**
 * Tests for the PDF renderer's time limit (D-096 W6a and S5 review amendments) with a stand-in browser that stalls:
 * one limit covers opening the context and printing, so a browser that never opens a context still gets an answer
 * (503 `hvl:pdf-unavailable`) and frees both slots; a context that opens late is closed; a browser that does not
 * open or close a context in time is replaced on the next export; and an export that is only slow to print keeps it.
 *
 * Spec: MAPPE-004
 */
import type { Browser, LaunchOptions } from 'playwright-core';
import { describe, expect, it, vi } from 'vitest';
import { codeOf, ENV, fakeBrowser, PDF, renderer } from './pdfFakeBrowser.js';

/** Settles to the PDF's length, the error's code, or `still pending` after `ms`, so a hang fails fast. */
const answerWithin = (rendering: Promise<Buffer>, ms = 2_000): Promise<string> =>
  Promise.race([
    rendering.then((pdf) => `pdf ${pdf.length}`, codeOf),
    new Promise<string>((resolve) => setTimeout(() => resolve('still pending'), ms)),
  ]);

/** Launches `first` once and `then` every time after. */
const launchesInTurn = (first: Browser, then: Browser) => {
  let launches = 0;
  return vi.fn<(options: LaunchOptions) => Promise<Browser>>(async () => (++launches === 1 ? first : then));
};

const NEVER = () => new Promise<never>(() => undefined);

describe('[MAPPE-004] the PDF renderer’s time limit', () => {
  it('[MAPPE-004] answers 503 hvl:pdf-unavailable when the browser never opens a context, frees both slots and replaces it', async () => {
    // Arrange
    const stalled = fakeBrowser({ opening: NEVER });
    const healthy = fakeBrowser();
    const launch = launchesInTurn(stalled.browser, healthy.browser);
    const pdf = renderer(launch, { timeLimitMs: 50, env: { ...ENV, PDF_MAX_CONCURRENCY: 1 } });
    // Act
    const stalledAnswer = await answerWithin(pdf.render('<html></html>', 'kari'));
    const otherPerson = await answerWithin(pdf.render('<html></html>', 'ola'));
    // Assert
    expect(stalledAnswer).toBe('503 hvl:pdf-unavailable');
    expect(otherPerson).toBe(`pdf ${PDF.length}`);
    expect(launch).toHaveBeenCalledTimes(2);
    expect(stalled.close).toHaveBeenCalledTimes(1);
  });

  it('[MAPPE-004] closes a context that opens only after the time limit', async () => {
    // Arrange
    let open: () => void = () => undefined;
    const late = fakeBrowser({ opening: () => new Promise<void>((resolve) => (open = resolve)) });
    const pdf = renderer(async () => late.browser, { timeLimitMs: 50 });
    // Act
    const answer = await answerWithin(pdf.render('<html></html>', 'kari'));
    open();
    // Assert
    expect(answer).toBe('503 hvl:pdf-unavailable');
    await vi.waitFor(() => expect(late.contexts).toEqual([expect.objectContaining({ closed: true })]));
    expect(late.contexts[0]?.routes).toEqual([]);
  });

  it('[MAPPE-004] answers 503 hvl:pdf-unavailable past the limit, frees the slot even if the close hangs, and replaces that browser', async () => {
    // Arrange
    const hung = fakeBrowser({ print: NEVER, hang: true });
    const healthy = fakeBrowser();
    const launch = launchesInTurn(hung.browser, healthy.browser);
    const pdf = renderer(launch, { timeLimitMs: 50 });
    // Act
    const answer = await answerWithin(pdf.render('<html></html>', 'kari'));
    // Assert: the same person's next export is not busy, so the hung export's slot is free, and a new browser prints
    expect(answer).toBe('503 hvl:pdf-unavailable');
    expect(hung.contexts[0]?.closed).toBe(true);
    expect(await answerWithin(pdf.render('<html></html>', 'kari'))).toBe(`pdf ${PDF.length}`);
    expect(launch).toHaveBeenCalledTimes(2);
    expect(hung.close).toHaveBeenCalledTimes(1);
  });

  it('[MAPPE-004] keeps the browser after an export that is only slow to print, so other exports go on', async () => {
    // Arrange
    let prints = 0;
    const fake = fakeBrowser({ print: () => (prints++ === 0 ? NEVER() : Promise.resolve(PDF)) });
    const launch = vi.fn(async () => fake.browser);
    const pdf = renderer(launch, { timeLimitMs: 50 });
    // Act
    const slow = await answerWithin(pdf.render('<html></html>', 'kari'));
    const next = await answerWithin(pdf.render('<html></html>', 'kari'));
    // Assert
    expect([slow, next]).toEqual(['503 hvl:pdf-unavailable', `pdf ${PDF.length}`]);
    expect(launch).toHaveBeenCalledTimes(1);
    expect(fake.close).not.toHaveBeenCalled();
  });
});
