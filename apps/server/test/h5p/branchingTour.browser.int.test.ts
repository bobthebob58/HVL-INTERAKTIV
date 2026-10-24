/**
 * Browser tests for the editor's own UI state in the real H5P editor (D-069, D-078, D-080): BranchingScenario's
 * guided tour fades parts of the editor, which are inert until the author presses "I got it" and none after it;
 * once pressed, the tour stays away when the editor opens again in the same browser, because the server answers
 * the tour's flag as not kept and H5P keeps the browser's own; and a new author sees every "important description"
 * of the Blanks and DragText editors open, because the server still answers those flags as not set.
 *
 * Spec: UD-006, UD-030, DATA-002
 */
import { join } from 'node:path';
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithBrowser } from '../support/browser.js';
import { closeLoopbackServers, listenOnLoopback } from '../support/loopbackServers.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { describeWithRealPackages, REAL_PACKAGES_DIR } from '../support/realPackages.js';
import { describeWithServices } from '../support/services.js';

describeWithServices('the editor’s own UI state in the browser', () => {
  describeWithRealPackages('[UD-006] the editor’s tour and flags in the real editor', () => {
    let tb: HttpTestbed;
    let base: string;
    let author: TestActor;
    const ids: Record<string, string> = {};
    beforeAll(async () => {
      tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
      author = await tb.actor('author');
      for (const type of ['BranchingScenario', 'Blanks', 'DragText']) {
        ids[type] = await tb.importPackage(author, join(REAL_PACKAGES_DIR, `H5P.${type}.h5p`));
      }
      base = await listenOnLoopback(tb.app);
    }, 180_000);
    afterAll(async () => {
      await closeLoopbackServers();
      await tb?.close();
    });

    /** A fresh browser context (empty storage) whose requests carry the author's test header. */
    const freshContext = (browser: () => Browser) =>
      browser().newContext({ extraHTTPHeaders: { [author.header[0]]: author.header[1] } });

    describeWithBrowser('[UD-006] the editor’s tour and flags', (browser) => {
      it('[UD-030] the tour’s faded parts are inert until "I got it", and nothing is inert after it', async () => {
        // Arrange: a fresh browser has never closed the tour
        const context = await freshContext(browser);
        const page = await context.newPage();
        await page.goto(`${base}/h5p/edit/${ids.BranchingScenario ?? ''}`);
        const editor = page.frameLocator('iframe.h5p-editor-iframe');
        await editor.locator('.tour-button').waitFor({ timeout: 60_000 });
        const faded = await editor.locator('.tour-fade').count();
        await expect.poll(() => editor.locator('.tour-fade[inert]').count()).toBe(faded);
        // Act
        await editor.locator('.tour-button').click();
        // Assert
        expect(faded).toBeGreaterThan(0);
        await expect.poll(() => editor.locator('[inert], .tour-fade').count()).toBe(0);
        await context.close();
      }, 150_000);

      it('[UD-006] after "I got it", a reopened BranchingScenario editor shows no tour and nothing inert', async () => {
        // Arrange: the first open in a fresh browser shows the tour, and the author closes it
        const context = await freshContext(browser);
        const page = await context.newPage();
        await page.goto(`${base}/h5p/edit/${ids.BranchingScenario ?? ''}`);
        const editor = page.frameLocator('iframe.h5p-editor-iframe');
        await editor.locator('.tour-button').click({ timeout: 60_000 });
        await expect.poll(() => editor.locator('[inert]').count()).toBe(0);
        // Act
        await page.reload();
        await editor.locator('.bswrapper').waitFor({ timeout: 60_000 });
        // WHY: H5P asks the server for the flag before it starts the tour; this leaves time for that answer.
        await page.waitForTimeout(3_000);
        // Assert
        expect(await editor.locator('.tour-button').count()).toBe(0);
        expect(await editor.locator('[inert], .tour-fade').count()).toBe(0);
        await context.close();
      }, 150_000);

      it.each(['Blanks', 'DragText'])(
        '[UD-006] a new author sees every important description of the %s editor open',
        async (type) => {
          // Arrange
          const context = await freshContext(browser);
          const page = await context.newPage();
          // Act
          await page.goto(`${base}/h5p/edit/${ids[type] ?? ''}`);
          const editor = page.frameLocator('iframe.h5p-editor-iframe');
          await editor.locator('.has-important-description').first().waitFor({ timeout: 60_000 });
          // WHY: each description asks the server for its flag; this leaves time for the answers.
          await page.waitForTimeout(3_000);
          // Assert
          const described = await editor.locator('.has-important-description').count();
          expect(described).toBeGreaterThan(0);
          const open = editor.locator('.has-important-description.important-description-visible');
          expect(await open.count()).toBe(described);
          await context.close();
        },
        150_000,
      );
    });
  });
});
