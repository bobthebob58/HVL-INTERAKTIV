/**
 * videoGuidance — the editor's `alterLibrarySemantics` hook: D-006's DragQuestion filter, then `H5P-010`'s English
 * guidance as the description of the video fields `content/h5p-tekstar/video-guidance.yaml` lists.
 *
 * Why: authors should put a video in HVL's Panopto, with captions, and upload an `.mp4` only as an exception within
 *      the 50 MB limit (`H5P-010`, `SEC-005`). The editor shows a field's description from the language file over
 *      the one in the semantics, so the `nn` and `nb` guidance goes through the language overlay and only the
 *      English guidance is set here (D-111).
 * Spec: H5P-010, H5P-002
 * Invariants:
 *   - The DragQuestion filter always runs first; without guidance the hook is that filter alone.
 *   - Only the listed fields of the listed library versions change; the semantics Lumi passes in are never changed.
 *   - A listed path that names no field is left alone (`content:check` reports it).
 * Collaborators: ./removeDragQuestion.ts, ../languageOverlay/semanticsPath.ts, ../languageOverlay/languageOverlay.ts,
 *   ../H5pEditorFactory.ts (`customization.alterLibrarySemantics`).
 * Tests: apps/server/test/h5p/semantics/videoGuidance.test.ts
 */
import type { ILibraryName } from '@lumieducation/h5p-server';
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';
import { overlayLibraryKey, type VideoGuidance } from '../languageOverlay/languageOverlay.js';
import { resolveSemanticsPath } from '../languageOverlay/semanticsPath.js';
import { removeDragQuestion } from './removeDragQuestion.js';

/** Lumi's `alterLibrarySemantics` hook. */
export type AlterLibrarySemantics = (
  library: ILibraryName,
  semantics: ISemanticsEntry[],
) => ISemanticsEntry[];

/**
 * Builds the editor's semantics hook.
 * @param guidance - The English guidance and its fields; undefined while `content/h5p-tekstar/` has none.
 * @returns The hook: the DragQuestion filter, then the guidance on the listed fields.
 * @spec H5P-010
 */
export function editorSemanticsHook(guidance: VideoGuidance | undefined): AlterLibrarySemantics {
  if (!guidance) return removeDragQuestion;
  return (library, semantics) => {
    const filtered = removeDragQuestion(library, semantics);
    const key = overlayLibraryKey(library);
    const paths = guidance.fields.filter((field) => field.library === key).map((field) => field.path);
    if (paths.length === 0) return filtered;
    // WHY: a deep copy, so a field object Lumi or the filter shares with its cache is never written to.
    const copy = structuredClone(filtered);
    for (const path of paths) {
      const resolved = resolveSemanticsPath(copy, path);
      if (resolved) resolved.field.description = guidance.english;
    }
    return copy;
  };
}
