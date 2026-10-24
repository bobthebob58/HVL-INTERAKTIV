/**
 * Upstream pin of the third keyboard barrier in H5P's editor that axe cannot see (WCAG 2.1.1, UD-006; D-080
 * amendment DOC-9): ImageHotspots' position picker (H5PEditor.ImageCoordinateSelector 1.2.7) places a hotspot by
 * pointer only. It is a `<div>` with a click handler, without `tabindex`, key handler or x/y field, and attributes
 * cannot add that input, so a11yEditorRepairs.js leaves it as it is. A library update that gives it keyboard input
 * fails this pin (DOC-004), so D-080 and the manual protocol §8 are updated. The other two pins are in
 * ./a11yRepairs.browser.int.test.ts.
 *
 * Spec: UD-006
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithBrowser } from '../support/browser.js';
import { describeWithRealPackages } from '../support/realPackages.js';
import { openRealTypesServer, type RealTypesServer } from '../support/realTypesPlayer.js';
import { describeWithServices } from '../support/services.js';

describeWithServices('upstream pins of the H5P editor', () => {
  describeWithRealPackages('[UD-006] ImageHotspots in the real editor', () => {
    let server: RealTypesServer;
    beforeAll(async () => {
      server = await openRealTypesServer();
    }, 180_000);
    afterAll(() => server?.close());

    describeWithBrowser('[UD-006] in Chromium', (browser) => {
      it('upstream pin: H5PEditor.ImageCoordinateSelector 1.2 places a hotspot by pointer only', async () => {
        // Arrange: the first hotspot's picker, once its background image has loaded
        const page = await browser().newPage();
        await page.setExtraHTTPHeaders({ [server.author.header[0]]: server.author.header[1] });
        await page.goto(`${server.base}/h5p/edit/${server.ids.get('H5P.ImageHotspots') ?? ''}`);
        const editor = await (await page.waitForSelector('iframe.h5p-editor-iframe')).contentFrame();
        if (!editor) throw new Error('the editor iframe has no document');
        const picker = editor.locator('.image-coordinate-selector').filter({ visible: true }).first();
        await picker.waitFor({ timeout: 45_000 });
        const position = () => picker.locator('.image-coordinate-hotspot').getAttribute('style');
        const before = await position();
        // Act
        await picker.focus();
        const tookFocus = await picker.evaluate((element) => element === document.activeElement);
        for (const key of ['ArrowRight', 'ArrowDown', 'Enter', 'Space']) await page.keyboard.press(key);
        await page.waitForTimeout(500);
        const afterKeys = await position();
        await picker.click({ position: { x: 5, y: 5 } });
        // Assert: once this fails, the picker takes keyboard input; update D-080 and the manual protocol, then drop the pin
        expect(tookFocus).toBe(false);
        expect(await picker.locator('input, [tabindex]').count()).toBe(0);
        expect(afterKeys).toBe(before);
        await expect.poll(position).not.toBe(before);
        await page.close();
      }, 90_000);
    });
  });
});
