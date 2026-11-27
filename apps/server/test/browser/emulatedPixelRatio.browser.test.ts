/**
 * Browser tests of how the pinned full Chromium lays out a frame from another site when a test asks for a phone's
 * device pixel ratio. The tool sits in Canvas as such a frame, and the phone journey (e2e/journeyPhoneResume)
 * measures its width at 320 CSS pixels. Under an emulated ratio of 2, Chromium 159's full build tells the frame the
 * ratio and lays it out at half its width; Chromium 141 never told the frame the ratio at all. A real phone has a
 * real ratio and is not affected. So the journey emulates the phone at ratio 1, where the frame is as wide as its
 * place in the page, and the pin fails the day the browser lays the frame out right (D-149).
 *
 * Spec: UD-008
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Browser, BrowserContextOptions } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithFullChromium } from '../support/fullChromium.js';

/** The frame's place in the outer page, in CSS pixels. */
const PLACE = { width: 300, height: 400 };
const VIEWPORT = { width: 320, height: 640 };
const HEAD = '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">';

/** A site that answers `/outer?child=…` with a page framing the child, and anything else with an empty page. */
function startSite(host: string): Promise<{ server: Server; origin: string }> {
  const server = createServer((request, response) => {
    const child = new URL(request.url ?? '/', 'http://site').searchParams.get('child');
    response.setHeader('content-type', 'text/html; charset=utf-8');
    response.end(
      child === null
        ? `${HEAD}<title>inner</title>`
        : `${HEAD}<title>outer</title><body style="margin:0"><iframe title="inner" src="${encodeURI(child)}"
            style="width:${PLACE.width}px;height:${PLACE.height}px;border:0"></iframe>`,
    );
  });
  return new Promise((resolve) => {
    server.listen(0, host, () => {
      resolve({ server, origin: `http://${host}:${(server.address() as AddressInfo).port}` });
    });
  });
}

describeWithFullChromium('[UD-008] an emulated phone and a frame from another site', (browser) => {
  let page: Awaited<ReturnType<typeof startSite>>;
  let other: Awaited<ReturnType<typeof startSite>>;
  beforeAll(async () => {
    // WHY: 127.0.0.1 and localhost are two sites to the browser, as Canvas and the tool are.
    [page, other] = await Promise.all([startSite('127.0.0.1'), startSite('localhost')]);
  });
  afterAll(() => {
    page?.server.close();
    other?.server.close();
  });

  /** Opens the outer page with the inner one framed, and reads the frame's own width and pixel ratio. */
  async function framed(running: Browser, options: BrowserContextOptions, inner: string) {
    const context = await running.newContext({ viewport: VIEWPORT, ...options });
    try {
      const outer = await context.newPage();
      await outer.goto(`${page.origin}/outer?child=${encodeURIComponent(`${inner}/inner`)}`);
      const frame = outer.frames().find((candidate) => candidate !== outer.mainFrame());
      if (!frame) throw new Error('the outer page has no frame');
      await frame.waitForLoadState('load');
      return await frame.evaluate(() => ({ width: window.innerWidth, ratio: window.devicePixelRatio }));
    } finally {
      await context.close();
    }
  }

  it('[UD-008] at pixel ratio 1, a phone’s frame from another site is as wide as its place in the page', async () => {
    // Arrange: the phone as the journey test emulates it
    const phone = { isMobile: true, hasTouch: true };
    // Act
    const crossSite = await framed(browser(), phone, other.origin);
    const sameSite = await framed(browser(), phone, page.origin);
    // Assert
    expect(crossSite).toEqual({ width: PLACE.width, ratio: 1 });
    expect(sameSite).toEqual({ width: PLACE.width, ratio: 1 });
  });

  it('upstream pin: at an emulated pixel ratio of 2, full Chromium lays a frame from another site out at half its width', async () => {
    // Arrange
    const phone = { isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
    // Act
    const crossSite = await framed(browser(), phone, other.origin);
    const sameSite = await framed(browser(), phone, page.origin);
    // Assert: only the frame from the other site is halved; when this fails, the journey can emulate ratio 2 again
    expect(crossSite).toEqual({ width: PLACE.width / 2, ratio: 2 });
    expect(sameSite).toEqual({ width: PLACE.width, ratio: 2 });
  });
});
