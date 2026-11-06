/**
 * Tests that HVL's real texts (`content/h5p-tekstar/`) on the pinned libraries apply in full and drop nothing: for
 * every library version and language the overlay names, each entry lands where it says, and every other value of the
 * language file H5P ships (Lumi's own fallback for nn, `libraryStrings` included) reaches the editor unchanged.
 *
 * Spec: H5P-008, H5P-010
 */
import { expect, it } from 'vitest';
import { fsImplementations, LibraryName, type ILibraryStorage } from '@lumieducation/h5p-server';
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';
import type { OverlayEdit, OverlayLanguage } from '../../../src/h5p/languageOverlay/languageOverlay.js';
import { resolveSemanticsPath } from '../../../src/h5p/languageOverlay/semanticsPath.js';
import { withLanguageFallback } from '../../../src/h5p/storage/LanguageFallbackLibraryStorage.js';
import { withLanguageOverlay } from '../../../src/h5p/storage/LanguageOverlayLibraryStorage.js';
import { loadLanguageOverlay } from '../../../src/learningDesign/content/h5pTextsContent.js';
import { PINNED_LIBRARIES_DIR } from '../../../src/learningDesign/content/installedLibraries.js';
import { describeWithRealPackages } from '../../support/realPackages.js';

/** Every leaf of a JSON value as `path → value`, e.g. `semantics.1.fields.0.default → "Send inn"`. */
function leaves(value: unknown, path = '', out = new Map<string, unknown>()): Map<string, unknown> {
  if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value)) leaves(child, path ? `${path}.${key}` : key, out);
  } else out.set(path, value);
  return out;
}

/** Where an edit lands in the language file, as a leaf path. */
function leafOf(edit: OverlayEdit, semantics: readonly ISemanticsEntry[]): string | undefined {
  if (edit.kind === 'libraryString') return `libraryStrings.${edit.key}`;
  const steps = resolveSemanticsPath(semantics, edit.path)?.steps;
  if (!steps) return undefined;
  const parts = steps.map(
    (step, at) => `${at === 0 ? 'semantics' : 'fields'}.${step.index}${step.item ? '.field' : ''}`,
  );
  return `${parts.join('.')}.${edit.property}`;
}

/** The file Lumi would serve without the overlay, for the first of `files` the library has. */
async function shipped(storage: ILibraryStorage, library: LibraryName, files: string[]): Promise<unknown> {
  for (const file of files)
    if (await storage.fileExists(library, file))
      return JSON.parse(await storage.getFileAsString(library, file));
  return {};
}

describeWithRealPackages('[H5P-008] the real texts on the pinned libraries', () => {
  const overlay = loadLanguageOverlay();
  const plain = new fsImplementations.FileLibraryStorage(PINNED_LIBRARIES_DIR);
  const overlaid = withLanguageOverlay(withLanguageFallback(plain), overlay);
  const cases = Object.entries(overlay.edits).flatMap(([key, byLanguage]) =>
    (Object.entries(byLanguage) as [OverlayLanguage, readonly OverlayEdit[]][]).map(
      ([language, edits]) => [key, language, edits] as const,
    ),
  );

  it.each(cases)(
    '[H5P-008] %s in %s: every entry applies and every shipped text stays',
    async (key, language, edits) => {
      // Arrange
      const [machineName, version] = key.split(' ');
      const [major, minor] = (version ?? '').split('.').map(Number);
      const library = new LibraryName(machineName ?? '', major ?? 0, minor ?? 0);
      // WHY: H5P.DragNBar has no semantics, only library strings.
      const semantics = (
        (await plain.fileExists(library, 'semantics.json'))
          ? await plain.getFileAsJson(library, 'semantics.json')
          : []
      ) as ISemanticsEntry[];
      const own = language === 'nn' ? ['language/nn.json', 'language/nb.json'] : ['language/nb.json'];
      const base = leaves(await shipped(plain, library, [...own, 'language/en.json']));
      // Act
      const result = leaves(JSON.parse(await overlaid.getFileAsString(library, `language/${language}.json`)));
      // Assert
      const targets = new Map(edits.map((edit) => [leafOf(edit, semantics), edit.text]));
      expect([...targets.keys()]).not.toContain(undefined);
      for (const [leaf, text] of targets) expect(result.get(leaf ?? ''), leaf).toBe(text);
      for (const [leaf, value] of base) if (!targets.has(leaf)) expect(result.get(leaf), leaf).toEqual(value);
    },
  );
});
