/**
 * Integration tests of HVL's language overlay through the editor's AJAX endpoint on the real content types (D-078):
 * the library data in Bokmål carries the overlay's defaults and labels beside H5P's own texts, English is what H5P
 * ships, the video fields carry `H5P-010`'s guidance in each language, and the editor's toolbar strings
 * (H5P.DragNBar) arrive in Nynorsk with every key H5P ships.
 *
 * Spec: H5P-008, H5P-010
 */
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';
import { resolveSemanticsPath } from '../../../src/h5p/languageOverlay/semanticsPath.js';
import { loadLanguageOverlay } from '../../../src/learningDesign/content/h5pTextsContent.js';
import { openHttpTestbed, type HttpTestbed, type TestActor } from '../../support/httpTestbed.js';
import { describeWithRealPackages, REAL_PACKAGES_DIR } from '../../support/realPackages.js';
import { requestAs } from '../../support/requestAs.js';
import { describeWithServices } from '../../support/services.js';

interface LibraryData {
  semantics: ISemanticsEntry[];
  language: string | null;
  translations: Record<string, { libraryStrings?: Record<string, string> }>;
}
type Entry = { default?: string; label?: string; description?: string; fields?: Entry[]; field?: Entry };

/** The language file's entry at a semantics path, found by the positions the semantics give. */
function entryAt(data: LibraryData, path: string): Entry | undefined {
  const steps = resolveSemanticsPath(data.semantics, path)?.steps ?? [];
  let list = (JSON.parse(data.language ?? '{}') as { semantics?: Entry[] }).semantics;
  let entry: Entry | undefined;
  for (const step of steps) {
    entry = list?.[step.index];
    if (step.item) entry = entry?.field;
    list = entry?.fields;
  }
  return entry;
}

describeWithServices('the language overlay in the editor’s library data', () => {
  describeWithRealPackages('[H5P-008] on the real content types', () => {
    let tb: HttpTestbed;
    let author: TestActor;
    const guidance = loadLanguageOverlay().videoGuidance;
    const libraryData = async (library: string, language: string): Promise<LibraryData> => {
      const [machineName, version] = library.split(' ');
      const [major, minor] = (version ?? '').split('.');
      const path = `/h5p/ajax?action=libraries&machineName=${machineName}&majorVersion=${major}&minorVersion=${minor}&language=${language}`;
      const res = await requestAs(tb.app, author, 'get', path);
      expect(res.status).toBe(200);
      return res.body as LibraryData;
    };
    beforeAll(async () => {
      tb = await openHttpTestbed([], { seedFrom: REAL_PACKAGES_DIR });
      author = await tb.actor('author');
    }, 180_000);
    afterAll(() => tb?.close(), 60_000);

    it("[H5P-008] MultiChoice's Bokmål data has the overlay's defaults and labels beside H5P's own texts", async () => {
      // Act
      const nb = await libraryData('H5P.MultiChoice 1.16', 'nb');
      // Assert
      expect(entryAt(nb, 'UI.submitAnswerButton')).toEqual({
        label: 'Navn på «Send inn»-knappen',
        default: 'Send inn',
      });
      expect(entryAt(nb, 'UI.a11yCheck')?.default).toBe(
        'Sjekk svarene. Svarene blir merket som riktige, feil eller ubesvarte.',
      );
      expect(entryAt(nb, 'UI.checkAnswerButton')?.default).toBe('Sjekk');
      expect(entryAt(nb, 'confirmCheck.header')).toEqual({ label: 'Tittel', default: 'Ferdig?' });
    });

    it('[H5P-008] in English the editor gets MultiChoice as H5P ships it', async () => {
      // Act
      const en = await libraryData('H5P.MultiChoice 1.16', 'en');
      // Assert
      expect(en.language).toBeNull();
      expect(resolveSemanticsPath(en.semantics, 'UI.submitAnswerButton')?.field).toMatchObject({
        default: 'Submit',
        label: 'Submit answer button label',
      });
    });

    it.each([
      ['H5P.InteractiveVideo 1.28', 'interactiveVideo.video.files'],
      ['H5P.Video 1.6', 'sources'],
    ])('[H5P-010] %s shows the Panopto guidance under %s in nn, nb and en', async (library, path) => {
      // Act
      const [nn, nb, en] = await Promise.all(
        ['nn', 'nb', 'en'].map((language) => libraryData(library, language)),
      );
      // Assert
      expect(entryAt(nn!, path)?.description).toMatch(/^Bruk helst ein video frå Panopto/);
      expect(entryAt(nb!, path)?.description).toMatch(/^Bruk helst en video fra Panopto/);
      expect(resolveSemanticsPath(en!.semantics, path)?.field.description).toBe(guidance?.english);
      expect(en!.language).toBeNull();
    });

    it("[H5P-008] the editor's toolbar strings (H5P.DragNBar) arrive in Nynorsk with every key H5P ships", async () => {
      // Act
      const nn = await libraryData('H5P.CoursePresentation 1.28', 'nn');
      const en = await libraryData('H5P.CoursePresentation 1.28', 'en');
      const strings = nn.translations['H5P.DragNBar']?.libraryStrings ?? {};
      // Assert
      expect(strings).toMatchObject({
        paste: 'Lim inn',
        copyLabel: 'Kopier',
        bringToFrontLabel: 'Flytt framst',
      });
      expect(Object.keys(strings).sort()).toEqual(
        Object.keys(en.translations['H5P.DragNBar']?.libraryStrings ?? {}).sort(),
      );
      expect(en.translations['H5P.DragNBar']?.libraryStrings?.paste).toBe('Paste');
    });
  });
});
