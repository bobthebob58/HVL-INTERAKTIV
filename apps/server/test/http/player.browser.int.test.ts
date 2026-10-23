/**
 * Browser tests for the player page with H5P Core 1.28 in Chromium: it runs without console errors, the
 * Daylight theme tokens are active and can be overridden (spike step 5), and a content type's state survives a
 * reload (H5P-005). The content type is a synthetic stand-in until the Hub packages arrive (spike step 4, Q7).
 *
 * Spec: H5P-001, H5P-005, SEC-008
 */
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithBrowser } from '../support/browser.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { describeWithServices } from '../support/services.js';
import { HTTP_TEST_LIBRARIES, MULTI_CHOICE } from '../support/tenTypeLibraries.js';

/** A minimal content type: one button that counts clicks and reports the count as its state. */
const PROBE_JS = `H5P.MultiChoice = (function ($) {
  function Probe(params, contentId, extras) {
    H5P.EventDispatcher.call(this);
    var state = (extras && extras.previousState) || { clicks: 0 };
    this.getCurrentState = function () { return state; };
    this.attach = function ($container) {
      var $button = $('<button type="button" class="hvl-probe"></button>').text(String(state.clicks));
      $button.on('click', function () { state.clicks += 1; $button.text(String(state.clicks)); });
      $container.addClass('hvl-probe-attached').append($button);
    };
  }
  Probe.prototype = Object.create(H5P.EventDispatcher.prototype);
  Probe.prototype.constructor = Probe;
  return Probe;
})(H5P.jQuery);`;

/** Metadata an author could send, each field trying to run script in H5P's "Rights of use" dialog. */
const RIGHTS_PAYLOAD = {
  title: 'Rettar',
  license: 'CC BY',
  licenseVersion: '4.0',
  source: 'https://x.example/"><img src=x onerror="window.__hvlSource=1">',
  licenseExtras: '<img src=x onerror="window.__hvlExtras=1">',
  yearFrom: '<img src=x onerror="window.__hvlYear=1">',
  contentType: 'Quiz<img src=x onerror="window.__hvlType=1">',
  authors: [{ name: 'Ola<img src=x onerror="window.__hvlAuthor=1">', role: 'Author' }],
};

/** Copyright data under keys no semantics field defines; h5p.js `findCopyrights` still renders all of it. */
const COPYRIGHT_PARAMS = {
  question: 'Kva?',
  media: {
    path: 'images/a.png',
    mime: 'image/png',
    copyright: {
      license: 'CC BY',
      title: '<img src=x onerror="window.__hvlMedia=1">',
      source: 'javascript:1',
    },
  },
  hidden: {
    file: {
      path: 'images/b.png',
      mime: 'image/png',
      copyright: { license: 'CC BY', author: '<img src=x onerror="window.__hvlHidden=1">' },
    },
  },
  picture: {
    params: {
      contentName: 'Image',
      file: { path: 'images/c.png', width: 4, height: 4 },
      alt: 'x" onerror="window.__hvlAlt=1',
    },
    metadata: {
      license: 'CC BY',
      title: 'Bilete',
      licenseExtras: '<img src=x onerror="window.__hvlSubMeta=1">',
    },
  },
};

const LIBRARIES = HTTP_TEST_LIBRARIES.map((lib) =>
  lib.machineName === MULTI_CHOICE.machineName
    ? { ...lib, files: { ...lib.files, 'js/main.js': PROBE_JS } }
    : lib,
);

describeWithServices('H5P player in a browser', () => {
  let tb: HttpTestbed;
  let server: Server;
  let base: string;
  let learner: TestActor;
  let contentId: string;
  let rightsId: string;
  let copyrightId: string;
  beforeAll(async () => {
    tb = await openHttpTestbed(LIBRARIES);
    const author = await tb.actor('author');
    learner = await tb.actor('learner');
    contentId = await tb.activity(author, { published: true, metadata: { title: 'Probe', license: 'U' } });
    rightsId = await tb.activity(author, { published: true, metadata: RIGHTS_PAYLOAD });
    copyrightId = await tb.activity(author, { published: true, params: COPYRIGHT_PARAMS });
    server = tb.app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 60_000);
  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
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
      expect((await token()).toUpperCase()).toBe('#006FBF');
      await page.addStyleTag({ content: ':root { --h5p-theme-main-cta-base: #004357; }' });
      expect(await token()).toBe('#004357');
      await page.close();
    }, 30_000);

    it('[SEC-008] author metadata shown in the "Rights of use" dialog never runs as script', async () => {
      const { page } = await openPlayer(rightsId); // Arrange
      // Act: open the "Rights of use" dialog and give any injected handler time to fire
      await page.click('.h5p-copyrights button');
      await page.waitForSelector('.h5p-popup-dialog', { state: 'visible' });
      await page.waitForTimeout(300);
      // Assert: no payload set its flag
      const fired = await page.evaluate(() =>
        ['__hvlSource', '__hvlExtras', '__hvlYear', '__hvlType', '__hvlAuthor'].filter(
          (flag) => flag in window,
        ),
      );
      expect(fired).toEqual([]);
      await page.close();
    }, 30_000);

    it('[SEC-008] copyright data, image paths and alt texts under any key never run as script in that dialog', async () => {
      const { page } = await openPlayer(copyrightId); // Arrange
      // Act: open the "Rights of use" dialog and give any injected handler time to fire
      await page.click('.h5p-copyrights button');
      await page.waitForSelector('.h5p-popup-dialog', { state: 'visible' });
      await page.waitForTimeout(300);
      // Assert: no flag, handler or script link in the dialog, and the one safe image still shows
      const result = await page.evaluate(() => ({
        fired: ['__hvlMedia', '__hvlHidden', '__hvlAlt', '__hvlSubMeta'].filter((flag) => flag in window),
        handlers: document.querySelectorAll('.h5p-popup-dialog [onerror]').length,
        scriptLinks: document.querySelectorAll('.h5p-popup-dialog a[href^="javascript"]').length,
        thumbnails: document.querySelectorAll('.h5p-popup-dialog img.h5p-thumbnail').length,
      }));
      expect(result).toEqual({ fired: [], handlers: 0, scriptLinks: 0, thumbnails: 1 });
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
