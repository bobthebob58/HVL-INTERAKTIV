/**
 * removeDragQuestion — takes H5P.DragQuestion out of every sub-content choice in the editor.
 *
 * Why: free 2-D drag and drop is a serious barrier for keyboard, switch and screen-reader users (D-006), so
 *      it is not offered at the top level and not inside containers either (`H5P-002` (c)). The library stays
 *      installed, because some packages depend on it, but no `library` field may offer it.
 * Spec: H5P-002
 * Invariants:
 *   - The input semantics are never changed; a filtered copy is returned (Lumi may cache the original).
 *   - Every `library` field at any depth (groups, lists, nested lists) loses the DragQuestion options.
 * Collaborators: ../H5pEditorFactory.ts via `customization.alterLibrarySemantics`; ./SubContentPolicy.ts
 *   enforces the same rule on save, where list items need our own walk (D-039).
 * Tests: apps/server/test/h5p/semantics/removeDragQuestion.test.ts
 */
import type { ILibraryName } from '@lumieducation/h5p-server';
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';

/** Machine names that no `library` field may offer (D-006). */
export const EXCLUDED_SUB_CONTENT: ReadonlySet<string> = new Set(['H5P.DragQuestion']);

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
