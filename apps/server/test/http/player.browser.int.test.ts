/**
 * Browser tests for the player page with H5P Core 1.28 in Chromium: it runs without console errors, the
 * Daylight theme tokens are active and can be overridden (spike step 5), and a content type's state survives a
 * reload (H5P-005). The content type is a synthetic stand-in until the Hub packages arrive (spike step 4, Q7).
 *
 * Spec: H5P-001, H5P-005, SEC-008
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithBrowser } from '../support/browser.js';
import { closeLoopbackServers, listenOnLoopback } from '../support/loopbackServers.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { describeWithServices } from '../support/services.js';
import {
  COPYRIGHT_FLAGS,
  COPYRIGHT_PARAMS,
  COPYRIGHT_THUMBNAILS,
  RIGHTS_FLAGS,
  RIGHTS_PAYLOAD,
} from '../support/rightsOfUsePayloads.js';
import { PROBE_LIBRARIES } from '../support/probeContentType.js';

describeWithServices('H5P player in a browser', () => {
  let tb: HttpTestbed;
  let base: string;
  let learner: TestActor;
  let contentId: string;
  let rightsId: string;
  let copyrightId: string;
  beforeAll(async () => {
    tb = await openHttpTestbed(PROBE_LIBRARIES);
    const author = await tb.actor('author');
    learner = await tb.actor('learner');
    contentId = await tb.activity(author, { published: true, metadata: { title: 'Probe', license: 'U' } });
    rightsId = await tb.activity(author, { published: true, metadata: RIGHTS_PAYLOAD });
    copyrightId = await tb.activity(author, { published: true, params: COPYRIGHT_PARAMS });
    base = await listenOnLoopback(tb.app);
  }, 60_000);
  afterAll(async () => {
    await closeLoopbackServers();
    await tb.close();
  });

  describeWithBrowser('[H5P-004] player page in Chromium', (browser) => {
    const openPlayer = async (id = contentId) => {
      const page = await browser().newPage();
      await page.setExtraHTTPHeaders({ [learner.header[0]]: learner.header[1] });
      const problems: string[] = [];
      page.on('console', (m) => void (m.type() === 'error' && problems.push(`console: ${m.text()}`)));
      page.on('pageerror', (e) => problems.push(`page: ${e.message}`));
      page.on('response', (r) => void (r.status() >= 400 && problems.push(`${r.status()} ${r.url()}`)));
      await page.goto(`${base}/h5p/play/${id}`);
      await page.waitForSelector('.hvl-probe-attached .hvl-probe');
      return { page, problems };
    };

    it('[H5P-001] runs H5P Core 1.28 and attaches the content type without errors or failed requests', async () => {
      const { page, problems } = await openPlayer();
      expect(problems).toEqual([]);
      expect(
        await page.evaluate(() => typeof (window as unknown as { H5P?: { init?: unknown } }).H5P?.init),
      ).toBe('function');
      await page.close();
    }, 30_000);

    it('[H5P-001] the Daylight theme tokens are active, and a stylesheet after them overrides one (spike step 5)', async () => {
      const { page } = await openPlayer();
      const token = () =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--h5p-theme-main-cta-base').trim(),
        );
      // UD-011: HVL's theme (h5p-daylight.css, loaded after Core's variables) already points Daylight at the tokens.
      expect(await token()).toBe('#004357');
      await page.addStyleTag({ content: ':root { --h5p-theme-main-cta-base: var(--hvl-ink); }' });
      expect(await token()).toBe('#111111');
      await page.close();
    }, 30_000);

    it('[SEC-008] author metadata shown in the "Rights of use" dialog never runs as script', async () => {
      const { page } = await openPlayer(rightsId); // Arrange
      // Act: open the "Rights of use" dialog and give any injected handler time to fire
      await page.click('.h5p-copyrights button');
      await page.waitForSelector('.h5p-popup-dialog', { state: 'visible' });
      await page.waitForTimeout(300);
      // Assert: no payload set its flag
      const fired = await page.evaluate((flags) => flags.filter((flag) => flag in window), RIGHTS_FLAGS);
      expect(fired).toEqual([]);
      await page.close();
    }, 30_000);

    it('[SEC-008] copyright data, source links and alt texts under any key never run as script in that dialog', async () => {
      const { page } = await openPlayer(copyrightId); // Arrange
      // Act: open the "Rights of use" dialog, hover every link, and give any injected handler time to fire
      await page.click('.h5p-copyrights button');
      await page.waitForSelector('.h5p-popup-dialog', { state: 'visible' });
      await page.$$eval('.h5p-popup-dialog a', (links) =>
        links.forEach((a) => a.dispatchEvent(new MouseEvent('mouseover'))),
      );
      await page.waitForTimeout(300);
      // Assert: no flag, event-handler attribute or script link in the dialog; the safe images still show
      const result = await page.evaluate((flags) => {
        const inDialog = [...document.querySelectorAll('.h5p-popup-dialog *')];
        return {
          fired: flags.filter((flag) => flag in window),
          handlers: inDialog.filter((el) => [...el.attributes].some((a) => a.name.startsWith('on'))).length,
          scriptLinks: document.querySelectorAll('.h5p-popup-dialog a[href^="javascript"]').length,
          thumbnails: document.querySelectorAll('.h5p-popup-dialog img.h5p-thumbnail').length,
        };
      }, COPYRIGHT_FLAGS);
      expect(result).toEqual({ fired: [], handlers: 0, scriptLinks: 0, thumbnails: COPYRIGHT_THUMBNAILS });
      await page.close();
    }, 30_000);

    it('[H5P-005] the learner’s answers are saved and resumed after a reload', async () => {
      const { page } = await openPlayer(); // Arrange
      // Act and assert: two answers are saved
      await page.click('.hvl-probe');
      await page.click('.hvl-probe');
      // WHY: H5P saves state every 5 s (D-037); wait for that save instead of relying on unload handlers.
      const saved = await page.waitForResponse(
        (r) =>
          r.url().includes(`/h5p/contentUserData/${contentId}/state/0`) && r.request().method() === 'POST',
        { timeout: 15_000 },
      );
      expect(saved.status()).toBe(200);
      // Act and assert: a reload resumes them
      await page.reload();
      await page.waitForSelector('.hvl-probe-attached .hvl-probe');
      expect(await page.textContent('.hvl-probe')).toBe('2');
      await page.close();
    }, 40_000);
  });
});
