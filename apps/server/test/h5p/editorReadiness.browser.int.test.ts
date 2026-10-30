/**
 * Browser test of «Lagre» on our editor page with the real H5P editor (D-078) on a slow load: the button stays
 * disabled, and the status says the activity is opening, until H5P's editor has built the activity's form; a click
 * the moment it is enabled saves the activity. For a new activity (`/h5p/new`) it stays disabled, with no status
 * text, until a content type is chosen in H5P's hub, and then creates the activity.
 *
 * Why: before this test, the page enabled «Lagre» as soon as `H5PEditor.Editor` existed, long before H5P's editor
 *      iframe had loaded. A click then made H5P's `getContent` throw, left «Lagrar …» on screen and the button
 *      disabled for good, and nothing was saved (found reproducing CI run 41075981429 on `main`). The activity's
 *      parameters and H5P's own editor requests are delayed here so the window is wide, and a script in the page
 *      clicks «Lagre» in the same moment it is enabled, as an impatient author on a slow device would. A new
 *      activity's «Lagre» used to be enabled before any content type was chosen, and a click only said it could not
 *      save; the second test keeps the new-activity path, which no other browser test saves through, working.
 *
 * Spec: H5P-007, UD-006
 */
import { join } from 'node:path';
import type { Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { t } from '../../src/i18n/translate.js';
import { describeWithBrowser } from '../support/browser.js';
import { closeLoopbackServers, listenOnLoopback } from '../support/loopbackServers.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { describeWithRealPackages, REAL_PACKAGES_DIR } from '../support/realPackages.js';
import { describeWithServices } from '../support/services.js';

/** How «Lagre» and the status looked at one change, and whether H5P's form was built by then. */
interface Seen {
  readonly disabled: boolean;
  readonly status: string;
  readonly formBuilt: boolean;
}

/** How long the activity's parameters and H5P's editor requests are held back (a slow server or device). */
const DELAY_MS = 700;

/**
 * Runs in the editor page before its scripts: records every change of «Lagre» and of the status, and clicks «Lagre»
 * in the same task in which it is enabled.
 */
function clickTheMomentItIsEnabled(): void {
  if (!location.pathname.startsWith('/h5p/edit/')) return;
  const seen: Seen[] = [];
  (window as unknown as { hvliSeen: Seen[] }).hvliSeen = seen;
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('hvl-editor-save') as HTMLButtonElement;
    const status = document.getElementById('hvl-editor-status') as HTMLElement;
    const frame = () => document.querySelector<HTMLIFrameElement>('iframe.h5p-editor-iframe');
    let clicked = false;
    const record = () => {
      const formBuilt = Boolean(frame()?.contentDocument?.querySelector('.h5peditor-form'));
      seen.push({ disabled: button.disabled, status: status.textContent ?? '', formBuilt });
      if (button.disabled || clicked) return;
      clicked = true;
      button.click();
    };
    record();
    new MutationObserver(record).observe(button, { attributes: true, attributeFilter: ['disabled'] });
    new MutationObserver(record).observe(status, { childList: true, characterData: true, subtree: true });
  });
}

/** Holds back the activity's parameters and H5P's editor requests by {@link DELAY_MS}. */
async function slowDown(page: Page): Promise<void> {
  await page.route(/\/h5p\/(params\/|ajax)/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    await route.continue();
  });
}

