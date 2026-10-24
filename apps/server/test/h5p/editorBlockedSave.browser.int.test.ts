/**
 * Browser test for a refused save of a published activity in the real H5P editor (D-074, D-078): the editor page
 * names the error in its error summary with an icon and a word (no list bullet), in the page's own words for where
 * it runs, and its "Gå til feltet" focuses the field, although the stored version that the Check tab validates
 * does not hold the error.
 *
 * Spec: PROD-003, UD-013, UD-006
 */
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import express, { type RequestHandler } from 'express';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { loadValidationContext } from '../../src/config/validationContext.js';
import { editorSavedForm } from '../../src/content/savedForm.js';
import { PublishedSaveGate } from '../../src/content/PublishedSaveGate.js';
import { createH5pRouter } from '../../src/http/createH5pRouter.js';
import { pageAssetRoutes } from '../../src/http/pages/pageAssetRoutes.js';
import type { ContentRouteDeps } from '../../src/http/routes/contentRoutes.js';
import { t } from '../../src/i18n/translate.js';
import { createContentValidator } from '../../src/validation/validateContent.js';
import { describeWithBrowser } from '../support/browser.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { describeWithRealPackages, REAL_PACKAGES_DIR } from '../support/realPackages.js';
import { describeWithServices } from '../support/services.js';

describeWithServices('the editor page and a refused save', () => {
  describeWithRealPackages('[PROD-003] a refused save of a published activity in the real editor', () => {
    let tb: HttpTestbed;
    let server: Server;
    let base: string;
    let author: TestActor;
    let contentId: string;
    beforeAll(async () => {
      tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
      author = await tb.actor('author');
      contentId = await tb.importPackage(author, join(REAL_PACKAGES_DIR, 'H5P.Column.h5p'), {
        published: true,
      });
      // WHY: as createApp does: the content routes run the publish gate with the real validator on saves.
      const validator = createContentValidator(loadValidationContext({ CAPTIONED_MEDIA_ORIGINS: [] }));
      const saveGate = new PublishedSaveGate(
        { db: tb.db, validator, clock: () => new Date() },
        editorSavedForm(tb.runtime.editor.libraryManager),
      );
      const authenticate: RequestHandler = (req, res, next) => {
        if (author.header[1] === req.headers[author.header[0]]) res.locals.h5pActor = author.actor;
        next();
      };
      const routes: ContentRouteDeps = { ...tb.runtime, saveGate };
      const app = express().use(pageAssetRoutes()).use('/h5p', createH5pRouter(routes, authenticate));
      server = app.listen(0, '127.0.0.1');
      await new Promise((resolve) => server.once('listening', resolve));
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    }, 180_000);
    afterAll(async () => {
      if (server) await new Promise((resolve) => server.close(resolve));
      await tb?.close();
    });

    describeWithBrowser('[UD-013] the page names the error and reaches its field', (browser) => {
      it('[PROD-003] lists the new error with "Gå til feltet", which focuses the field', async () => {
        // Arrange: the image of a published Column gets a file name as its alternative text
        const page = await browser().newPage();
        await page.setExtraHTTPHeaders({ [author.header[0]]: author.header[1] });
        await page.goto(`${base}/h5p/edit/${contentId}`);
        const editor = page.frameLocator('iframe.h5p-editor-iframe');
        const alt = editor.locator('.field-name-alt input').first();
        await alt.evaluate((input: HTMLInputElement) => {
          input.value = 'diagram.png';
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        const refused = page.waitForResponse((r) => r.url().endsWith(`/h5p/content/${contentId}`));
        // Act
        await page.click('#hvl-editor-save');
        await page.locator('#hvl-editor-findings button').click({ timeout: 20_000 });
        // Assert
        expect((await refused).status()).toBe(409);
        expect(await page.textContent('#hvl-editor-status')).toBe(
          `${t('page.editor.blockedSave', {}, 'nn')} ${t('page.editor.blockedErrors', { count: 1 }, 'nn')}`,
        );
        expect(await page.locator('#hvl-editor-findings li').allTextContents()).toEqual([
          expect.stringMatching(/^✗ Feil: .*«diagram\.png».*Gå til feltet$/),
        ]);
        // UD-003: the error shows in the summary box, named by its icon and word and not by a list bullet.
        expect(await page.locator('.hvl-error-summary').isVisible()).toBe(true);
        const bullet = (li: HTMLElement) => getComputedStyle(li).listStyleType;
        expect(await page.locator('#hvl-editor-findings li').evaluate(bullet)).toBe('none');
        const described = await page.getAttribute('#hvl-editor-findings button', 'aria-describedby');
        expect(await page.textContent(`#${described ?? ''}`)).toMatch(/^✗ Feil: /);
        await expect
          .poll(() => alt.evaluate((input) => input === document.activeElement), { timeout: 20_000 })
          .toBe(true);
        expect(await tb.db.h5PContent.findUniqueOrThrow({ where: { id: contentId } })).toMatchObject({
          version: 1,
        });
        await page.close();
      }, 120_000);
    });
  });
});
