/**
 * Probe P7 (S5): the save choice of PROD-013 as a native modal <dialog> in the real editor page (portal), under the
 * page's strict policy (D-070, D-093). This file: how the dialog's code reaches the page, showModal, initial focus
 * on «Avbryt», Escape, focus return, Tab and Shift+Tab, and what the open dialog makes inert. Its look, axe and the
 * focus ring: ./editorSaveDialogLook.browser.int.test.ts; inside Canvas's frame:
 * ./editorSaveDialogCanvas.browser.int.test.ts.
 *
 * Found: the policy refuses inline script but not DevTools evaluation, so the dialog's code must be a same-origin
 * file. Natively, Tab leaves the document after the last button: here, opened as the top page, to the browser; in
 * the frame authors always use, to the page around it (./editorSaveDialogCanvas.browser.int.test.ts). Focus returns
 * to the opener only if the opener is still enabled, which editorPage.js's save button is not while its request
 * runs; a script inside the inert H5P editor iframe can still take focus, after which Escape misses the dialog; and
 * 'close' is a queued task, so nothing is logged right after close().
 *
 * Spec: PROD-013, UD-006
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { t } from '../../../src/i18n/translate.js';
import { describeWithBrowser } from '../../support/browser.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import {
  openByKeyboard,
  openDialogBench,
  openEditorWithProbe,
  type DialogBench,
} from './editorSaveDialogBench.js';
import { exposedNodes, focusIn, focusWalk, probeLog, SAVE_CHOICE_TEXTS } from './editorSaveDialogPage.js';

const CANCEL = 'hvl-save-choice-cancel';
const SAVE = 'hvl-editor-save';
/** The dialog as assistive technology sees it: its name, form, heading, text and three buttons, and nothing else. */
const DIALOG_NODES = [
  `dialog:${SAVE_CHOICE_TEXTS.title}`,
  // WHY: the unnamed `method="dialog"` form.
  'generic:',
  `heading:${SAVE_CHOICE_TEXTS.title}`,
  'paragraph:',
  'paragraph:',
  ...SAVE_CHOICE_TEXTS.choices.map((c) => `button:${c.label}`),
];

