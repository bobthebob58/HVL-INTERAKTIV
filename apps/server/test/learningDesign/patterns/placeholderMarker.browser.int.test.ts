/**
 * Probe P6 (S5): the guidance marker `⟦…⟧` (D-086) through Lumi's sanitiser, the editor's save path, a package
 * import and H5P's real editor with CKEditor 5 loaded, on the real content types (D-078). The marker is written raw
 * and as decimal, hexadecimal and named references, in rich-text, plain text, textarea and list-item fields and in
 * the title. The tests pin how each one is stored and sent, and what a partly edited marker looks like, so that
 * V-PLACEHOLDER (W2) is built on facts. Found: every save stores ⟦ ⟧ raw (sanitize-html decodes references; `&`
 * stays `&amp;`), Lumi alone misses list items (D-039), a package import keeps references as written, H5P's editor
 * re-sends plain text as it loaded it, an author's edit can leave one bracket alone or split a marker by a tag, and
 * the validator's `parseRichText` already decodes every form once.
 *
 * Spec: PROD-001
 */
import { LibraryName, type IUser } from '@lumieducation/h5p-server';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { editorSavedForm } from '../../../src/content/savedForm.js';
import { asAccountUser } from '../../../src/h5p/HvlH5pUser.js';
import { SemanticsEnforcer } from '../../../src/h5p/lumiInternals.js';
import { plainText } from '../../../src/h5p/semantics/lumiTextSanitizer.js';
import { parseRichText } from '../../../src/validation/richText.js';
import { describeWithBrowser } from '../../support/browser.js';
import { removeBuiltPackages } from '../../support/h5pPackageBuilder.js';
import { closeLoopbackServers, listenOnLoopback } from '../../support/loopbackServers.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../../support/httpTestbed.js';
import { describeWithRealPackages, REAL_PACKAGES_DIR } from '../../support/realPackages.js';
import { describeWithServices } from '../../support/services.js';
import {
  MARKER_FORMS,
  markedActivities,
  markerLeaves,
  type MarkedActivity,
  type MarkerForm,
} from './placeholderMarkerActivities.js';
import { selectInRichText } from './placeholderMarkerCkeditor.js';
import { loadEveryCkeditor, openEditor, saveInEditor } from './placeholderMarkerEditor.js';
import {
  metadataOf,
  saveThroughEditor,
  storeProbeActivities,
  type ProbeActivity,
} from './placeholderMarkerCreation.js';
import * as found from './placeholderMarkerStored.js';

const FORMS = Object.keys(MARKER_FORMS) as MarkerForm[];
const mainLibrary = (a: MarkedActivity) => LibraryName.fromUberName(a.library, { useWhitespace: true });
const storedOf = (a: MarkedActivity) => found.STORED[a.type] ?? {};

