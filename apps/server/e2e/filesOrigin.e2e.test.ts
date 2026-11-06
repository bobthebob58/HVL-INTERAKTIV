/**
 * End-to-end test of the files origin in full Chromium with third-party cookies blocked, on the built web app and the
 * real content types: the player in the mock Canvas shows ImageHotspots' image and InteractiveVideo's video with its
 * captions from the files origin; no cookie, ltik, `Authorization` or Referer reaches it, even with a portal session
 * open; and a crafted SVG from it never runs script, as an image, opened directly (a download) or even with the
 * download header stripped (D-110 amendment of 2026-11-05).
 *
 * Spec: SEC-004, DATA-011, H5P-004, LTI-003
 */
import type { Browser, Frame, Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { CANVAS_USERS } from '../../../tools/mock-platform/mockPlatform.mjs';
import { openActivityTab } from '../a11y/support/pages.js';
import {
  signedPath,
  storeUserFiles,
  STORED,
  SVG_SCRIPT_MARKER,
} from '../test/support/filesOriginFixtures.js';
import { openRealWebApp, type RealWebApp } from '../test/support/realWebApp.js';
import { describeWithRealWebApp } from '../test/support/realWebAppPrerequisites.js';
import { launchCookieTestChromium } from '../test/support/thirdPartyCookies.js';
import { frameAt } from './support/portalFrames.js';
import { consoleOf, requestsTo, servedWithout, type SentRequest } from './support/filesOriginPages.js';

describeWithRealWebApp('[SEC-004] the player’s files from the files origin, in Chromium', () => {
  let browser: Browser;
  let app: RealWebApp;
  let hotspots: string;
  let video: string;
  beforeAll(async () => {
    browser = await launchCookieTestChromium();
    app = await openRealWebApp(browser);
    hotspots = app.ids.get('H5P.ImageHotspots') ?? '';
    video = app.ids.get('H5P.InteractiveVideo') ?? '';
    await storeUserFiles(app.tb, hotspots);
  }, 240_000);
  afterAll(async () => {
    await app?.close();
    await browser?.close();
  });

  /** Opens the activity from a mock Canvas course page as a student and returns the player's frame. */
  const playInCanvas = async (page: Page, contentId: string): Promise<Frame> => {
    await page.goto(
      app.tb.mock.canvas.coursePageUrl({
        user: CANVAS_USERS.student,
        custom: { contentId },
        resourceLinkId: `e2e-files-origin-${contentId}`,
        // WHY: this Chromium blocks frame storage too, so the launch keeps its state through Platform Storage (D-065).
        platformStorage: true,
      }),
    );
    const player = await frameAt(page, '/lti/play');
    await player.waitForFunction(
      () => (window as unknown as { H5P?: { instances?: unknown[] } }).H5P?.instances?.length,
      undefined,
      { timeout: 30_000 },
    );
    return player;
  };
  const expectNoCredentials = (sent: SentRequest[]) => {
    expect(sent.length).toBeGreaterThan(0);
    for (const { url, headers } of sent) {
      expect(url).toMatch(new RegExp(`^${app.filesBase.replace(/\./g, '\\.')}/h5p/files/`));
      expect(url).not.toMatch(/ltik|csrf/i);
      for (const name of ['cookie', 'authorization', 'referer'])
        expect(headers[name], `${name} on ${url}`).toBeUndefined();
    }
  };

  it('[SEC-004] the Canvas player shows ImageHotspots’ image and InteractiveVideo’s captions from the files origin', async () => {
    // Arrange
    const context = await browser.newContext();
    const sent = requestsTo(context, app.filesBase);
    const appFiles = requestsTo(context, `${app.base}/h5p/files`);
    const page = await context.newPage();
    // Act: the image, drawn
    const imagePlayer = await playInCanvas(page, hotspots);
    const imageSrc = await imagePlayer.waitForFunction(() => {
      const image = document.querySelector<HTMLImageElement>('img.h5p-image-hotspots-background');
      return image?.complete && image.naturalWidth > 0 ? image.currentSrc : false;
    });
    // Act: the video, its metadata and its caption cues, which load only in CORS mode from another origin
    const videoPlayer = await playInCanvas(page, video);
    const media = await videoPlayer.waitForFunction(
      () => {
        const element = document.querySelector('video');
        if (!element) return false;
        element.muted = true;
        void element.play().catch(() => undefined);
        const cues = element.textTracks[0]?.cues?.length ?? 0;
        return element.readyState >= 1 && cues > 0
          ? { src: element.currentSrc, crossOrigin: element.crossOrigin, cues }
          : false;
      },
      undefined,
      { timeout: 30_000, polling: 250 },
    );
    // Assert
    const played = (await media.jsonValue()) as { src: string; crossOrigin: string | null; cues: number };
    expect(String(await imageSrc.jsonValue())).toContain(`${app.filesBase}/h5p/files/`);
    expect(played.src).toContain(`${app.filesBase}/h5p/files/`);
    expect(played.crossOrigin).toBe('anonymous');
    expectNoCredentials(await sent());
    expect(await appFiles()).toEqual([]);
    await context.close();
  });

  it('[SEC-004] with a portal session open, the app gets its cookie and the files origin none', async () => {
    // Arrange
    const context = await browser.newContext({ storageState: app.authorStorage });
    const sent = requestsTo(context, app.filesBase);
    const appRequests = requestsTo(context, app.base);
    // Act
    const page = await openActivityTab(context, app.base, hotspots, 'play');
    await page.waitForLoadState('networkidle');
    // Assert: the session cookie is there for the app, so its absence on the files origin is the browser's doing
    expect((await appRequests()).some(({ headers }) => /__Host-hvli_/.test(headers.cookie ?? ''))).toBe(true);
    expectNoCredentials(await sent());
    await context.close();
  });

  it('[SEC-004] an SVG from the files origin never runs script: as an image, opened, or without its download header', async () => {
    // Arrange
    const svgUrl = `${app.filesBase}${signedPath(app.tb.runtime.fileGrants, '/h5p/files', hotspots, STORED.svg)}`;
    const context = await browser.newContext();
    const page = await context.newPage();
    const messages = consoleOf(page);
    // Act 1: as an image in the player, which the page's policy allows
    const player = await playInCanvas(page, hotspots);
    const width = await player.evaluate(
      (url) =>
        new Promise<number>((resolve) => {
          const image = new Image();
          image.onload = () => resolve(image.naturalWidth);
          image.onerror = () => resolve(-1);
          image.src = url;
          document.body.append(image);
        }),
      svgUrl,
    );
    // Act 2: opened on its own, which downloads it
    const opened = await context.newPage();
    const download = opened.waitForEvent('download');
    await opened.goto(svgUrl).catch(() => undefined);
    const filename = (await download).suggestedFilename();
    // Act 3: shown as a document, as if a proxy dropped `Content-Disposition`; the sandbox policy still holds
    const shown = await context.newPage();
    const shownMessages = consoleOf(shown);
    await servedWithout(context, app.tb, svgUrl, ['content-disposition']);
    await shown.goto(svgUrl);
    await shown.waitForTimeout(500);
    // Control: without the policy too, the same document does run its script, so the check above can see one
    const control = await browser.newContext();
    const controlPage = await control.newPage();
    const controlMessages = consoleOf(controlPage);
    await servedWithout(control, app.tb, svgUrl, ['content-disposition', 'content-security-policy']);
    await controlPage.goto(svgUrl);
    await expect.poll(() => controlMessages.includes(SVG_SCRIPT_MARKER), { timeout: 5_000 }).toBe(true);
    // Assert
    expect(width).toBe(40);
    expect(filename).toBe('teikning.svg');
    expect(messages).not.toContain(SVG_SCRIPT_MARKER);
    expect(shownMessages).not.toContain(SVG_SCRIPT_MARKER);
    await control.close();
    await context.close();
  });
});
