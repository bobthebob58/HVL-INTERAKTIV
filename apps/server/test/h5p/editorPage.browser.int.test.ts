/**
 * Browser tests for our editor page with the real content types (D-078): H5P's editor starts for each type under
 * the strict H5P page policy without console errors, policy violations or failed requests, and saves through the
 * content API.
 *
 * Spec: H5P-002, H5P-007, DATA-011
 */
import { join } from 'node:path';
import type { Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithBrowser } from '../support/browser.js';
import { closeLoopbackServers, listenOnLoopback } from '../support/loopbackServers.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import {
  describeWithRealPackages,
  packageExamples,
  REAL_PACKAGES_DIR,
  type PackageExample,
} from '../support/realPackages.js';
import { describeWithServices } from '../support/services.js';

/** A third-party frame the policy refused, as the browser reports it. */
const REFUSED_FRAME = /^Refused to frame '(https?:\/\/[^']+)'/;

/** What the browser reported on one editor page. */
interface EditorReport {
  readonly problems: string[];
  /** Outside pages the strict policy kept out (DATA-011): the intended outcome, listed so a new one is noticed. */
  readonly refusedFrames: string[];
}

/** Opens the editor page and records every problem the browser reports in it and its frames. */
async function openEditor(page: Page, url: string): Promise<EditorReport> {
  const problems: string[] = [];
  const refusedFrames: string[] = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const refused = REFUSED_FRAME.exec(m.text())?.[1];
    if (refused) refusedFrames.push(refused);
    else problems.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`page: ${e.message}`));
  page.on('response', (r) => void (r.status() >= 400 && problems.push(`${r.status()} ${r.url()}`)));
  await page.goto(url);
  await page
    .frameLocator('iframe.h5p-editor-iframe')
    .locator('.h5peditor-form')
    .first()
    .waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1_000);
  return { problems, refusedFrames };
}

describeWithServices('the editor page', () => {
  describeWithRealPackages('[H5P-002] the editor with the real content types', () => {
    let tb: HttpTestbed;
    let base: string;
    let author: TestActor;
    let examples: (PackageExample & { contentId: string })[];
    beforeAll(async () => {
      tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
      author = await tb.actor('author');
      examples = [];
      for (const example of await packageExamples()) {
        const contentId = await tb.importPackage(author, join(REAL_PACKAGES_DIR, example.file), {
          published: false,
        });
        examples.push({ ...example, contentId });
      }
      base = await listenOnLoopback(tb.app);
    }, 180_000);
    afterAll(async () => {
      await closeLoopbackServers();
      await tb?.close();
    });

    describeWithBrowser('[DATA-011] H5P editor under the strict page policy', (browser) => {
      it('[H5P-002] every type opens in the editor without errors, violations or failed requests', async () => {
        const problems: Record<string, string[]> = {};
        const refused: Record<string, string[]> = {};
        for (const example of examples) {
          // Arrange
          const page = await browser().newPage();
          await page.setExtraHTTPHeaders({ [author.header[0]]: author.header[1] });
          // Act
          const report = await openEditor(page, `${base}/h5p/edit/${example.contentId}`);
          problems[example.library] = report.problems;
          if (report.refusedFrames.length > 0) refused[example.library] = report.refusedFrames;
          await page.close();
        }
        // Assert
        expect(problems).toEqual(Object.fromEntries(examples.map((e) => [e.library, []])));
        // DATA-011: BranchingScenario's editor embeds H5P's online tutorial; the policy keeps it out (D-070).
        expect(refused).toEqual({ 'H5P.BranchingScenario 1.10': ['https://documentation.h5p.com/'] });
      }, 300_000);

      it('[H5P-007] the save button stores the activity through the content API and announces it', async () => {
        // Arrange
        const example = examples[0];
        if (!example) throw new Error('no example');
        const page = await browser().newPage();
        await page.setExtraHTTPHeaders({ [author.header[0]]: author.header[1] });
        const { problems } = await openEditor(page, `${base}/h5p/edit/${example.contentId}`);
        const saved = page.waitForResponse((r) => r.url().endsWith(`/h5p/content/${example.contentId}`));
        // Act
        await page.click('#hvl-editor-save');
        // Assert
        expect((await saved).status()).toBe(200);
        await expect.poll(() => page.textContent('#hvl-editor-status')).toBe('Lagra.');
        expect(problems).toEqual([]);
        await page.close();
      }, 60_000);
    });
  });
});
