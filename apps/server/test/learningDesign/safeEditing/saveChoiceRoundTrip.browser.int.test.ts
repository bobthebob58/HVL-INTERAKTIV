/**
 * Browser tests of the save choice's real round trip in the portal (PROD-013, D-093): the editor page framed by a
 * page of ours as the activity page's Rediger tab frames it, the whole app, a real MultiChoice another learner has
 * saved progress in, and a structural edit made in H5P's own form. «Lagre» meets the 409, the dialog asks, and each
 * choice is carried out: reset (saved, state gone, version raised), save as a new version (a new draft, the framing
 * page told to open it) and «Avbryt» (nothing saved). While a reset or a copy runs the status region says so, and
 * afterwards «Lagre» has focus before the outcome is announced.
 * The keyboard: ./saveChoiceKeyboard.browser.int.test.ts; Canvas: ./saveChoiceCanvas.browser.int.test.ts.
 *
 * Spec: PROD-013, UD-006
 */
import type { Browser } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { saveChoiceMessages } from '../../../src/learningDesign/safeEditing/saveChoiceMessages.js';
import { describeWithBrowser } from '../../support/browser.js';
import { describeWithRealPackages } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import { eventually } from './editorSaveDialogBench.js';
import { askedSave } from './saveChoiceAsked.js';
import { focusedIn, type FramedEditor } from './saveChoiceBench.js';
import { openSafeEditingBench, type BenchActivity, type SafeEditingBench } from './safeEditingBench.js';

const TEXTS = saveChoiceMessages('nn', false);

