/**
 * Browser test for the H5P page policy with a Panopto source in the real InteractiveVideo (H5P.Video 1.6): Panopto's
 * embed API loads when HVL has configured a Panopto site, and is refused by the policy when it has not; any other
 * script on Panopto's developer origin stays refused. Every outside request is intercepted (`page.route`), so no
 * real network is used; the embed API is a stub that records which Panopto server H5P.Video asked for.
 *
 * Spec: DATA-011, H5P-009
 */
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import type { Page } from 'playwright-core';
import { afterAll, afterEach, beforeAll, expect, it } from 'vitest';
import { createH5pRouter } from '../../src/http/createH5pRouter.js';
import { PANOPTO_EMBED_API_URL } from '../../src/http/h5pPageCsp.js';
import { describeWithBrowser } from '../support/browser.js';
import { closeLoopbackServers, listenOnLoopback } from '../support/loopbackServers.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { describeWithRealPackages, packageExamples, REAL_PACKAGES_DIR } from '../support/realPackages.js';
import { describeWithServices } from '../support/services.js';

const PACKAGE = 'H5P.InteractiveVideo.h5p';
const PANOPTO_SITE = 'https://hvl.cloud.panopto.eu';
const PANOPTO_VIDEO = `${PANOPTO_SITE}/Panopto/Pages/Viewer.aspx?id=8c1c6f3e-5b1a-4c0e-9d3e-000000000001`;
const PANOPTO_DEVELOPERS = new URL(PANOPTO_EMBED_API_URL).origin;
/** Another script on the embed API's origin, which the path source must not allow. */
const OTHER_PANOPTO_SCRIPT = `${PANOPTO_DEVELOPERS}/scripts/v1.2.1/embedapi.min.js`;
/** What the stub embed API records: the server and session H5P.Video passed to `new EmbedApi(…)`. */
const EMBED_API_STUB = `window.EmbedApi = function (id, options) {
  window.hvliPanoptoEmbed = { serverName: options.serverName, sessionId: options.sessionId };
};
window.onPanoptoEmbedApiReady();`;

/** A seed folder with only the InteractiveVideo package, so the testbed installs its libraries alone. */
function interactiveVideoSeedFolder(): string {
  const dir = mkdtempSync(join(tmpdir(), 'hvli-panopto-'));
  copyFileSync(join(REAL_PACKAGES_DIR, PACKAGE), join(dir, PACKAGE));
  const sums = readFileSync(join(REAL_PACKAGES_DIR, 'SHA256SUMS'), 'utf8').split('\n');
  writeFileSync(join(dir, 'SHA256SUMS'), `${sums.find((line) => line.endsWith(`  ${PACKAGE}`))}\n`);
  return dir;
}

/** The example's parameters with its local clip replaced by a Panopto viewer link (and no local text track). */
function withPanoptoVideo(params: object): object {
  const copy = structuredClone(params) as { interactiveVideo: { video: Record<string, unknown> } };
  copy.interactiveVideo.video.files = [{ path: PANOPTO_VIDEO, mime: 'video/Panopto' }];
  delete copy.interactiveVideo.video.textTracks;
  return copy;
}

