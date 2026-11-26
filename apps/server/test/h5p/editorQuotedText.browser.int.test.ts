/**
 * Browser test of the editor on stored text that holds a double quote (D-124): H5P's editor writes a text field's
 * value straight into `value="…"`, so the server hands it text in the form the editor writes itself. The field then
 * shows the whole text, in a label of the activity and in its title, and nothing of the text ends up as an
 * attribute of the field.
 *
 * Spec: H5P-006, SEC-008
 */
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithBrowser } from '../support/browser.js';
import { closeLoopbackServers, listenOnLoopback } from '../support/loopbackServers.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { describeWithRealPackages, REAL_PACKAGES_DIR } from '../support/realPackages.js';
import { describeWithServices } from '../support/services.js';

const LABEL = 'Vis "fasit" no';
const TITLE = 'Kva er "celle"?';

describeWithServices('[H5P-006] the editor on text with a double quote', () => {
  describeWithRealPackages('[H5P-006] real content types', () => {
    let tb: HttpTestbed;
    let base: string;
    let author: TestActor;
    let contentId: string;
    beforeAll(async () => {
      tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
      author = await tb.actor('author');
      contentId = await tb.importPackage(author, join(REAL_PACKAGES_DIR, 'H5P.Blanks.h5p'));
      const row = await tb.db.h5PContent.findUniqueOrThrow({ where: { id: contentId } });
      const params = { ...(row.params as object), showSolutions: LABEL };
      const metadata = { ...(row.metadata as object), title: TITLE };
      await tb.db.h5PContent.update({
        where: { id: contentId },
        data: { params: params as never, metadata: metadata as never },
      });
      base = await listenOnLoopback(tb.app);
    }, 240_000);
    afterAll(async () => {
      await closeLoopbackServers();
      await tb?.close();
    });

    describeWithBrowser('[H5P-006] H5P editor in Chromium', (browser) => {
      it('[H5P-006] a label and the title with a double quote are shown whole, and add no attribute to their fields', async () => {
        // Arrange
        const page = await browser().newPage();
        await page.setExtraHTTPHeaders({ [author.header[0]]: author.header[1] });
        // Act
        await page.goto(`${base}/h5p/edit/${contentId}`);
        const form = page.frameLocator('iframe.h5p-editor-iframe').locator('.h5peditor-form').first();
        await form.waitFor({ timeout: 30_000 });
        await page.waitForTimeout(1_000);
        const fields = await form.locator('input[type=text]').evaluateAll((inputs) =>
          inputs.map((input) => ({
            value: (input as HTMLInputElement).value,
            attributes: input.getAttributeNames(),
          })),
        );
        // Assert: both texts are in a field, whole
        const values = fields.map((field) => field.value);
        expect(values).toContain(LABEL);
        expect(values).toContain(TITLE);
        // Assert: no part of a text became an attribute, and no field holds a text cut off at its quote
        const strayAttributes = fields
          .flatMap((field) => field.attributes)
          .filter((name) => /fasit|celle|"/.test(name));
        expect(strayAttributes).toEqual([]);
        expect(values.filter((value) => value === 'Vis ' || value === 'Kva er ')).toEqual([]);
        await page.close();
      }, 90_000);
    });
  });
});
