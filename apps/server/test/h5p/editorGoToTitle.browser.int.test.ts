/**
 * Browser tests for "Gå til feltet" on a title in the real H5P editor (PROD-003, D-086): V-PLACEHOLDER names the
 * activity's title (`metadata.title`) and each sub-content's (`<node>.metadata.title`), which H5P keeps in its
 * metadata form rather than among the content's fields. The activity's title field, a sub-content's extra title
 * field (also inside an InteractiveVideo interaction's form), and the metadata popup of a sub-content without one
 * take focus; a sub-content whose library turns metadata off has no title in the editor, and the status says so.
 * Where a custom editor keeps a sub-content's form out of reach (a BranchingScenario node, a CoursePresentation
 * slide element), its title falls back like its other fields: the closest part takes focus and the status says so.
 *
 * Spec: PROD-003, UD-006, PROD-001
 */
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { Frame } from 'playwright-core';
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
  postGoToField as goTo,
  serveFrameHost,
} from './support/editorFrameHost.js';

/** Whether focus is in the metadata popup H5P opens over the form. */
const inPopup = (editor: Frame) =>
  editor.evaluate(() => document.activeElement?.closest('.h5p-metadata-popup-overlay') !== null);

/** The value of the focused control in H5P's editor frame (a title field's text). */
const focusedValue = (editor: Frame) =>
  editor.evaluate(() => (document.activeElement as HTMLInputElement | null)?.value);

/** The stored titles of an activity: the one a finding's path names, and the activity's own. */
async function storedTitles(base: string, author: TestActor, contentId: string, path: string) {
  const headers = { [author.header[0]]: author.header[1] };
  const stored = (await (await fetch(`${base}/h5p/params/${contentId}`, { headers })).json()) as {
    params: { params: unknown; metadata: { title?: unknown } };
  };
  const tokens = path.split(/[.[\]]+/).filter(Boolean);
  const from = tokens[0] === 'metadata' ? stored.params : stored.params.params;
  const named = tokens.reduce<unknown>((at, key) => (at as Record<string, unknown> | undefined)?.[key], from);
  return { named, activity: stored.params.metadata.title };
}

/** Gives an InteractiveVideo a link interaction (H5P.Link turns metadata off) after its first one. */
async function addLinkInteraction(base: string, author: TestActor, contentId: string): Promise<void> {
  const headers = { [author.header[0]]: author.header[1], 'content-type': 'application/json' };
  const stored = (await (await fetch(`${base}/h5p/params/${contentId}`, { headers })).json()) as {
    library: string;
    params: { params: { interactiveVideo: { assets: { interactions: Record<string, unknown>[] } } } };
  };
  const interactions = stored.params.params.interactiveVideo.assets.interactions;
  const action = {
    library: 'H5P.Link 1.3',
    params: { title: 'Kjelde', linkWidget: { protocol: 'https://', url: 'hvl.no' } },
    subContentId: randomUUID(),
    metadata: { title: '⟦Tittel⟧', license: 'U' },
  };
  interactions.push({ ...interactions[0], action, label: '' });
  const body = JSON.stringify({ library: stored.library, params: stored.params });
  const saved = await fetch(`${base}/h5p/content/${contentId}`, { method: 'PUT', headers, body });
  if (!saved.ok) throw new Error(`adding the link interaction failed: ${saved.status}`);
}

