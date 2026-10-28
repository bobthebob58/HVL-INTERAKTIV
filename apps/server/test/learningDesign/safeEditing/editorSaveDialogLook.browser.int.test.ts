/**
 * Probe P7 (S5): how the save choice dialog looks and reads in the real editor page (D-093, D-070): initial focus
 * after a mouse click, a `method="dialog"` form under `form-action 'self'`, axe on the open dialog, and which of
 * the page's stylesheets already style it. Behaviour: ./editorSaveDialog.browser.int.test.ts.
 *
 * Found: serverPages.css and the HVL H5P theme already give plain buttons in the top document the token look and
 * the two-tone ring; the <dialog> box itself keeps the browser's CanvasText/Canvas colours and a 10 % black
 * backdrop until a stylesheet sets them, and `::backdrop` can use the tokens on :root.
 *
 * Spec: PROD-013, UD-030, UD-004
 */
import { AxeBuilder } from '@axe-core/playwright';
import type { Frame } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { describeWithBrowser } from '../../support/browser.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import {
  eventually,
  openByKeyboard,
  openByMouse,
  openDialogBench,
  openEditorWithProbe,
  type DialogBench,
} from './editorSaveDialogBench.js';
import { focusIn, linkProbeStyles, probeLog } from './editorSaveDialogPage.js';

/** UD-030's rule tags, as apps/server/a11y/support/axeScan.ts runs them. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const CANCEL = 'hvl-save-choice-cancel';

/** The computed look of the dialog, its backdrop and its focused button. */
const lookOf = (frame: Frame) =>
  frame.evaluate(() => {
    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    const box = getComputedStyle(dialog);
    const backdrop = getComputedStyle(dialog, '::backdrop');
    const focused = getComputedStyle(document.activeElement as Element);
    return {
      dialog: {
        color: box.color,
        background: box.backgroundColor,
        border: box.borderTop,
        font: box.fontFamily,
      },
      backdrop: { background: backdrop.backgroundColor, opacity: backdrop.opacity },
      button: {
        background: focused.backgroundColor,
        color: focused.color,
        minHeight: focused.minHeight,
        ring: [focused.outlineStyle, focused.outlineWidth, focused.outlineColor, focused.outlineOffset],
        inner: focused.boxShadow,
      },
    };
  });

/** The stylesheets of the top document that have a `:focus-visible` rule, by file name. */
const focusRingSheets = (frame: Frame) =>
  frame.evaluate(() =>
    [...document.styleSheets]
      .filter((sheet) =>
        [...sheet.cssRules].some(
          (rule) => rule instanceof CSSStyleRule && rule.selectorText === ':focus-visible',
        ),
      )
      .map((sheet) => (sheet.href ?? 'inline').split('?')[0]?.split('/').at(-1)),
  );

