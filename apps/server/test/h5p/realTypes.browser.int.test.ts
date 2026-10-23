/**
 * Browser tests with the real content types built from GitHub (D-078): each package installs through the seed path
 * (with the S2 package checks), and its example activity plays on our player page with H5P Core 1.28 in Chromium
 * without console errors, page errors or failed requests. This settles R-01 (D-047).
 *
 * Spec: H5P-001, H5P-002, H5P-003
 */
import type { Server } from 'node:http';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithBrowser } from '../support/browser.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import {
  describeWithRealPackages,
  packageExamples,
  REAL_PACKAGES_DIR,
  type PackageExample,
} from '../support/realPackages.js';
import { describeWithServices } from '../support/services.js';

describeWithServices('real H5P content types', () => {
  describeWithRealPackages('[H5P-002] the real content types', () => {
    let tb: HttpTestbed;
    let server: Server;
    let base: string;
    let learner: TestActor;
    let examples: (PackageExample & { contentId: string })[];
    beforeAll(async () => {
      tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
      const author = await tb.actor('author');
      learner = await tb.actor('learner');
      examples = [];
      for (const example of await packageExamples()) {
        const contentId = await tb.importPackage(author, join(REAL_PACKAGES_DIR, example.file), {
          published: true,
        });
        examples.push({ ...example, contentId });
      }
      server = tb.app.listen(0, '127.0.0.1');
      await new Promise((resolve) => server.once('listening', resolve));
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    }, 180_000);
    afterAll(async () => {
      if (server) await new Promise((resolve) => server.close(resolve));
      await tb?.close();
    });

    it('[H5P-003] every package installs through the seed path and its example activity imports with its files', () => {
      expect(examples.length).toBeGreaterThan(0);
      expect(examples.every((e) => e.contentId)).toBe(true);
    });

    it('[H5P-002] every example also saves through the editor path, whose sub-content policy accepts it', async () => {
      // Arrange
      const author = await tb.actor('author');
      // Act
      const saved = await Promise.all(
        examples.map(async (e) => {
          try {
            await tb.activity(author, { library: e.library, params: e.params, metadata: e.metadata });
            return [e.library, 'saved'];
          } catch (error) {
            return [e.library, (error as Error).message];
          }
        }),
      );
      // Assert
      expect(Object.fromEntries(saved)).toEqual(
        Object.fromEntries(examples.map((e) => [e.library, 'saved'])),
      );
    });

    describeWithBrowser('[H5P-001] each type plays with H5P Core 1.28', (browser) => {
      it('[H5P-001] every example plays without console errors, page errors or failed requests', async () => {
        const report: Record<string, string[]> = {};
        for (const example of examples) {
          // Arrange
          const page = await browser().newPage();
          await page.setExtraHTTPHeaders({ [learner.header[0]]: learner.header[1] });
          const problems: string[] = [];
          page.on('console', (m) => void (m.type() === 'error' && problems.push(`console: ${m.text()}`)));
          page.on('pageerror', (e) => problems.push(`page: ${e.message}`));
          page.on('response', (r) => void (r.status() >= 400 && problems.push(`${r.status()} ${r.url()}`)));
          // Act
          await page.goto(`${base}/h5p/play/${example.contentId}`);
          await page.waitForFunction(() => {
            const h5p = (window as unknown as { H5P?: { instances?: unknown[] } }).H5P;
            return (h5p?.instances?.length ?? 0) > 0;
          });
          await page.waitForTimeout(500);
          report[example.library] = problems;
          await page.close();
        }
        // Assert
        expect(report).toEqual(Object.fromEntries(examples.map((e) => [e.library, []])));
      }, 300_000);

      it('[DATA-011] the strict page policy holds: an injected inline script never runs, in the page or its frames', async () => {
        // Arrange: a container type, whose sub-content may sit in frames of the same document
        const example = examples.find((e) => e.library.startsWith('H5P.CoursePresentation')) ?? examples[0];
        const page = await browser().newPage();
        await page.setExtraHTTPHeaders({ [learner.header[0]]: learner.header[1] });
        const response = await page.goto(`${base}/h5p/play/${example?.contentId}`);
        await page.waitForFunction(() => {
          const h5p = (window as unknown as { H5P?: { instances?: unknown[] } }).H5P;
          return (h5p?.instances?.length ?? 0) > 0;
        });
        // Act: what an XSS payload would do, in the page and in H5P's own iframe
        const ran = await page.evaluate(async () => {
          const inject = (doc: Document) => {
            const script = doc.createElement('script');
            script.textContent = 'window.top.__pwned = (window.top.__pwned || 0) + 1;';
            doc.head.appendChild(script);
          };
          inject(document);
          for (const frame of document.querySelectorAll('iframe')) {
            if (frame.contentDocument?.head) inject(frame.contentDocument);
          }
          await new Promise((r) => setTimeout(r, 200));
          return (window as unknown as { __pwned?: number }).__pwned ?? 0;
        });
        // Assert
        const csp = response?.headers()['content-security-policy'] ?? '';
        expect(csp).toMatch(/script-src 'self' 'sha256-[^']+'(;|$)/);
        expect(ran).toBe(0);
        await page.close();
      }, 60_000);
    });
  });
});
