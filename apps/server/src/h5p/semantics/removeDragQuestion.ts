/**
 * removeDragQuestion — takes H5P.DragQuestion, and the three other types HVL does not accept as sub-content, out
 * of every sub-content choice in the editor.
 *
 * Why: free 2-D drag and drop is a serious barrier for keyboard, switch and screen-reader users (D-006), so
 *      it is not offered at the top level and not inside containers either (`H5P-002` (c)). The library stays
 *      installed, because some packages depend on it, but no `library` field may offer it. The same holds for
 *      three types the ten containers offer upstream and HVL has neither adapted nor checked (D-123, the owner's
 *      decision of 2026-11-21): H5P.AudioRecorder records the learner's voice, H5P.TwitterUserFeed loads a
 *      third party's content, and H5P.Questionnaire is a survey with free-text answers.
 * Spec: H5P-002
 * Invariants:
 *   - The input semantics are never changed; a filtered copy is returned (Lumi may cache the original).
 *   - Every `library` field at any depth (groups, lists, nested lists) loses the options of the excluded types.
 *   - The six other sub-content types the containers offer beside the ten stay: TrueFalse, SingleChoiceSet,
 *     MarkTheWords, Summary, MultiMediaChoice and Dialogcards (D-123).
 * Collaborators: ../H5pEditorFactory.ts via `customization.alterLibrarySemantics`; ./SubContentPolicy.ts
 *   enforces the same rule on save, where list items need our own walk (D-039).
 * Tests: apps/server/test/h5p/semantics/removeDragQuestion.test.ts
 */
import type { ILibraryName } from '@lumieducation/h5p-server';
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';

/** Machine names that no `library` field may offer (D-006, D-123). */
export const EXCLUDED_SUB_CONTENT: ReadonlySet<string> = new Set([
  'H5P.DragQuestion',
  'H5P.AudioRecorder',
  'H5P.TwitterUserFeed',
  'H5P.Questionnaire',
]);

/**
 * The machine name of one `library` option, which H5P writes as `"H5P.Name 1.2"` (or rarely `{ name }`).
 * @param option - One entry of a library field's `options`.
 * @returns The machine name, or undefined when the option has no recognisable name.
 */
export function optionMachineName(option: unknown): string | undefined {
  const name = typeof option === 'string' ? option : (option as { name?: unknown } | null)?.name;
  return typeof name === 'string' ? name.trim().split(/\s+/)[0] : undefined;
}

function filterEntry(entry: ISemanticsEntry): ISemanticsEntry {
  const copy: ISemanticsEntry = { ...entry };
  if (entry.type === 'library' && Array.isArray(entry.options)) {
    copy.options = entry.options.filter(
      (option) => !EXCLUDED_SUB_CONTENT.has(optionMachineName(option) ?? ''),
    );
  }
  if (entry.fields) copy.fields = entry.fields.map(filterEntry);
  if (entry.field) copy.field = filterEntry(entry.field);
  return copy;
}

/**
 * The `alterLibrarySemantics` hook: removes the excluded types from every library field.
 * @param _library - The library whose semantics these are (every library is treated the same).
 * @param semantics - Lumi's semantics for that library.
 * @returns A copy without any excluded sub-content option.
 */
export function removeDragQuestion(_library: ILibraryName, semantics: ISemanticsEntry[]): ISemanticsEntry[] {
  return semantics.map(filterEntry);
}