describeWithServices('H5P page policy with a Panopto video', () => {
  describeWithRealPackages('[DATA-011] Panopto in H5P.Video', () => {
    let seedDir: string;
    let tb: HttpTestbed;
    let learner: TestActor;
    let contentId: string;
    const bases = { configured: '', unconfigured: '' };

    /** The H5P router of the testbed, with the given `EXTERNAL_MEDIA_ORIGINS`, signed in as the learner. */
    const listenWith = async (externalMediaOrigins: string[]): Promise<string> => {
      const app = express();
      const deps = { ...tb.runtime, pageCsp: { ...tb.runtime.pageCsp, externalMediaOrigins } };
      app.use(
        '/h5p',
        createH5pRouter(deps, (_req, res, next) => {
          res.locals.h5pActor = learner.actor;
          next();
        }),
      );
      return listenOnLoopback(app);
    };

    beforeAll(async () => {
      seedDir = interactiveVideoSeedFolder();
      tb = await openHttpTestbed([], { seedFrom: seedDir });
      const author = await tb.actor('author');
      learner = await tb.actor('learner');
      const example = (await packageExamples()).find((e) => e.file === PACKAGE);
      if (!example) throw new Error(`${PACKAGE} has no example activity`);
      contentId = await tb.activity(author, {
        published: true,
        library: example.library,
        params: withPanoptoVideo(example.params),
        metadata: example.metadata,
      });
      bases.configured = await listenWith(['https://media.hvl.no', PANOPTO_SITE]);
      bases.unconfigured = await listenWith([]);
    }, 240_000);
    afterAll(async () => {
      await closeLoopbackServers();
      await tb?.close();
      if (seedDir) rmSync(seedDir, { recursive: true, force: true });
    });

    describeWithBrowser('[DATA-011] the embed API in Chromium', (browser) => {
      const pages: Page[] = [];
      afterEach(async () => {
        await Promise.all(pages.splice(0).map((page) => page.close()));
      });

      /** Opens the player with every outside request intercepted; records embed API requests and refusals. */
      const openPlayer = async (base: string) => {
        const page = await browser().newPage();
        pages.push(page);
        const embedApiRequests: string[] = [];
        const refusedScripts: string[] = [];
        // WHY: the most recently added route wins, so the catch-all goes first and the Panopto stub after it.
        await page.route('**/*', (route) =>
          route.request().url().startsWith(base) ? route.continue() : route.abort('blockedbyclient'),
        );
        await page.route(`${PANOPTO_DEVELOPERS}/**`, (route) => {
          embedApiRequests.push(route.request().url());
          return route.fulfill({ contentType: 'text/javascript', body: EMBED_API_STUB });
        });
        page.on('console', (m) => {
          const refused = /^Refused to load the script '([^']+)'/.exec(m.text())?.[1];
          if (refused) refusedScripts.push(refused);
        });
        await page.goto(`${base}/h5p/play/${contentId}`);
        return { page, embedApiRequests, refusedScripts };
      };

      /** What the stub recorded, in whichever frame H5P runs the video. */
      const embedsIn = async (page: Page): Promise<unknown[]> => {
        const found = await Promise.all(
          page
            .frames()
            .map((frame) =>
              frame
                .evaluate(() => (window as { hvliPanoptoEmbed?: unknown }).hvliPanoptoEmbed)
                .catch(() => undefined),
            ),
        );
        return found.filter((embed) => embed !== undefined);
      };

      it('[DATA-011] with a configured Panopto site, H5P.Video loads the embed API and creates the player', async () => {
        // Act
        const { page, embedApiRequests, refusedScripts } = await openPlayer(bases.configured);
        await expect.poll(() => embedsIn(page), { timeout: 60_000 }).toHaveLength(1);
        // Assert
        expect(embedApiRequests).toEqual([PANOPTO_EMBED_API_URL]);
        expect(await embedsIn(page)).toEqual([
          { serverName: 'hvl.cloud.panopto.eu', sessionId: '8c1c6f3e-5b1a-4c0e-9d3e-000000000001' },
        ]);
        expect(refusedScripts).toEqual([]);
        // Act: another file on the same origin, as an injected tag would ask for it
        await page.evaluate((src) => {
          const tag = document.createElement('script');
          tag.src = src;
          document.head.append(tag);
        }, OTHER_PANOPTO_SCRIPT);
        // Assert: the path source allows the embed API only (D-070 amendment of 2026-10-24)
        await expect.poll(() => refusedScripts, { timeout: 30_000 }).toEqual([OTHER_PANOPTO_SCRIPT]);
        expect(embedApiRequests).toEqual([PANOPTO_EMBED_API_URL]);
      }, 90_000);

      it('[DATA-011] without a configured Panopto site, the policy refuses the embed API before any request', async () => {
        // Act
        const { page, embedApiRequests, refusedScripts } = await openPlayer(bases.unconfigured);
        await expect.poll(() => refusedScripts, { timeout: 60_000 }).toHaveLength(1);
        // Assert
        expect(refusedScripts).toEqual([PANOPTO_EMBED_API_URL]);
        expect(embedApiRequests).toEqual([]);
        expect(await embedsIn(page)).toEqual([]);
      }, 90_000);
    });
  });
});
