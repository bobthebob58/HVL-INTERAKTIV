/**
 * Browser tests of the H5P markup repairs (D-080, packages/hvl-h5p-theme/src/a11yRepairs.js) with the real content
 * types (D-078): the repaired controls carry their new roles and names in Chromium's accessibility tree and still
 * work by keyboard as H5P made them work (CoursePresentation's progress bar, a DragText drop, the editor's vertical
 * tabs, choosing a content type in the hub); the editor-mode switch shows its state and the score-range "to" field
 * has a name. Two keyboard gaps of H5P's editor that attributes cannot close (WCAG 2.1.1, the UD-006 barriers listed
 * in D-080 and the manual protocol §8) are `upstream pin:` tests (DOC-004): a vertical tab ignores Enter, an editor
 * mode ignores Enter and Space. A library update that closes one fails its pin, so that record is updated.
 * axe on the same markup: apps/server/a11y/.
 *
 * Spec: UD-006, UD-030, UD-011
 */
import type { Frame, Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithBrowser } from '../support/browser.js';
import { describeWithRealPackages } from '../support/realPackages.js';
import { openRealPlayer, openRealTypesServer, type RealTypesServer } from '../support/realTypesPlayer.js';
import { describeWithServices } from '../support/services.js';

/** The first document of the page that shows `selector`, once H5P has rendered it. */
async function frameWith(page: Page, selector: string): Promise<Frame> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    for (const frame of page.frames()) if (await frame.locator(selector).count()) return frame;
    await page.waitForTimeout(200);
  }
  throw new Error(`no document shows ${selector}`);
}

/** What has keyboard focus in a frame, by attributes. */
const focused = (frame: Frame) =>
  frame.evaluate(() => {
    const element = document.activeElement;
    return { role: element?.getAttribute('role'), id: element?.id, parent: element?.parentElement?.id };
  });