describeWithServices('the editor page on a slow load', () => {
  describeWithRealPackages('[H5P-007] «Lagre» waits until H5P’s editor can save', () => {
    let tb: HttpTestbed;
    let base: string;
    let author: TestActor;
    let contentId: string;
    beforeAll(async () => {
      tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
      author = await tb.actor('author');
      contentId = await tb.importPackage(author, join(REAL_PACKAGES_DIR, 'H5P.MultiChoice.h5p'));
      base = await listenOnLoopback(tb.app);
    }, 180_000);
    afterAll(async () => {
      await closeLoopbackServers();
      await tb?.close();
    });

    describeWithBrowser('[UD-006] no click on «Lagre» is lost while the activity opens', (browser) => {
      it('[H5P-007] stays disabled with the opening text until the form is built; a click the moment it is enabled saves', async () => {
        // Arrange
        const page = await browser().newPage();
        await page.setExtraHTTPHeaders({ [author.header[0]]: author.header[1] });
        const problems: string[] = [];
        page.on('console', (m) => void (m.type() === 'error' && problems.push(`console: ${m.text()}`)));
        page.on('pageerror', (e) => problems.push(`page: ${e.message}`));
        await page.addInitScript(clickTheMomentItIsEnabled);
        await slowDown(page);
        const saved = page
          .waitForResponse(
            (r) => r.request().method() === 'PUT' && r.url().endsWith(`/h5p/content/${contentId}`),
            {
              timeout: 30_000,
            },
          )
          .catch(() => undefined);
        // Act
        await page.goto(`${base}/h5p/edit/${contentId}`);
        const response = await saved;
        const seen = await page.evaluate(() => (window as unknown as { hvliSeen: Seen[] }).hvliSeen);
        // Assert: «Lagre» was first enabled once H5P's form was built, and that first click saved without an error
        const enabledAt = seen.findIndex((s) => !s.disabled);
        expect(seen[enabledAt]).toEqual({ disabled: false, status: '', formBuilt: true });
        expect(problems).toEqual([]);
        expect(response?.status()).toBe(200);
        await expect.poll(() => page.textContent('#hvl-editor-status'), { timeout: 20_000 }).toBe('Lagra.');
        // Assert: until then it was disabled, and the status said that the activity opens
        expect(enabledAt).toBeGreaterThan(0);
        expect(seen[0]).toEqual({ disabled: true, status: t('page.loading'), formBuilt: false });
        expect(seen.slice(0, enabledAt).every((s) => s.status === t('page.loading'))).toBe(true);
        await page.close();
      }, 90_000);

      it('[H5P-007] a new activity: disabled, with no status, until a content type is chosen; then the first click saves', async () => {
        // Arrange: the hub of a new activity, before a content type is chosen
        const page = await browser().newPage();
        await page.setExtraHTTPHeaders({ [author.header[0]]: author.header[1] });
        const problems: string[] = [];
        page.on('pageerror', (e) => problems.push(`page: ${e.message}`));
        await page.goto(`${base}/h5p/new`);
        const hub = await (await page.waitForSelector('iframe.h5p-editor-iframe')).contentFrame();
        if (!hub) throw new Error('the editor iframe has no document');
        await hub.locator('#h5p-multichoice').waitFor({ timeout: 45_000 });
        const looks = async () => ({
          disabled: await page.isDisabled('#hvl-editor-save'),
          status: await page.textContent('#hvl-editor-status'),
        });
        const waiting = await looks();
        // Act: choose Multiple Choice from the hub, give it a title and save
        await hub.locator('#h5p-multichoice').focus();
        await page.keyboard.press('Space');
        await hub.locator('.h5peditor-form').filter({ visible: true }).first().waitFor({ timeout: 45_000 });
        const chosen = await looks();
        const title = hub.locator('.field-name-extraTitle input').first();
        await title.fill('Ny aktivitet');
        await title.dispatchEvent('change');
        const created = page.waitForResponse(
          (r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/h5p/content',
        );
        // WHY: a pointer click can land in H5P's iframe while it still grows (../../e2e/support/editorSave.ts); this
        // test is about when the page lets «Lagre» save, so it clicks the button itself.
        await page.$eval('#hvl-editor-save', (button) => (button as HTMLButtonElement).click());
        // Assert
        expect(waiting).toEqual({ disabled: true, status: '' });
        expect(chosen).toEqual({ disabled: false, status: '' });
        expect((await created).status()).toBe(201);
        await expect.poll(() => page.textContent('#hvl-editor-status'), { timeout: 20_000 }).toBe('Lagra.');
        expect(problems).toEqual([]);
        await page.close();
      }, 90_000);
    });
  });
});