describeWithServices('the editor page and "Gå til feltet" on a title', () => {
  describeWithRealPackages('[PROD-003] go to a title in the real editor', () => {
    let tb: HttpTestbed;
    let base: string;
    let author: TestActor;
    const ids: Record<string, string> = {};
    beforeAll(async () => {
      tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
      author = await tb.actor('author');
      const types = ['MultiChoice', 'CoursePresentation', 'Column', 'QuestionSet', 'InteractiveBook'];
      for (const type of [...types, 'ImageHotspots', 'BranchingScenario']) {
        ids[type] = await tb.importPackage(author, join(REAL_PACKAGES_DIR, `H5P.${type}.h5p`));
      }
      ids.InteractiveVideo = await tb.importPackage(
        author,
        join(REAL_PACKAGES_DIR, 'H5P.InteractiveVideo.h5p'),
      );
      serveFrameHost(tb.app);
      base = await listenOnLoopback(tb.app);
      await addLinkInteraction(base, author, ids.InteractiveVideo);
    }, 180_000);
    afterAll(async () => {
      await closeLoopbackServers();
      await tb?.close();
    });

    describeWithBrowser('[UD-006] focus moves to the title', (browser) => {
      it.each([
        ['MultiChoice', 'metadata.title', 'field-name-extraTitle', false],
        ['CoursePresentation', 'metadata.title', 'field-name-extraTitle', false],
        ['Column', 'content[2].content.metadata.title', 'field-name-extraTitle', false],
        ['Column', 'content[0].content.metadata.title', 'field-name-title', true],
        ['QuestionSet', 'questions[1].metadata.title', 'field-name-extraTitle', false],
        ['InteractiveBook', 'chapters[1].metadata.title', 'field-name-extraTitle', false],
        ['ImageHotspots', 'hotspots[0].content[0].metadata.title', 'field-name-title', true],
        [
          'InteractiveVideo',
          'interactiveVideo.assets.interactions[0].action.metadata.title',
          'field-name-extraTitle',
          false,
        ],
      ])(
        '[PROD-003] %s: %s focuses its title',
        async (type, path, fieldClass, popup) => {
          // Arrange
          const page = await browser().newPage();
          const { editorPage, editor } = await openFramedEditor(page, base, author, ids[type] ?? '');
          const titles = await storedTitles(base, author, ids[type] ?? '', path);
          // Act
          await goTo(page, path);
          // Assert
          await expect
            .poll(() => focusedField(editor), { timeout: 30_000 })
            .toMatchObject({ field: fieldClass });
          expect(await inPopup(editor)).toBe(popup);
          // WHY: the field class alone would also match another node's title, or the activity's own.
          expect(typeof titles.named).toBe('string');
          if (path !== 'metadata.title') expect(titles.named).not.toBe(titles.activity);
          expect(await focusedValue(editor)).toBe(titles.named);
          expect(await editorPage.textContent('#hvl-editor-status')).toBe('');
          await page.close();
        },
        90_000,
      );

      it('[UD-006] a sub-content whose library turns metadata off: the closest part takes focus, and the status says why', async () => {
        // Arrange
        const page = await browser().newPage();
        const { editorPage, editor } = await openFramedEditor(page, base, author, ids.InteractiveVideo ?? '');
        // Act
        await goTo(page, 'interactiveVideo.assets.interactions[1].action.metadata.title');
        // Assert
        await expect
          .poll(() => editorPage.textContent('#hvl-editor-status'), { timeout: 30_000 })
          .toBe(t('page.editor.titleNotReached', {}, 'nn'));
        expect(await editor.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
        await page.close();
      }, 90_000);

      it.each([
        ['BranchingScenario', 'branchingScenario.content[0].type.metadata.title'],
        ['CoursePresentation', 'presentation.slides[0].elements[0].action.metadata.title'],
      ])(
        '[UD-006] %s keeps %s in its own editor: the closest part takes focus, and the status says so',
        async (type, path) => {
          // Arrange
          const page = await browser().newPage();
          const { editorPage, editor } = await openFramedEditor(page, base, author, ids[type] ?? '');
          // Act
          await goTo(page, path);
          // Assert: never silent, and not the title-less wording, since the title can be changed by hand there
          await expect
            .poll(() => editorPage.textContent('#hvl-editor-status'), { timeout: 30_000 })
            .toBe(t('page.editor.fieldNotReached', {}, 'nn'));
          expect(await editor.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');
          await page.close();
        },
        90_000,
      );
    });
  });
});