describeWithServices('the H5P markup repairs', () => {
  describeWithRealPackages('[UD-006] the real content types with the repairs', () => {
    let server: RealTypesServer;
    beforeAll(async () => {
      server = await openRealTypesServer();
    }, 180_000);
    afterAll(() => server?.close());

    /** Opens the editor page of an activity (or `/h5p/new`) as the author and returns H5P's editor iframe. */
    async function openEditor(page: Page, path: string, ready: string): Promise<Frame> {
      await page.setExtraHTTPHeaders({ [server.author.header[0]]: server.author.header[1] });
      await page.goto(`${server.base}${path}`);
      const frame = await (await page.waitForSelector('iframe.h5p-editor-iframe')).contentFrame();
      if (!frame) throw new Error('the editor iframe has no document');
      await frame.locator(ready).filter({ visible: true }).first().waitFor({ timeout: 45_000 });
      return frame;
    }

    describeWithBrowser('[UD-006] in Chromium', (browser) => {
      it("[UD-006] CoursePresentation's progress bar is a list of named links that still moves by arrow keys and Enter", async () => {
        // Arrange
        const page = await openRealPlayer(browser(), server, 'H5P.CoursePresentation');
        const cp = await frameWith(page, '.h5p-progressbar[role="list"]');
        const tree = await cp.locator('.h5p-progressbar').ariaSnapshot();
        const firstSlide = await cp.getByRole('group', { name: 'Tre fasar' }).count();
        // Act
        await cp.locator('#progressbar-part-0 > a').focus();
        await page.keyboard.press('ArrowRight');
        const afterArrow = await focused(cp);
        await page.keyboard.press('Enter');
        // Assert
        expect(tree).toMatch(/^- list "Vel sida som skal visast":/);
        for (const name of ['Tre fasar', 'Undervegsvurdering er ikkje fullført.', 'Oppsummering'])
          expect(tree).toContain(`- link "${name}"`);
        expect(tree).not.toMatch(/- tab\b|tablist|- link( "")?:?$/m);
        expect(afterArrow.parent).toBe('progressbar-part-1');
        await expect
          .poll(() =>
            cp.locator('.h5p-progressbar a[aria-current="step"]').evaluate((a) => a.parentElement?.id),
          )
          .toBe('progressbar-part-1');
        expect(await cp.locator('[aria-selected]').count()).toBe(0);
        // WHY: the slides were the tab panels of the parts; they are groups named by their part.
        expect([firstSlide, await cp.locator('[role="tabpanel"]').count()]).toEqual([1, 0]);
        // WHY: a slide's own reference stays; only the summary slide's, which has no element of that ID, goes.
        expect(await cp.locator('#progressbar-part-1').getAttribute('aria-controls')).toBe('slide-1');
        expect(await cp.locator('.progressbar-part-summary-slide').getAttribute('aria-controls')).toBeNull();
        // WHY: H5P.Tooltip shows each part's aria-label, which the repair leaves in place.
        expect(await cp.locator('.h5p-tooltip').allTextContents()).toContain('Undervegsvurdering');
        await page.close();
      }, 60_000);

      it('[UD-006] DragText: a word dropped by keyboard lands in a drop zone that is a named group', async () => {
        // Arrange
        const page = await openRealPlayer(browser(), server, 'H5P.DragText');
        const zone = page.locator('.h5p-drag-text [aria-dropeffect]').first();
        // Act: the single-pointer alternative of UD-005, pressed on the word and then on the zone H5P focuses
        await page.locator('.h5p-drag-text .h5p-draggable', { hasText: 'læringsaktivitetar' }).focus();
        await page.keyboard.press('Enter');
        const target = await focused(page.mainFrame());
        await page.keyboard.press('Enter');
        // Assert
        expect(target.role).toBe('group');
        expect(await page.getByRole('group', { name: /^Sleppsone 1/ }).count()).toBe(1);
        await expect.poll(() => zone.locator('.h5p-draggable').count()).toBe(1);
        await expect.poll(() => zone.getAttribute('aria-label')).toMatch(/læringsaktivitetar/);
        await page.close();
      }, 60_000);

      /** QuestionSet's editor (vertical tabs, editor-mode switch, score ranges) once `ready` shows. */
      async function questionSetEditor(ready: string): Promise<{ page: Page; editor: Frame }> {
        const page = await browser().newPage();
        const id = server.ids.get('H5P.QuestionSet');
        return { page, editor: await openEditor(page, `/h5p/edit/${id}`, ready) };
      }

      it("[UD-006] the editor's vertical tabs are buttons that open with Space, their forms plain groups", async () => {
        // Arrange
        const { page, editor } = await questionSetEditor('.h5p-vtab-a');
        const list = editor.locator('.h5p-vtabs-container > ol').first();
        const items = list.locator(':scope > li');
        const second = items.nth(1).locator('.h5p-vtab-a');
        // Act
        await second.focus();
        await page.keyboard.press('Space');
        // Assert
        expect(await editor.locator('.h5p-vtab-form[role]').count()).toBe(0);
        expect(await list.getAttribute('role')).toBe('list');
        expect(await second.getAttribute('role')).toBe('button');
        await expect.poll(() => items.nth(1).getAttribute('class')).toContain('h5p-current');
        expect(await second.getAttribute('aria-current')).toBe('true');
        expect(await items.nth(0).locator('.h5p-vtab-a').getAttribute('aria-current')).toBeNull();
        expect(await editor.getByRole('button', { name: /^2\. Undervegsvurdering/ }).count()).toBe(1);
        await page.close();
      }, 90_000);

      it('upstream pin: H5PEditor.VerticalTabs 1.3 does not open an item on Enter', async () => {
        // Arrange
        const { page, editor } = await questionSetEditor('.h5p-vtab-a');
        const second = editor.locator('.h5p-vtabs-container > ol').first().locator(':scope > li').nth(1);
        // Act
        await second.locator('.h5p-vtab-a').focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
        // Assert: once this fails, H5P handles Enter; update D-080 and the manual protocol, then drop the pin
        expect(await second.getAttribute('class')).not.toContain('h5p-current');
        await page.close();
      }, 90_000);

      it('[UD-030] QuestionSet\'s editor: the editor-mode switch shows its active mode as pressed, the "to" field is named', async () => {
        // Arrange
        const { page, editor } = await questionSetEditor('.h5peditor-widget-option');
        const modes = editor.getByRole('group', { name: 'Redigeringsmodus' }).getByRole('button');
        const pressed = () => modes.evaluateAll((all) => all.map((m) => m.getAttribute('aria-pressed')));
        const before = await pressed();
        // Act
        await modes.nth(1).click();
        // Assert
        expect(before).toEqual(['true', 'false']);
        await expect.poll(pressed).toEqual(['false', 'true']);
        // WHY: QuestionSet's nn heading of the score ranges, then the "*" of H5P's required marker
        // (h5peditor-required::after), the row's "from" value and the dash. The group is closed, hence includeHidden.
        const to = editor.getByRole('textbox', { name: /^Poengintervall\* \d+ % –$/, includeHidden: true });
        expect(await to.count()).toBe(3);
        await page.close();
      }, 90_000);

      it("upstream pin: H5PEditor's editor-mode switch answers neither Enter nor Space", async () => {
        // Arrange
        const { page, editor } = await questionSetEditor('.h5peditor-widget-option');
        const second = editor.locator('ul.h5peditor-widget-select > li').nth(1);
        // Act
        await second.focus();
        await page.keyboard.press('Enter');
        await page.keyboard.press('Space');
        await page.waitForTimeout(500);
        // Assert: once this fails, H5P handles the keys; update D-080 and the manual protocol, then drop the pin
        expect(await second.getAttribute('class')).not.toContain('h5peditor-widget-active');
        await page.close();
      }, 90_000);

      it('[UD-006] the hub: a content type is still chosen with the arrow keys and Space from its named group', async () => {
        // Arrange
        const page = await browser().newPage();
        const hub = await openEditor(page, '/h5p/new', '.h5p-hub-media');
        const group = hub.getByRole('group', { name: 'Alle innhaldstypar' });
        const types = hub.locator('.h5p-hub-content-type-list li[role="button"]');
        const title = await types.nth(1).locator('.h5p-hub-media-heading').textContent();
        const inGroup = await group.locator('li[role="button"]').count();
        // Act
        await types.first().focus();
        await page.keyboard.press('ArrowDown');
        const afterArrow = await focused(hub);
        await page.keyboard.press('Space');
        // Assert
        expect(inGroup).toBeGreaterThanOrEqual(10);
        expect(afterArrow.id).toBe(await types.nth(1).getAttribute('id'));
        await expect.poll(() => hub.locator('.h5p-hub-selected').first().textContent()).toBe(title);
        await hub.locator('.h5peditor-form').filter({ visible: true }).first().waitFor({ timeout: 45_000 });
        await page.close();
      }, 120_000);
    });
  });
});
