/**
 * Browser test of the save choice by keyboard only (PROD-013, UD-006, D-093): «Lagre» pressed with Enter in the real
 * editor page framed as the Rediger tab frames it; focus starts on «Avbryt», Tab and Shift+Tab stay inside the
 * dialog (natively they would leave the frame for the page around it, probe P7), also after a click on its text, and
 * Escape cancels, saves nothing and gives focus back to «Lagre» before the outcome is announced. When a script in
 * the inert H5P editor iframe takes focus, the production guard (`hvliGuardFrameFocus` in editorSaveChoice.js) gives
 * it back to «Avbryt», so Escape still cancels. The mouse round trip: ./saveChoiceRoundTrip.browser.int.test.ts.
 *
 * Spec: PROD-013, UD-006
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { saveChoiceMessages } from '../../../src/learningDesign/safeEditing/saveChoiceMessages.js';
import { describeWithBrowser } from '../../support/browser.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import { eventually } from './editorSaveDialogBench.js';
import { askedSave } from './saveChoiceAsked.js';
import { focusedIn, type FramedEditor } from './saveChoiceBench.js';
import { openSafeEditingBench, type SafeEditingBench } from './safeEditingBench.js';

const TEXTS = saveChoiceMessages('nn', false);
const [RESET, COPY, CANCEL] = ['reset', 'copy', 'cancel'].map((value) => `hvl-save-choice-${value}`);

/** Presses `key` `times` times and records where focus is in the editor page after each press. */
const walk = async (editor: FramedEditor, key: string, times: number): Promise<string[]> => {
  const stops: string[] = [];
  for (let i = 0; i < times; i++) {
    await editor.page.keyboard.press(key);
    // WHY: focus that left the editor page would show as its frame element's absence there (BODY or the frame).
    const top = await editor.page.evaluate(() => document.activeElement?.id ?? 'none');
    stops.push(top === 'tool_content' ? await focusedIn(editor.tool) : `outside:${top}`);
  }
  return stops;
};

describeWithServices('[PROD-013] the save choice by keyboard', () => {
  describeWithRealPackages('[PROD-013] a real activity with another learner’s progress', () => {
    let bench: SafeEditingBench;
    beforeAll(async () => {
      bench = await openSafeEditingBench();
    }, 240_000);
    afterAll(() => bench?.close());

    describeWithBrowser('[UD-006] the dialog on the real editor page', (browser) => {
      it('[UD-006] Enter opens it on «Avbryt», Tab wraps inside it, and Escape cancels with focus back on «Lagre»', async () => {
        // Arrange
        const { mc, other, editor } = await askedSave(browser(), bench, 'keyboard');
        const before = await bench.stored(mc.id);
        // Act
        const initial = await focusedIn(editor.tool);
        const forward = await walk(editor, 'Tab', 3);
        const backward = await walk(editor, 'Shift+Tab', 3);
        await editor.page.keyboard.press('Escape');
        const log = () => editor.statusLog().then((l) => l.find((entry) => entry.text === TEXTS.cancelled));
        await eventually(log).toEqual({ text: TEXTS.cancelled, focus: 'hvl-editor-save' });
        // Assert
        expect(initial).toBe(CANCEL);
        expect(forward).toEqual([RESET, COPY, CANCEL]);
        expect(backward).toEqual([COPY, RESET, CANCEL]);
        expect(editor.requests.map((r) => r.status)).toEqual([409]);
        expect(await bench.stored(mc.id)).toEqual(before);
        expect(await bench.stateKeys(mc.id)).toEqual([other]);
        expect(await editor.tool.locator('dialog').count()).toBe(0);
        expect(await focusedIn(editor.tool)).toBe('hvl-editor-save');
        await editor.close();
      }, 180_000);

      it('[UD-006] when a script in the inert editor frame takes focus, it returns to «Avbryt» and Escape still cancels', async () => {
        // Arrange: Chromium lets a script inside the inert H5P iframe focus its own fields (probe P7, D-093 amendment)
        const { mc, other, editor } = await askedSave(browser(), bench, 'keyboard');
        const before = await bench.stored(mc.id);
        // Act
        const taken = await editor.form.evaluate(() => {
          const field = document.querySelector<HTMLElement>('.h5peditor-form input');
          field?.focus();
          return field !== null && document.activeElement === field;
        });
        // WHY: focus starts on «Avbryt», so only a wait after the field had taken it proves the guard.
        await eventually(() => focusedIn(editor.tool)).toBe(CANCEL);
        await editor.page.keyboard.press('Escape');
        const log = () => editor.statusLog().then((l) => l.find((entry) => entry.text === TEXTS.cancelled));
        await eventually(log).toEqual({ text: TEXTS.cancelled, focus: 'hvl-editor-save' });
        // Assert
        expect(taken).toBe(true);
        expect(editor.requests.map((r) => r.status)).toEqual([409]);
        expect(await bench.stored(mc.id)).toEqual(before);
        expect(await bench.stateKeys(mc.id)).toEqual([other]);
        expect(await editor.tool.locator('dialog').count()).toBe(0);
        await editor.close();
      }, 180_000);

      it('[UD-006] after a click on its text, Shift+Tab and Tab still stay inside the dialog', async () => {
        // Arrange: Chromium focuses the dialog itself on such a click, from where Shift+Tab would leave the frame
        const { editor } = await askedSave(browser(), bench);
        const stops: string[] = [];
        // Act
        for (const key of ['Shift+Tab', 'Tab']) {
          await editor.tool.click('#hvl-save-choice-text');
          stops.push(...(await walk(editor, key, 1)));
        }
        // Assert
        expect(stops).toEqual([CANCEL, RESET]);
        expect(await editor.tool.locator('dialog[open]').count()).toBe(1);
        await editor.close();
      }, 180_000);
    });
  });
});