describeWithServices('the guidance marker through the editor and Lumi (probe P6)', () => {
  describeWithRealPackages('[PROD-001] ⟦…⟧ on the real content types', () => {
    let tb: HttpTestbed;
    let author: TestActor;
    let user: IUser;
    let base: string;
    let activities: ProbeActivity[];
    const read = (id: string) => tb.runtime.editor.getContent(id, user);
    beforeAll(async () => {
      tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
      author = await tb.actor('author');
      user = asAccountUser(author.actor);
      activities = await storeProbeActivities(tb, author);
      base = await listenOnLoopback(tb.app);
    }, 180_000);
    afterAll(async () => {
      removeBuiltPackages();
      await closeLoopbackServers();
      await tb?.close();
    }, 60_000); // WHY: on a loaded runner, removing the testbed's rows and buckets can take over 10 s.

    it.each(FORMS)(
      "[PROD-001] Lumi's enforcer alone stores the %s marker as ⟦ ⟧, except in a list item it never reaches",
      async (form) => {
        // Arrange
        const enforcer = new SemanticsEnforcer(tb.runtime.editor.libraryManager);
        const written = markedActivities(form);
        // Act
        const results: Record<string, string>[] = [];
        for (const a of written) {
          const params = structuredClone(a.params);
          await enforcer.enforceSemanticStructure(params, mainLibrary(a));
          results.push(markerLeaves(params));
        }
        // Assert: D-039, Lumi writes a list item's text to the list's own property, not to the item
        const listItem = (a: MarkedActivity) =>
          a.type === 'Blanks' ? { [found.LIST_ITEM_PATH]: found.asWritten(a)[found.LIST_ITEM_PATH] } : {};
        expect(results).toEqual(written.map((a) => ({ ...storedOf(a), ...listItem(a) })));
      },
    );

    it.each(FORMS)(
      '[PROD-001] the save path stores the %s marker as ⟦ ⟧ in every field and in the title',
      async (form) => {
        // Arrange
        const savedForm = editorSavedForm(tb.runtime.editor.libraryManager);
        const written = markedActivities(form);
        // Act
        const results: unknown[] = [];
        for (const a of written) {
          const gate = await savedForm({ mainLibrary: a.library, params: a.params, metadata: metadataOf(a) });
          const { params, h5p } = await read(await saveThroughEditor(tb, a, user));
          const gateTitle = (gate?.metadata as { title?: string } | undefined)?.title;
          results.push([markerLeaves(gate?.params), gateTitle, markerLeaves(params.params), h5p.title]);
        }
        // Assert
        const title = (a: MarkedActivity) => found.storedTitle(a.type);
        expect(results).toEqual(written.map((a) => [storedOf(a), title(a), storedOf(a), title(a)]));
      },
    );

    it('[PROD-001] a package import stores every marker and the title exactly as written, references included', async () => {
      // Act
      const imported = activities.filter((s) => s.how === 'imported');
      const stored = await Promise.all(imported.map(async ({ id }) => read(id)));
      // Assert
      expect(stored.map(({ params }) => markerLeaves(params.params))).toEqual(
        imported.map(({ activity }) => found.asWritten(activity)),
      );
      expect(stored.map(({ h5p }) => h5p.title)).toEqual(imported.map(({ activity }) => activity.title));
    });

    it('[PROD-001] decoding references and removing tags, as plainText and the validator’s parseRichText do, finds a whole marker in every form', () => {
      // Act
      const written = FORMS.flatMap((form) => markedActivities(form));
      const texts = written.flatMap((a) => [a.title, ...Object.values(found.asWritten(a))]);
      const decoded = [...texts.map(plainText), ...texts.map((text) => parseRichText(text).text)];
      // Assert
      expect(decoded.filter((text) => !/⟦[^⟦⟧]+⟧/.test(text))).toEqual([]);
      expect(plainText('<div>&#x27E6;<strong>Rett</strong> svar&robrk;</div>')).toBe('⟦Rett svar⟧');
      expect(plainText('⟦Sjekk &amp; send⟧')).toBe('⟦Sjekk &amp; send⟧');
      // WHY: a zero-padded reference or one without `;` decodes too; `&amp;#10214;` is the text "&#10214;", no marker.
      const edge = ['&#010214;a&#10215', '&amp;#10214;b&amp;#10215;'];
      expect(edge.map((text) => parseRichText(text).text)).toEqual(['⟦a⟧', '&#10214;b&#10215;']);
      expect(edge.map((text) => Object.keys(markerLeaves({ text })).length)).toEqual([1, 0]);
      expect(parseRichText('⟦Sjekk &amp; send⟧').text).toBe('⟦Sjekk & send⟧');
    });

    describeWithBrowser('[PROD-001] the marker in H5P’s editor', (browser) => {
      it('[PROD-001] an unchanged save with CKEditor loaded in every rich-text field sends rich text decoded and plain text as loaded, and stores ⟦ ⟧', async () => {
        const reports: Record<string, unknown> = {};
        for (const { how, activity, id } of activities) {
          // Act
          const { page, editor, problems } = await openEditor(browser(), base, author, id);
          const loaded = await loadEveryCkeditor(editor);
          const save = await saveInEditor(page, id);
          await page.close();
          const { params, h5p } = await read(id);
          const sent = markerLeaves(save.sent);
          const stored = markerLeaves(params.params);
          reports[`${how} ${activity.type}`] = [loaded, save.status, problems, sent, stored, h5p.title];
        }
        // Assert
        const expected = activities.map(({ how, activity: a }) => {
          const loaded = how === 'saved' ? storedOf(a) : found.asWritten(a);
          const sent = found.sentOnUnchangedSave(a, loaded);
          const report = [
            found.CKEDITOR_FIELDS[a.type],
            200,
            [],
            sent,
            storedOf(a),
            found.storedTitle(a.type),
          ];
          return [`${how} ${a.type}`, report];
        });
        expect(reports).toEqual(Object.fromEntries(expected));
      }, 300_000);

      it('[PROD-001] a partly edited marker is stored as the author left it: one bracket alone, or split by a tag', async () => {
        // Arrange
        const { id } = activities[0] ?? { id: '' };
        const { page, editor, problems } = await openEditor(browser(), base, author, id);
        // Act: "⟦Skriv" becomes "Kva", "Rett" turns bold, and the title loses its closing bracket
        const question = editor.locator('.field-name-question .ckeditor').first();
        const replaced = await selectInRichText(page, question, 0, 6);
        await page.keyboard.type('Kva');
        const bolded = await selectInRichText(
          page,
          editor.locator('.field-name-text .ckeditor').first(),
          1,
          4,
        );
        await page.keyboard.press('Control+B');
        await editor.locator('.field-name-extraTitle input').first().click();
        await page.keyboard.press('End');
        await page.keyboard.press('Backspace');
        const save = await saveInEditor(page, id);
        await page.close();
        const { params, h5p } = await read(id);
        // Assert
        expect([replaced, bolded, save.status, problems]).toEqual(['⟦Skriv', 'Rett', 200, []]);
        expect(markerLeaves(params.params)).toEqual({
          ...found.STORED.MultiChoice,
          question: '<p>Kva spørsmålet her⟧</p>',
          'answers[0].text': '<div>⟦<strong>Rett</strong> svar⟧</div>',
        });
        // WHY: the editor sends the title twice, and Lumi keeps `extraTitle` in h5p.json beside `title`.
        const title = '⟦Tittel: MultiChoice';
        expect(markerLeaves(h5p)).toEqual({ title, extraTitle: title });
      }, 120_000);
    });
  });
});
