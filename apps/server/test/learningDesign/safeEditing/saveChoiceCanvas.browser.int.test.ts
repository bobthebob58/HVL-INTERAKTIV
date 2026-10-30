/**
 * Browser tests of the save choice in Canvas (PROD-013, D-093, D-098): `/lti/edit` framed by the mock Canvas's page
 * (another origin), the teacher's own activity another learner has progress in, and a structural edit in H5P's
 * form. The dialog offers reset or «Avbryt» only, with the pointer to the portal; Tab and Shift+Tab wrap inside it
 * instead of leaving for Canvas's page; reset by keyboard resends the save with the ltik as Bearer and the
 * confirmation; «Avbryt» saves nothing; Canvas's page is never posted to.
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
import { addOption, focusedIn, openFramedEditor, pressSave, type FramedEditor } from './saveChoiceBench.js';
import { openSafeEditingBench, type SafeEditingBench } from './safeEditingBench.js';

const TEXTS = saveChoiceMessages('nn', true);

describeWithServices('[PROD-013] the save choice in Canvas', () => {
  describeWithRealPackages('[PROD-013] the teacher’s own activity with another learner’s progress', () => {
    let bench: SafeEditingBench;
    let teacherId: string;
    beforeAll(async () => {
      bench = await openSafeEditingBench();
      // WHY: the teacher's first launch creates their Canvas account; activities are then made theirs.
      const first = await bench.launch(
        await bench.importExample('H5P.MultiChoice', { published: true }),
        'teacher',
      );
      teacherId = (await bench.tb.lti.resolveLtik(first)).principal.userId;
    }, 240_000);
    afterAll(() => bench?.close());

    /** The teacher's draft MultiChoice with another learner's state, its Canvas editor framed, an option added. */
    const askInCanvas = async (browser: () => Browser) => {
      const mc = await bench.importExample('H5P.MultiChoice');
      await bench.tb.db.h5PContent.update({ where: { id: mc.id }, data: { ownerUserId: teacherId } });
      const other = await bench.addOtherLearnersState(mc);
      const ltik = await bench.launch(mc, 'teacher');
      const editor = await openFramedEditor(browser(), {
        url: bench.tb.mock.canvas.origin,
        editorUrl: `${bench.tb.toolUrl}/lti/edit?ltik=${encodeURIComponent(ltik)}`,
      });
      await addOption(editor.form);
      await pressSave(editor);
      await editor.tool.locator('dialog[open]').waitFor({ timeout: 20_000 });
      return { mc, other, editor };
    };
    const settled = (editor: FramedEditor, text: string) =>
      eventually(() => editor.statusLog().then((log) => log.find((entry) => entry.text === text)));

    describeWithBrowser('[UD-006] the dialog in Canvas’s frame', (browser) => {
      it('[PROD-013] offers reset or «Avbryt» with the pointer, and reset by keyboard saves with the ltik and resets', async () => {
        // Arrange
        const { mc, editor } = await askInCanvas(browser);
        const buttons = await editor.tool.locator('dialog button').evaluateAll((all) => all.map((b) => b.id));
        // Act: Tab wraps from «Avbryt», the last button, to reset, the first
        await editor.page.keyboard.press('Tab');
        const onReset = await focusedIn(editor.tool);
        await editor.page.keyboard.press('Enter');
        await settled(editor, TEXTS.resetAndSaved).toEqual({
          text: TEXTS.resetAndSaved,
          focus: 'hvl-editor-save',
        });
        // Assert
        expect(buttons).toEqual(['hvl-save-choice-reset', 'hvl-save-choice-cancel']);
        expect(await editor.tool.locator('dialog').count()).toBe(0);
        expect(onReset).toBe('hvl-save-choice-reset');
        const [first, retry] = editor.requests;
        expect([first?.status, retry?.status, retry?.body.confirmLearnerStateReset]).toEqual([
          409,
          200,
          true,
        ]);
        expect(editor.requests.some((r) => r.path.endsWith('/copy'))).toBe(false);
        expect(await bench.stored(mc.id)).toMatchObject({ version: 2 });
        expect(await bench.stateKeys(mc.id)).toEqual([]);
        expect(await editor.messages()).toEqual([]);
        await editor.close();
      }, 180_000);

      it('[PROD-013] shows the pointer to the portal, and «Avbryt» saves nothing and keeps the state', async () => {
        // Arrange
        const { mc, other, editor } = await askInCanvas(browser);
        const before = await bench.stored(mc.id);
        const described = await editor.tool.getAttribute('dialog', 'aria-describedby');
        const pointer = await editor.tool.textContent('#hvl-save-choice-note');
        // Act: Shift+Tab from reset, the first button, wraps to «Avbryt» instead of leaving for Canvas's page
        const stops: string[] = [];
        for (let press = 0; press < 2; press++) {
          await editor.page.keyboard.press('Shift+Tab');
          // WHY: focus that left for Canvas's page shows there; the tool frame would still name its last button.
          const top = await editor.page.evaluate(() => document.activeElement?.id ?? 'none');
          stops.push(top === 'tool_content' ? await focusedIn(editor.tool) : `outside:${top}`);
        }
        await editor.tool.click('#hvl-save-choice-cancel');
        await settled(editor, TEXTS.cancelled).toEqual({ text: TEXTS.cancelled, focus: 'hvl-editor-save' });
        // Assert
        expect(stops).toEqual(['hvl-save-choice-reset', 'hvl-save-choice-cancel']);
        expect(described).toBe('hvl-save-choice-text hvl-save-choice-note');
        expect(pointer).toBe(TEXTS.canvasPointer);
        expect(editor.requests.map((r) => r.status)).toEqual([409]);
        expect(await bench.stored(mc.id)).toEqual(before);
        expect(await bench.stateKeys(mc.id)).toEqual([other]);
        await editor.close();
      }, 180_000);
    });
  });
});
