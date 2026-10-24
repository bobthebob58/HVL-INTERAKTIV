/**
 * Browser tests for "Gå til feltet" in the real H5P editor (D-078) in the cases the step-by-step tests do not reach:
 * a path posted on the editor page's load event, in a fresh browser where BranchingScenario's guided tour has never
 * been closed (as the web app posts it when the Rediger tab first mounts); a path that ends at a list (QuestionSet's
 * questions, ImageHotspots' hotspots, Column's content), whose wrapper H5P gives no `field-name-` class; and a field
 * that is reached after one that was not, where the earlier "not reached" status must not stay on screen.
 *
 * Spec: PROD-003, UD-006, UD-013
 */
import { join } from 'node:path';
import type { Frame, Page } from 'playwright-core';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { t } from '../../src/i18n/translate.js';
import { describeWithBrowser } from '../support/browser.js';
import { closeLoopbackServers, listenOnLoopback } from '../support/loopbackServers.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../support/httpTestbed.js';
import { describeWithRealPackages, REAL_PACKAGES_DIR } from '../support/realPackages.js';
import { describeWithServices } from '../support/services.js';
import {
  focusedField,
  openFramedEditor,
  openFramedEditorAndGoTo,
  postGoToField,
  serveFrameHost,
} from './support/editorFrameHost.js';

const status = (editorPage: Frame) => editorPage.textContent('#hvl-editor-status');
/** BranchingScenario's guided tours still up, and the parts of its editor they keep inert. */
const tourLeft = (editor: Frame) =>
  editor.evaluate(() => document.querySelectorAll('.bswrapper .tour-button, .bswrapper [inert]').length);

describeWithServices('the editor page and "Gå til feltet", early and at a list', () => {
  describeWithRealPackages('[PROD-003] go to a finding’s field before the form exists, and to a list', () => {
    let tb: HttpTestbed;
    let base: string;
    let author: TestActor;
    const ids: Record<string, string> = {};
    beforeAll(async () => {
      tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
      author = await tb.actor('author');
      for (const type of ['BranchingScenario', 'QuestionSet', 'ImageHotspots', 'Column', 'MultiChoice']) {
        ids[type] = await tb.importPackage(author, join(REAL_PACKAGES_DIR, `H5P.${type}.h5p`));
      }
      // WHY: the web app frames the editor on the same origin; this empty page stands in for it.
      serveFrameHost(tb.app);
      base = await listenOnLoopback(tb.app);
    }, 180_000);
    afterAll(async () => {
      await closeLoopbackServers();
      await tb?.close();
    });
    const openFramed = (page: Page, type: string) => openFramedEditor(page, base, author, ids[type] ?? '');

    describeWithBrowser('[UD-006] focus moves to the field', (browser) => {
      // WHY: the tour used to show between following the path and focusing it in some runs only, so it runs four times.
      it.each([
        ['branchingScenario.startScreen.startScreenAltText', 'field-name-startScreenAltText', 1],
        ['branchingScenario.startScreen.startScreenAltText', 'field-name-startScreenAltText', 2],
        ['branchingScenario.startScreen.startScreenAltText', 'field-name-startScreenAltText', 3],
        ['branchingScenario.behaviour.enableBackwardsNavigation', 'field-name-enableBackwardsNavigation', 4],
      ])(
        '[PROD-003] BranchingScenario: %s, posted while the editor loads and its tour is unseen, focuses %s (run %i)',
        async (path, fieldClass) => {
          // Arrange
          const page = await browser().newPage();
          // Act
          const { editorPage, editor } = await openFramedEditorAndGoTo(
            page,
            base,
            author,
            ids.BranchingScenario ?? '',
            path,
          );
          // Assert
          await expect
            .poll(() => focusedField(editor), { timeout: 30_000 })
            .toMatchObject({ field: fieldClass });
          expect(await status(editorPage)).toBe('');
          expect(await tourLeft(editor)).toBe(0);
          await page.close();
        },
        90_000,
      );

      it.each([
        ['QuestionSet', 'questions'],
        ['ImageHotspots', 'hotspots'],
        ['Column', 'content'],
      ])(
        '[PROD-003] %s: a finding on the list %s focuses a control of that list',
        async (type, list) => {
          // Arrange
          const page = await browser().newPage();
          const { editorPage, editor } = await openFramed(page, type);
          // Act
          await postGoToField(page, list);
          // Assert
          await expect.poll(() => focusedField(editor), { timeout: 30_000 }).toMatchObject({ list });
          expect(await status(editorPage)).toBe('');
          await page.close();
        },
        90_000,
      );

      it('[UD-013] a field reached after one that was not leaves no "not reached" status', async () => {
        // Arrange: the answer list has no tenth answer, so that path stops at the list
        const page = await browser().newPage();
        const { editorPage, editor } = await openFramed(page, 'MultiChoice');
        await postGoToField(page, 'answers[9].text');
        await expect
          .poll(() => status(editorPage), { timeout: 30_000 })
          .toBe(t('page.editor.fieldNotReached', {}, 'nn'));
        expect(await focusedField(editor)).toMatchObject({ list: 'answers' });
        // Act
        await postGoToField(page, 'answers[1].text');
        // Assert
        await expect
          .poll(() => focusedField(editor), { timeout: 30_000 })
          .toMatchObject({ field: 'field-name-text' });
        await page.waitForTimeout(500);
        expect(await status(editorPage)).toBe('');
        await page.close();
      }, 90_000);
    });
  });
});