describeWithServices('[PROD-013] the save choice dialog in the editor page (probe P7)', () => {
  describeWithRealPackages('[PROD-013] the real editor page in the portal', () => {
    let bench: DialogBench;
    beforeAll(async () => {
      bench = await openDialogBench();
    }, 180_000);
    afterAll(() => bench?.close());

    describeWithBrowser('[UD-006] a native <dialog> under the strict page policy', (browser) => {
      it('[PROD-013] the policy refuses an inline script, while a same-origin script file runs', async () => {
        // Arrange
        const probe = await openEditorWithProbe(browser(), bench);
        // Act: an inline <script> added the way any page script would add one
        const inline = await probe.frame.evaluate(async () => {
          const refused: string[] = [];
          document.addEventListener('securitypolicyviolation', (e) => refused.push(e.violatedDirective));
          const script = document.createElement('script');
          script.textContent = 'window.hvliProbeInlineRan = true;';
          document.head.append(script);
          await new Promise((resolve) => setTimeout(resolve, 100));
          return { ran: 'hvliProbeInlineRan' in window, refused };
        });
        // Assert: the probe file (loaded by openEditorWithProbe) ran under the same policy. WHY: page.evaluate is
        // DevTools evaluation, which no page policy governs (it ran above), so it cannot stand in for a page script.
        expect(probe.csp).toMatch(/script-src 'self' 'sha256-[^']+'(;| )/);
        expect(probe.csp).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);
        expect(inline).toEqual({ ran: false, refused: ['script-src-elem'] });
        expect(await probe.frame.evaluate(() => 'hvliProbeSaveChoice' in window)).toBe(true);
        await probe.close();
      }, 90_000);

      it('[PROD-013] showModal opens the choice with focus on «Avbryt»; Escape fires cancel, closes and returns focus', async () => {
        // Arrange
        const probe = await openEditorWithProbe(browser(), bench);
        // Act
        await openByKeyboard(probe);
        const opened = await probe.frame.evaluate(() => document.querySelector('dialog')?.matches(':modal'));
        const initial = await focusIn(probe.frame);
        await probe.page.keyboard.press('Escape');
        await expect
          .poll(() => probeLog(probe.frame))
          .toEqual({ log: ['cancel', 'close:'], results: ['cancel'] });
        // Assert
        expect(opened).toBe(true);
        expect(initial).toEqual({ at: CANCEL, visible: true });
        expect(await focusIn(probe.frame)).toEqual({ at: SAVE, visible: true });
        expect(await probe.page.locator('dialog').count()).toBe(0);
        expect(probe.saves).toEqual([]);
        await probe.close();
      }, 90_000);

      it('[UD-006] natively, Tab leaves the document after the last button; with wrapping it stays in the dialog', async () => {
        // Arrange
        const probe = await openEditorWithProbe(browser(), bench);
        const { page, frame } = probe;
        // Act
        await openByKeyboard(probe);
        const nativeTab = await focusWalk(page, frame, 'Tab', 4);
        const nativeShiftTab = await focusWalk(page, frame, 'Shift+Tab', 4);
        await page.keyboard.press('Escape');
        // WHY: 'close' is a queued task after Escape; the probe removes the old dialog only then.
        await expect.poll(() => probeLog(frame).then((l) => l.results)).toEqual(['cancel']);
        await openByKeyboard(probe, { wrapTab: true });
        const wrappedTab = await focusWalk(page, frame, 'Tab', 3);
        const wrappedShiftTab = await focusWalk(page, frame, 'Shift+Tab', 3);
        // Assert: BODY is the stop outside the document (the browser's own controls, as this is the top page)
        const [reset, copy, cancel] = SAVE_CHOICE_TEXTS.choices.map((c) => `hvl-save-choice-${c.value}`);
        expect(nativeTab).toEqual(['BODY', reset, copy, cancel]);
        expect(nativeShiftTab).toEqual([copy, reset, 'BODY', cancel]);
        expect(wrappedTab).toEqual([reset, copy, cancel]);
        expect(wrappedShiftTab).toEqual([copy, reset, cancel]);
        await probe.close();
      }, 90_000);

      it('[PROD-013] while open, the page and the H5P editor iframe are out of reach of pointer and assistive technology', async () => {
        // Arrange
        const probe = await openEditorWithProbe(browser(), bench);
        // WHY: H5P adds the form's fields after `.h5peditor-form` appears (more slowly on CI runners), so the control
        // waits until the alt-text field is in the tree before it reads the tree.
        await expect
          .poll(() => exposedNodes(probe.page), { timeout: 20_000 })
          .toContain('textbox:Alternativ tekst*');
        const before = await exposedNodes(probe.page);
        // Act
        await openByKeyboard(probe);
        const hits = await probe.frame.evaluate(() =>
          ['#hvl-editor-save', 'iframe.h5p-editor-iframe'].map((selector) => {
            const element = document.querySelector(selector);
            // WHY: H5P resizes its iframe as the form grows, so the element is scrolled into view before hit-testing.
            element?.scrollIntoView({ block: 'center' });
            const box = element?.getBoundingClientRect();
            return box ? document.elementFromPoint(box.left + 5, Math.max(box.top, 0) + 5)?.id : 'missing';
          }),
        );
        const exposed = await exposedNodes(probe.page);
        // Assert
        expect(hits).toEqual(['hvl-save-choice', 'hvl-save-choice']);
        // The control: while closed, the save button and the editor's fields (in its frame) are exposed
        expect(before).toContain(`button:${t('page.editor.save', {}, 'nn')}`);
        expect(before).toContain('textbox:Alternativ tekst*');
        expect(exposed).toEqual(DIALOG_NODES);
        await probe.close();
      }, 90_000);

      it('upstream pin: a script in the inert editor iframe can still take focus, and Escape then misses the dialog', async () => {
        // Arrange
        const probe = await openEditorWithProbe(browser(), bench);
        const editor = probe.page.frames().find((f) => f.parentFrame() === probe.frame);
        if (!editor) throw new Error('no editor frame');
        const takeFocus = () =>
          editor.evaluate(() => {
            const field = document.querySelector<HTMLElement>('.h5peditor-form input');
            field?.focus();
            return document.activeElement === field;
          });
        // Act: Chromium 141 does not keep focus out of an inert frame's document
        await openByKeyboard(probe);
        const taken = await takeFocus();
        await probe.page.keyboard.press('Escape');
        const afterEscape = await probe.frame.evaluate(() => document.querySelector('dialog')?.open);
        // WHY: 'close' is a queued task, so right after close() the probe has logged nothing yet.
        const rightAfterClose = await probe.frame.evaluate(() => {
          document.querySelector('dialog')?.close();
          return [
            ...(window as unknown as { hvliProbeSaveChoice: { log: string[] } }).hvliProbeSaveChoice.log,
          ];
        });
        await openByKeyboard(probe, { guardFrameFocus: true });
        await takeFocus();
        await expect.poll(() => focusIn(probe.frame).then((f) => f.at)).toBe(CANCEL);
        await probe.page.keyboard.press('Escape');
        // Assert
        expect(taken).toBe(true);
        expect(afterEscape).toBe(true);
        expect(rightAfterClose).toEqual([]);
        await expect.poll(() => probeLog(probe.frame).then((l) => l.log.at(-2))).toBe('cancel');
        await probe.close();
      }, 90_000);

      it('[PROD-013] focus does not return to a save button disabled while it saves; the script must focus it', async () => {
        // Arrange
        const probe = await openEditorWithProbe(browser(), bench);
        // Act: as editorPage.js's save() does, the button is disabled when the dialog opens
        await openByKeyboard(probe, { disableOpener: true });
        await probe.page.keyboard.press('Escape');
        await expect.poll(() => probeLog(probe.frame).then((l) => l.results)).toEqual(['cancel']);
        const native = await focusIn(probe.frame);
        await openByKeyboard(probe, { disableOpener: true, restoreFocus: true });
        await probe.page.keyboard.press('Escape');
        await expect.poll(() => probeLog(probe.frame).then((l) => l.results.length)).toBe(2);
        // Assert
        expect(native).toEqual({ at: 'BODY', visible: false });
        expect(await focusIn(probe.frame)).toEqual({ at: SAVE, visible: true });
        await probe.close();
      }, 90_000);
    });
  });
});
