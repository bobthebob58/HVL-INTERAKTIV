/**
 * Browser tests for the player page with H5P Core 1.28 in Chromium: it runs without console errors, the
 * Daylight theme tokens are active and can be overridden (spike step 5), and a content type's state survives a
 * reload (H5P-005). The content type is a synthetic stand-in until the Hub packages arrive (spike step 4, Q7).
 *
 * Spec: H5P-004, H5P-005, H5P-001
 */
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import request from 'supertest';
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
  beforeAll(async () => {
    tb = await openHttpTestbed(LIBRARIES);
    const author = await tb.actor('author');
    learner = await tb.actor('learner');
    const body = {
      library: 'H5P.MultiChoice 1.16',
      params: { params: { question: 'Kva?', answers: ['Ja'] }, metadata: { title: 'Probe', license: 'U' } },
    };
    const res = await request(tb.app)
      .post('/h5p/content')
      .set(...author.header)
      .send(body);
    contentId = (res.body as { contentId: string }).contentId;
    await tb.db.h5PContent.update({
      where: { id: contentId },
      data: { status: 'published', visibility: 'organisation' },
    });
    server = tb.app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 60_000);
  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    await tb.close();
  });

  describeWithBrowser('[H5P-004] player page in Chromium', (browser) => {
    const openPlayer = async () => {
      const page = await browser().newPage();
      await page.setExtraHTTPHeaders({ [learner.header[0]]: learner.header[1] });
      const problems: string[] = [];
      page.on('console', (m) => void (m.type() === 'error' && problems.push(`console: ${m.text()}`)));
      page.on('pageerror', (e) => problems.push(`page: ${e.message}`));
      page.on('response', (r) => void (r.status() >= 400 && problems.push(`${r.status()} ${r.url()}`)));
      await page.goto(`${base}/h5p/play/${contentId}`);
      await page.waitForSelector('.hvl-probe-attached .hvl-probe');
      return { page, problems };
    };

    it('[H5P-004] runs H5P Core 1.28 and attaches the content type without errors or failed requests', async () => {
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

    it('[H5P-005] the learner’s answers are saved and resumed after a reload', async () => {
      const { page } = await openPlayer();
      await page.click('.hvl-probe');
      await page.click('.hvl-probe');
      // WHY: H5P saves state every 5 s (D-037); wait for that save instead of relying on unload handlers.
      const saved = await page.waitForResponse(
        (r) =>
          r.url().includes(`/h5p/contentUserData/${contentId}/state/0`) && r.request().method() === 'POST',
        { timeout: 15_000 },
      );
      expect(saved.status()).toBe(200);
      await page.reload();
      await page.waitForSelector('.hvl-probe-attached .hvl-probe');
      expect(await page.textContent('.hvl-probe')).toBe('2');
      await page.close();
    }, 40_000);
  });
});
