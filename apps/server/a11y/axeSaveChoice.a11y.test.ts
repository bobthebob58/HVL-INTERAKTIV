/**
 * axe on the editor's save choice dialog (PROD-013, D-093) as an author meets it: the activity page's **Rediger** tab
 * on a draft MultiChoice another learner has saved progress in, an option added in H5P's form, «Lagre» pressed, and
 * the dialog open. The whole page is scanned with every frame, in the light theme and with forced colours emulated;
 * only the recorded H5P upstream problems of the MultiChoice editor may remain.
 *
 * Spec: UD-030, PROD-013, UD-004
 */
import type { Frame } from 'playwright-core';
import { describe, expect, it } from 'vitest';
import { newLearner } from '../test/support/learnerStateFixtures.js';
import { addOption } from '../test/learningDesign/safeEditing/saveChoiceBench.js';
import { describeA11y } from './support/a11ySuite.js';
import { scanPage } from './support/axeScan.js';
import { COLOUR_MODES } from './support/catalogue.js';
import { editorFrame } from './support/pages.js';
import { expectOnlyRecorded, recordedFor } from './support/upstreamFindings.js';
import { openView } from './support/views.js';

/** Presses «Lagre» in the editor page until the save choice is open (a click H5P's resizing moved is repeated). */
async function openSaveChoice(tool: Frame): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    await tool.click('#hvl-editor-save', { timeout: 5_000 }).catch(() => undefined);
    const opened = await tool
      .locator('dialog[open]')
      .waitFor({ timeout: 10_000 })
      .then(
        () => true,
        () => false,
      );
    if (opened) return;
  }
  throw new Error('the save choice did not open');
}

describeA11y('[UD-030] axe on the editor’s save choice dialog', (env) => {
  describe.each(COLOUR_MODES)('%s', (mode, forcedColors) => {
    it('[UD-030] the open dialog on the activity page has only recorded upstream problems', async () => {
      // Arrange: another learner's progress makes the structural save ask
      const { app, browser } = env();
      const contentId = app.draftId;
      const row = await app.tb.db.h5PUserData.create({
        data: { contentId, dataType: 'state', learnerKey: newLearner(), contextId: 'a11y', data: '{}' },
      });
      const context = await browser.newContext({ forcedColors, storageState: app.authorStorage });
      // WHY: the shared draft must not keep the other learner's row when an assertion fails, or a later suite's
      // structural save would be asked too.
      try {
        const page = await openView(app, context, { kind: 'activity', tab: 'edit' }, { contentId });
        const form = await editorFrame(page);
        const tool = form.parentFrame();
        if (!tool) throw new Error('the editor page has no frame of its own');
        await addOption(form);
        // Act
        await openSaveChoice(tool);
        const report = await scanPage(page, `${mode}, the save choice dialog`);
        // Assert
        expect(await tool.evaluate(() => document.activeElement?.id)).toBe('hvl-save-choice-cancel');
        expectOnlyRecorded(
          report,
          recordedFor('editor', 'H5P.MultiChoice', { forced: forcedColors === 'active' }),
        );
      } finally {
        await context.close();
        await app.tb.db.h5PUserData.deleteMany({ where: { id: row.id } });
      }
    });
  });
});