describeWithServices('[PROD-013] the save choice dialog’s look in the editor page (probe P7)', () => {
  describeWithRealPackages('[PROD-013] the real editor page in the portal', () => {
    let bench: DialogBench;
    beforeAll(async () => {
      bench = await openDialogBench();
    }, 180_000);
    afterAll(() => bench?.close());

    describeWithBrowser('[UD-030] the open dialog in Chromium', (browser) => {
      it('[PROD-013] after a mouse click «Avbryt» has focus but no :focus-visible; a :focus rule shows the ring', async () => {
        // Arrange
        const probe = await openEditorWithProbe(browser(), bench);
        // Act
        await openByMouse(probe);
        const byMouse = await focusIn(probe.frame);
        await probe.page.click('#hvl-save-choice-copy');
        await eventually(() => probeLog(probe.frame)).toEqual({ log: ['close:copy'], results: ['copy'] });
        await openByMouse(probe, { focusVisible: true });
        const asked = await focusIn(probe.frame);
        const unstyled = await lookOf(probe.frame);
        expect(await linkProbeStyles(probe.frame)).toBe(true);
        const styled = await lookOf(probe.frame);
        // Assert: `method="dialog"` closes without navigating, so `form-action 'self'` does not stop it
        expect(probe.csp).toContain("form-action 'self'");
        expect(byMouse).toEqual({ at: CANCEL, visible: false });
        // Chromium 141 ignores focus({ focusVisible: true }); only a `:focus` rule can show the ring here
        expect(asked).toEqual({ at: CANCEL, visible: false });
        expect(unstyled.button).toMatchObject({
          ring: ['none', '0px', 'rgb(255, 255, 255)', '0px'],
          inner: 'none',
        });
        expect(styled.button).toMatchObject({ ring: ['solid', '3px', 'rgb(0, 67, 87)', '2px'] });
        expect(styled.button.inner).toBe('rgb(255, 255, 255) 0px 0px 0px 2px');
        await probe.close();
      }, 90_000);

      it('[UD-030] axe finds no WCAG 2.2 A or AA violation in the open dialog, unstyled or with the token stylesheet', async () => {
        // Arrange
        const probe = await openEditorWithProbe(browser(), bench);
        await openByKeyboard(probe);
        const axe = () =>
          new AxeBuilder({ page: probe.page }).withTags(WCAG_TAGS).include('#hvl-save-choice').analyze();
        // Act
        const unstyled = await axe();
        expect(await linkProbeStyles(probe.frame)).toBe(true);
        const styled = await axe();
        // Assert: `aria-dialog-name` is a best-practice rule, outside these tags (the name: the AX tree test)
        expect(unstyled.violations).toEqual([]);
        expect(styled.violations).toEqual([]);
        expect(styled.passes.map((rule) => rule.id)).toEqual(
          expect.arrayContaining(['button-name', 'color-contrast', 'target-size']),
        );
        await probe.close();
      }, 90_000);

      it('[UD-004] the page’s stylesheets give the buttons the token look and two-tone ring; the box and backdrop need a sheet', async () => {
        // Arrange
        const probe = await openEditorWithProbe(browser(), bench);
        await openByKeyboard(probe);
        await probe.page.keyboard.press('Shift+Tab');
        // Act
        const sheets = await focusRingSheets(probe.frame);
        const before = await lookOf(probe.frame);
        expect(await linkProbeStyles(probe.frame)).toBe(true);
        const after = await lookOf(probe.frame);
        // Assert: #004357 outer ring, white inner ring, from the page's own sheets
        expect(probe.csp).toContain("style-src 'self' 'unsafe-inline'");
        expect(sheets).toEqual(['hvl-h5p-theme.css', 'serverPages.css']);
        expect(before.button).toEqual({
          background: 'rgb(0, 67, 87)',
          color: 'rgb(255, 255, 255)',
          minHeight: '24px',
          ring: ['solid', '3px', 'rgb(0, 67, 87)', '2px'],
          inner: 'rgb(255, 255, 255) 0px 0px 0px 2px',
        });
        // The browser's own dialog rules: CanvasText on Canvas, a black border, a 10 % black backdrop
        expect(before.dialog).toEqual({
          color: 'rgb(0, 0, 0)',
          background: 'rgb(255, 255, 255)',
          border: '3px solid rgb(0, 0, 0)',
          font: 'Arial, "Helvetica Neue", Helvetica, sans-serif',
        });
        expect(before.backdrop).toEqual({ background: 'rgba(0, 0, 0, 0.1)', opacity: '1' });
        // A linked sheet styles the box and ::backdrop with tokens (--hvl-ink #111, --hvl-primary-dark #004357)
        expect(after.dialog).toMatchObject({ color: 'rgb(17, 17, 17)', border: '2px solid rgb(0, 67, 87)' });
        expect(after.backdrop).toEqual({ background: 'rgb(17, 17, 17)', opacity: '0.6' });
        expect(after.button).toEqual(before.button);
        await probe.close();
      }, 90_000);
    });
  });
});
