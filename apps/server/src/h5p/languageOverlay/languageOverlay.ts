/**
 * languageOverlay — HVL's Nynorsk and Bokmål texts for the H5P libraries as the engine uses them: for each library
 * version and language, the edits to make to that library's language file, and `H5P-010`'s English video guidance.
 *
 * Why: many `nn` and `nb` language files of the pinned libraries leave learner-facing defaults, labels and the
 *      editor's own strings in English (S5 probe P1). HVL's texts live in `content/h5p-tekstar/` for ALU and are
 *      laid over the libraries' files when the editor reads them (D-111). This module is the data the content loader
 *      builds and the storage wrapper applies; it reads no file.
 * Spec: H5P-008, H5P-010
 * Invariants:
 *   - Edits are keyed by `H5P.Name major.minor` (no patch version) and by language, `nn` or `nb` only.
 *   - An overlay is plain data that the content loader freezes; `overlayEditsFor` never returns undefined.
 *   - A field edit without `english` (the video guidance) is applied whatever the library's own text is.
 * Collaborators: ../../learningDesign/content/h5pTextsContent.ts (builds it), ./applyLanguageOverlay.ts,
 *   ../storage/LanguageOverlayLibraryStorage.ts, ../semantics/videoGuidance.ts.
 * Tests: apps/server/test/h5p/languageOverlay/applyLanguageOverlay.test.ts
 */
import type { ILibraryName } from '@lumieducation/h5p-server';

/** The languages the overlay writes; English needs none, because the libraries' own texts are English. */
export const OVERLAY_LANGUAGES = ['nn', 'nb'] as const;

/** A language the overlay has texts for. */
export type OverlayLanguage = (typeof OVERLAY_LANGUAGES)[number];

/** The property of a semantics field an edit sets in a language file. */
export type OverlayFieldProperty = 'default' | 'label' | 'description';

/** One change to one library's language file. */
export type OverlayEdit =
  | {
      readonly kind: 'field';
      readonly property: OverlayFieldProperty;
      /** The semantics path, e.g. `UI.submitAnswerButton` or `branchingScenario.content[].proceedButtonText`. */
      readonly path: string;
      readonly text: string;
      /** The library's English text this translates; absent when the edit replaces whatever is there. */
      readonly english?: string;
    }
  | {
      readonly kind: 'libraryString';
      /** The key in the language file's `libraryStrings`, e.g. `paste`. */
      readonly key: string;
      readonly text: string;
      /** The library's English text this translates (from `language/en.json` or `.en.json`). */
      readonly english: string;
    };

/** One video field that gets the `H5P-010` guidance as its description. */
export interface VideoGuidanceField {
  /** `H5P.Name major.minor`, e.g. `H5P.InteractiveVideo 1.28`. */
  readonly library: string;
  /** The field's semantics path, e.g. `interactiveVideo.video.files`. */
  readonly path: string;
}

/** The `H5P-010` guidance in English, which `alterLibrarySemantics` sets (nn and nb are overlay edits). */
export interface VideoGuidance {
  readonly fields: readonly VideoGuidanceField[];
  readonly english: string;
}

/** The overlay: per library version and language, the edits; and the English video guidance, when there is one. */
export interface LanguageOverlay {
  /** `H5P.Name major.minor` → language → edits in file order. */
  readonly edits: Readonly<
    Record<string, Readonly<Partial<Record<OverlayLanguage, readonly OverlayEdit[]>>>>
  >;
  readonly videoGuidance?: VideoGuidance;
}

/** An overlay with no texts: the libraries as H5P ships them. */
export const EMPTY_LANGUAGE_OVERLAY: LanguageOverlay = Object.freeze({ edits: Object.freeze({}) });

/**
 * The key a library version has in the overlay.
 * @param library - A library name with its version (the patch version is ignored).
 * @returns e.g. `H5P.MultiChoice 1.16`.
 */
export function overlayLibraryKey(library: ILibraryName): string {
  return `${library.machineName} ${library.majorVersion}.${library.minorVersion}`;
}

/**
 * The overlay's edits for one library version in one language.
 * @param overlay - The loaded overlay.
 * @param library - The library being read.
 * @param language - `nn` or `nb`.
 * @returns The edits in file order; empty when the overlay has none.
 * @spec H5P-008
 */
export function overlayEditsFor(
  overlay: LanguageOverlay,
  library: ILibraryName,
  language: OverlayLanguage,
): readonly OverlayEdit[] {
  const key = overlayLibraryKey(library);
  return Object.hasOwn(overlay.edits, key) ? (overlay.edits[key]?.[language] ?? []) : [];
}
