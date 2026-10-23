/**
 * Browser tests for "Gå til feltet" in the real H5P editor (D-078): a same-origin parent page posts
 * `hvli:go-to-field` with a finding path, and the editor page focuses that field inside H5P's editor frame, through
 * lists and sub-content; messages from any other window are ignored.
 *
 * Spec: PROD-003, UD-006
 */
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import type { Frame, Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithBrowser } from '../support/browser.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { describeWithRealPackages, REAL_PACKAGES_DIR } from '../support/realPackages.js';
import { describeWithServices } from '../support/services.js';

/** The H5P editor frame's focused element: which field it belongs to and what kind of control it is. */
const focusedField = (editor: Frame) =>
  editor.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    const field = active?.closest('.field');
    return {
      field: [...(field?.classList ?? [])].find((name) => name.startsWith('field-name-')) ?? null,
      tag: active?.tagName ?? null,
    };
  });

describeWithServices('the editor page and "Gå til feltet"', () => {
  describeWithRealPackages('[PROD-003] go to a finding’s field in the real editor', () => {
    let tb: HttpTestbed;
    let server: Server;
    let base: string;
    let author: TestActor;
    const ids: Record<string, string> = {};
    beforeAll(async () => {
      tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
      author = await tb.actor('author');
      for (const type of ['Column', 'QuestionSet', 'MultiChoice']) {
        ids[type] = await tb.importPackage(author, join(REAL_PACKAGES_DIR, `H5P.${type}.h5p`));
      }
      // WHY: the web app frames the editor on the same origin; this empty page stands in for it.
      tb.app.get(
        '/frame-host',
        (_req, res) => void res.type('html').send('<!doctype html><title>host</title>'),
      );
      server = tb.app.listen(0, '127.0.0.1');
      await new Promise((resolve) => server.once('listening', resolve));
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    }, 180_000);
    afterAll(async () => {
      if (server) await new Promise((resolve) => server.close(resolve));
      await tb?.close();
    });

    /** Opens the editor for an activity inside a same-origin parent page. */
    const openFramed = async (page: Page, contentId: string) => {
      await page.setExtraHTTPHeaders({ [author.header[0]]: author.header[1] });
      await page.goto(`${base}/frame-host`);
      await page.evaluate((src) => {
        const frame = document.createElement('iframe');
        frame.src = src;
        frame.title = 'editor';
        frame.style.cssText = 'width:1000px;height:800px';
        document.body.append(frame);
      }, `/h5p/edit/${contentId}`);
      const outer = page.frameLocator('iframe[title="editor"]');
      await outer.frameLocator('iframe.h5p-editor-iframe').locator('.h5peditor-form').first().waitFor();
      const editorPage = page.frames().find((frame) => frame.url().includes('/h5p/edit/'));
      const editor = page.frames().find((frame) => frame.parentFrame() === editorPage);
      if (!editorPage || !editor) throw new Error('editor frames not found');
      return { editorPage, editor };
    };

    const goTo = (page: Page, path: string) =>
      page.evaluate((findingPath) => {
        const frame = document.querySelector('iframe') as HTMLIFrameElement;
        frame.contentWindow?.postMessage({ type: 'hvli:go-to-field', path: findingPath }, location.origin);
      }, path);

    describeWithBrowser('[UD-006] focus moves to the field', (browser) => {
      it.each([
        ['MultiChoice', 'answers[1].text', 'field-name-text'],
        ['Column', 'content[0].content.params.text', 'field-name-text'],
        ['Column', 'content[1].content.params.alt', 'field-name-alt'],
        ['QuestionSet', 'questions[3].params.question', 'field-name-question'],
      ])(
        '[PROD-003] %s: %s focuses its field',
        async (type, path, fieldClass) => {
          // Arrange
          const page = await browser().newPage();
          const { editor } = await openFramed(page, ids[type] ?? '');
          // Act
          await goTo(page, path);
          // Assert
          await expect
            .poll(() => focusedField(editor), { timeout: 10_000 })
            .toMatchObject({ field: fieldClass });
          await page.close();
        },
        90_000,
      );

      it('[UD-006] a message from the editor page itself, not its parent, moves nothing', async () => {
        // Arrange
        const page = await browser().newPage();
        const { editorPage, editor } = await openFramed(page, ids.MultiChoice ?? '');
        // Act
        await editorPage.evaluate(() =>
          window.postMessage({ type: 'hvli:go-to-field', path: 'answers[1].text' }, location.origin),
        );
        await page.waitForTimeout(1_000);
        // Assert
        expect((await focusedField(editor)).field).toBeNull();
        await page.close();
      }, 90_000);
    });
  });
});