describeWithServices('[PROD-013] the save choice’s round trip in the portal', () => {
  describeWithRealPackages('[PROD-013] a real activity with another learner’s progress', () => {
    let bench: SafeEditingBench;
    beforeAll(async () => {
      bench = await openSafeEditingBench();
    }, 240_000);
    afterAll(() => bench?.close());

    const structuralSave = (browser: () => Browser) => askedSave(browser(), bench);
    const lookOf = (editor: FramedEditor) =>
      editor.tool.evaluate(() => {
        const dialog = document.querySelector('dialog') as HTMLDialogElement;
        const backdrop = getComputedStyle(dialog, '::backdrop').opacity;
        return { border: getComputedStyle(dialog).borderTop, backdrop };
      });
    const answers = (params: unknown) => (params as { answers: unknown[] }).answers.length;
    const settled = (editor: FramedEditor, text: string) =>
      eventually(() => editor.statusLog().then((log) => log.find((entry) => entry.text === text)));
    const lastTexts = async (editor: FramedEditor) => (await editor.statusLog()).map((e) => e.text).slice(-2);

    describeWithBrowser('[UD-006] the dialog on the real editor page', (browser) => {
      it('[PROD-013] a structural save meets the 409, opens the dialog on «Avbryt», and the frame’s page is told', async () => {
        // Arrange and act
        const { mc, editor } = await structuralSave(browser);
        // Assert: nothing was saved, and the dialog stands in for the failure text
        expect(editor.requests.map((r) => [r.method, r.status])).toEqual([['PUT', 409]]);
        expect(await bench.stored(mc.id)).toMatchObject({ version: 1 });
        expect(await focusedIn(editor.tool)).toBe('hvl-save-choice-cancel');
        expect(await editor.tool.textContent('#hvl-editor-status')).toBe('');
        expect(await editor.tool.locator('#hvl-save-choice-title').textContent()).toBe(TEXTS.title);
        expect(await editor.messages()).toEqual([{ type: 'hvli:modal-open' }]);
        // UD-001: the dialog's own stylesheet gives the box and its backdrop the tokens (#004357, ink at 60 %)
        expect(await lookOf(editor)).toEqual({ border: '2px solid rgb(0, 67, 87)', backdrop: '0.6' });
        await editor.close();
      }, 180_000);

      it('[PROD-013] «Nullstill framgangen og lagre» saves, deletes the state, raises the version, then focuses «Lagre» and says so', async () => {
        // Arrange
        const { mc, editor, options } = await structuralSave(browser);
        // Act
        await editor.tool.click('#hvl-save-choice-reset');
        await settled(editor, TEXTS.resetAndSaved).toEqual({
          text: TEXTS.resetAndSaved,
          focus: 'hvl-editor-save',
        });
        // Assert
        expect(await lastTexts(editor)).toEqual([TEXTS.resetting, TEXTS.resetAndSaved]);
        const [first, retry] = editor.requests;
        expect([first?.status, retry?.status]).toEqual([409, 200]);
        expect(retry?.body).toEqual({ ...first?.body, confirmLearnerStateReset: true });
        const stored = await bench.stored(mc.id);
        expect([stored.version, answers(stored.params)]).toEqual([2, options]);
        expect(await bench.stateKeys(mc.id)).toEqual([]);
        expect(await editor.tool.locator('dialog').count()).toBe(0);
        expect(await focusedIn(editor.tool)).toBe('hvl-editor-save');
        expect(await editor.messages()).toEqual([
          { type: 'hvli:modal-open' },
          { type: 'hvli:modal-closed' },
          { type: 'hvli:content-saved', contentId: mc.id },
        ]);
        await editor.close();
      }, 180_000);

      it('[PROD-013] «Lagre som ny versjon» makes a new draft of the edit, keeps the original, and asks the page to open the copy', async () => {
        // Arrange
        const { mc, other, editor, options } = await structuralSave(browser);
        const before = await bench.stored(mc.id);
        // Act
        await editor.tool.click('#hvl-save-choice-copy');
        await settled(editor, TEXTS.savedAsCopy ?? '').toMatchObject({ focus: 'hvl-editor-save' });
        // Assert
        expect(await lastTexts(editor)).toEqual([TEXTS.copying, TEXTS.savedAsCopy]);
        const copy = editor.requests.at(-1);
        expect([copy?.method, copy?.path, copy?.status]).toEqual(['POST', `/h5p/content/${mc.id}/copy`, 201]);
        const copyId = await copyOf(bench, mc);
        const stored = await bench.tb.db.h5PContent.findUniqueOrThrow({ where: { id: copyId } });
        expect(stored).toMatchObject({ status: 'draft', visibility: 'private', sourceContentId: mc.id });
        expect(answers(stored.params)).toBe(options);
        expect(await bench.stored(mc.id)).toEqual(before);
        expect(await bench.stateKeys(mc.id)).toEqual([other]);
        expect((await editor.messages()).at(-1)).toEqual({ type: 'hvli:content-copied', contentId: copyId });
        await editor.close();
      }, 180_000);

      it('[PROD-013] «Avbryt» saves nothing, keeps the state, and gives focus back to «Lagre»', async () => {
        // Arrange
        const { mc, other, editor } = await structuralSave(browser);
        const before = await bench.stored(mc.id);
        // Act
        await editor.tool.click('#hvl-save-choice-cancel');
        await settled(editor, TEXTS.cancelled).toEqual({ text: TEXTS.cancelled, focus: 'hvl-editor-save' });
        // Assert
        expect(editor.requests.map((r) => r.status)).toEqual([409]);
        expect(editor.requests[0]?.body).not.toHaveProperty('confirmLearnerStateReset');
        expect(await bench.stored(mc.id)).toEqual(before);
        expect(await bench.stateKeys(mc.id)).toEqual([other]);
        expect(await editor.tool.isEnabled('#hvl-editor-save')).toBe(true);
        expect((await editor.messages()).at(-1)).toEqual({ type: 'hvli:modal-closed' });
        await editor.close();
      }, 180_000);
    });
  });
});

/** The ID of the one copy made of an activity. */
async function copyOf(bench: SafeEditingBench, source: BenchActivity): Promise<string> {
  const copies = await bench.tb.db.h5PContent.findMany({ where: { sourceContentId: source.id } });
  if (copies.length !== 1) throw new Error(`expected one copy of ${source.id}, found ${copies.length}`);
  return copies[0]?.id ?? '';
}
