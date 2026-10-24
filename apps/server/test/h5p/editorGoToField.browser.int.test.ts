/**
 * Browser tests for "Gå til feltet" in the real H5P editor (D-078): a same-origin parent page posts
 * `hvli:go-to-field` with a finding path, and the editor page focuses that field inside H5P's editor frame, through
 * lists, sub-content, InteractiveBook pages, InteractiveVideo's interaction forms and BranchingScenario's settings,
 * again and again in one page (a rich-text field whose CKEditor is already open, an InteractiveVideo form open over
 * the field); where a custom editor hides the field (CoursePresentation's slides), the closest part takes focus and
 * the status says so; messages from any other window are ignored.
 *
 * Spec: PROD-003, UD-006
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
  addSecondInteraction,
  focusedField,
  openFramedEditor,
  postGoToField as goTo,
  serveFrameHost,
} from './support/editorFrameHost.js';

/** True when every open DragNBar sub-form still offers the author the first breadcrumb as the way back. */
const wayBackKept = (editor: Frame) =>
  editor.evaluate(() =>
    [...document.querySelectorAll('.form-manager:not(.root-form)')].every((manager) =>
      manager.querySelector('.form-manager-breadcrumb > .clickable:first-child'),
    ),
  );

/** The path of an InteractiveVideo interaction's question. */
const IV_QUESTION = (n: number) => `interactiveVideo.assets.interactions[${n}].action.params.question`;

describeWithServices('the editor page and "Gå til feltet"', () => {
  describeWithRealPackages('[PROD-003] go to a finding’s field in the real editor', () => {
    let tb: HttpTestbed;
    let base: string;
    let author: TestActor;
    const ids: Record<string, string> = {};
    beforeAll(async () => {
      tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
      author = await tb.actor('author');
      const types = ['Column', 'QuestionSet', 'MultiChoice', 'InteractiveBook', 'InteractiveVideo'];
      for (const type of [...types, 'BranchingScenario', 'CoursePresentation']) {
        ids[type] = await tb.importPackage(author, join(REAL_PACKAGES_DIR, `H5P.${type}.h5p`));
      }
      // WHY: the web app frames the editor on the same origin; this empty page stands in for it.
      serveFrameHost(tb.app);
      base = await listenOnLoopback(tb.app);
      await addSecondInteraction(base, author, ids.InteractiveVideo ?? '');
    }, 180_000);
    afterAll(async () => {
      await closeLoopbackServers();
      await tb?.close();
    });
    const openFramed = (page: Page, contentId: string) => openFramedEditor(page, base, author, contentId);

    describeWithBrowser('[UD-006] focus moves to the field', (browser) => {
      it.each([
        ['MultiChoice', 'answers[1].text', 'field-name-text'],
        ['MultiChoice', 'overallFeedback[0].feedback', 'field-name-feedback'],
        ['Column', 'content[0].content.params.text', 'field-name-text'],
        ['Column', 'content[1].content.params.alt', 'field-name-alt'],
        ['QuestionSet', 'questions[3].params.question', 'field-name-question'],
        ['InteractiveBook', 'chapters[0].params.content[1].content.params.question', 'field-name-question'],
        ['InteractiveBook', 'chapters[1].params.content[0].content.params.text', 'field-name-text'],
        ['InteractiveBook', 'bookCover.coverMedium.params.alt', 'field-name-alt'],
        ['InteractiveVideo', IV_QUESTION(0), 'field-name-question'],
        ['InteractiveVideo', 'interactiveVideo.summary.task', 'field-name-extraTitle'],
        [
          'BranchingScenario',
          'branchingScenario.startScreen.startScreenAltText',
          'field-name-startScreenAltText',
        ],
        [
          'BranchingScenario',
          'branchingScenario.behaviour.enableBackwardsNavigation',
          'field-name-enableBackwardsNavigation',
        ],
      ])(
        '[PROD-003] %s: %s focuses its field',
        async (type, path, fieldClass) => {
          // Arrange
          const page = await browser().newPage();
          const { editorPage, editor } = await openFramed(page, ids[type] ?? '');
          // Act
          await goTo(page, path);
          // Assert
          await expect
            .poll(() => focusedField(editor), { timeout: 30_000 })
            .toMatchObject({ field: fieldClass });
          expect(await editorPage.textContent('#hvl-editor-status')).toBe('');
          await page.close();
        },
        90_000,
      );

      it.each([
        [
          'CoursePresentation',
          'presentation.slides[0].elements[1].action.params.alt',
          'field-name-presentation',
        ],
        [
          'BranchingScenario',
          'branchingScenario.content[1].type.params.branchingQuestion',
          'field-name-extraTitle',
        ],
      ])(
        '[UD-006] %s: where the editor hides %s, its closest part takes focus and the status says so',
        async (type, path, fieldClass) => {
          // Arrange
          const page = await browser().newPage();
          const { editorPage, editor } = await openFramed(page, ids[type] ?? '');
          // Act
          await goTo(page, path);
          // Assert
          await expect
            .poll(() => editorPage.textContent('#hvl-editor-status'), { timeout: 30_000 })
            .toBe(t('page.editor.fieldNotReached', {}, 'nn'));
          expect(await focusedField(editor)).toMatchObject({ field: fieldClass });
          await page.close();
        },
        90_000,
      );

      // Each step: the path, the field that must take focus, whether in CKEditor's editable, how many messages.
      it.each([
        [
          'Column',
          [
            ['content[0].content.params.text', 'field-name-text', true, 2] as const,
            ['content[0].content.params.text', 'field-name-text', true, 1] as const,
          ],
        ],
        [
          'InteractiveVideo',
          [
            [IV_QUESTION(0), 'field-name-question', true, 1] as const,
            [IV_QUESTION(1), 'field-name-question', true, 1] as const,
            ['interactiveVideo.video.files', 'field-name-files', false, 1] as const,
            [IV_QUESTION(0), 'field-name-question', true, 1] as const,
            ['interactiveVideo.summary.task', 'field-name-extraTitle', false, 1] as const,
          ],
        ],
      ])(
        '[PROD-003] %s: one finding after another in the same page, each focuses its field',
        async (type, steps) => {
          // Arrange
          const page = await browser().newPage();
          const { editorPage, editor } = await openFramed(page, ids[type] ?? '');
          for (const [path, field, editable, messages] of steps) {
            // Act: focus starts outside the field, so each step must move it there
            await editor.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
            for (let sent = 0; sent < messages; sent += 1) await goTo(page, path);
            // Assert
            await expect
              .poll(() => focusedField(editor), { timeout: 30_000 })
              .toMatchObject({ field, editable });
            expect(await editorPage.textContent('#hvl-editor-status')).toBe('');
            expect(await wayBackKept(editor)).toBe(true);
          }
          await page.close();
        },
        240_000,
      );

      it('[UD-006] a message from the editor page itself, not its parent, moves nothing', async () => {
        // Arrange
        const page = await browser().newPage();
        const { editorPage, editor } = await openFramed(page, ids.MultiChoice ?? '');
        // Act
        await editorPage.evaluate(() =>
          window.postMessage({ type: 'hvli:go-to-field', path: 'answers[1].text' }, location.origin),
        );
        await page.waitForTimeout(1_000);
        // Assert
        expect((await focusedField(editor)).field).toBeNull();
        await page.close();
      }, 90_000);
    });
  });
});
