/**
 * Browser tests for the structure signature against the real H5P editor: each real type's example, opened in our
 * editor page in Chromium and saved without a change, must not count as a structural edit, or every save of that type
 * would ask for a reset (PROD-013, D-093). The save request is captured and answered in the browser, so nothing is
 * written.
 *
 * Found (skeptic review of W5a, 2026-10-29): H5P's editor drops a branching-question node's own `nextContentId: -1`,
 * which made every BranchingScenario save structural (fixed in containerShapes.ts); and it upgrades an activity to
 * the newest installed minor version of its library when it saves it, which the signature counts as structural by
 * design (`Name major.minor`), so the first save after an upgrade asks (pinned below for H5P.Column 1.18 → 1.22).
 *
 * Spec: PROD-013
 */
import { join } from 'node:path';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { structuralDifference } from '../../../src/learningDesign/safeEditing/structuralChange.js';
import { structureSignature } from '../../../src/learningDesign/safeEditing/structureSignature.js';
import { describeWithBrowser } from '../../support/browser.js';
import { closeLoopbackServers, listenOnLoopback } from '../../support/loopbackServers.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../../support/httpTestbed.js';
import {
  describeWithRealPackages,
  packageExamples,
  REAL_PACKAGES_DIR,
  type PackageExample,
} from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';

/** What the editor page sends on «Lagre» (editorPage.js). */
type SaveBody = { library: string; params: { params: unknown } };

/**
 * Opens an activity in the editor page and returns the body of its save, which never reaches the server.
 * @param browser - The running Chromium.
 * @param url - The editor page.
 * @param author - The activity's author.
 * @returns The save request's body.
 */
async function unchangedSave(browser: Browser, url: string, author: TestActor): Promise<SaveBody> {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.setExtraHTTPHeaders({ [author.header[0]]: author.header[1] });
    let sent: string | undefined;
    await page.route('**/h5p/content/**', async (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      sent = route.request().postData() ?? '';
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"contentId":"x"}' });
    });
    await page.goto(url);
    const form = page.frameLocator('iframe.h5p-editor-iframe').locator('.h5peditor-form').first();
    await form.waitFor({ timeout: 60_000 });
    // WHY: «Lagre» moves while H5P grows its iframe, and the editor needs a moment to build every field: retry.
    for (let attempt = 0; sent === undefined && attempt < 10; attempt++) {
      await page.click('#hvl-editor-save', { timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(1_000);
    }
    if (sent === undefined) throw new Error(`the editor page sent no save for ${url}`);
    return JSON.parse(sent) as SaveBody;
  } finally {
    await context.close();
  }
}

describeWithServices('[PROD-013] the structure signature and the real editor', () => {
  describeWithRealPackages('[PROD-013] the real content types', () => {
    let tb: HttpTestbed;
    let base: string;
    let author: TestActor;
    let examples: PackageExample[];
    beforeAll(async () => {
      tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
      author = await tb.actor('author');
      base = await listenOnLoopback(tb.app);
      examples = await packageExamples();
    }, 240_000);
    afterAll(async () => {
      await closeLoopbackServers();
      await tb?.close();
    });

    describeWithBrowser('[PROD-013] an unchanged save through the editor page', (browser) => {
      it('[PROD-013] is never structural, except after the editor upgraded the library', async () => {
        // Arrange
        const verdicts: Record<string, string> = {};
        for (const example of examples) {
          const id = await tb.importPackage(author, join(REAL_PACKAGES_DIR, example.file));
          const stored = await tb.db.h5PContent.findUniqueOrThrow({
            where: { id },
            select: { params: true },
          });
          // Act
          const body = await unchangedSave(browser(), `${base}/h5p/edit/${id}`, author);
          const before = structureSignature(stored.params, example.library);
          const difference = structuralDifference(
            before,
            structureSignature(body.params.params, body.library),
          );
          verdicts[example.library] = difference ? `${difference.kind} ${body.library}` : 'text-only';
        }
        // Assert
        const expected = Object.fromEntries(examples.map((e) => [e.library, 'text-only']));
        // UPSTREAM: https://github.com/h5p/h5p-editor-php-library/blob/ab2daa18bd61b19e7f8729e22eec88f3b637a868/scripts/h5peditor-editor.js
        // H5P's editor upgrades content to the newest installed minor version when it gives the content to save
        // (`getContent`, line 373); the pinned packages hold H5P.Column 1.18 (its example) and 1.22.
        expected['H5P.Column 1.18'] = 'main-library H5P.Column 1.22';
        expect(verdicts).toEqual(expected);
      }, 600_000);
    });
  });
});
