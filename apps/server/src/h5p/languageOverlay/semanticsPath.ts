/**
 * semanticsPath — names a field of a library's semantics by a path such as `UI.submitAnswerButton` or
 * `branchingScenario.content[].proceedButtonText`, and finds it with its position, which language files use.
 *
 * Why: a language file mirrors `semantics.json` by position, without field names, so HVL's overlay (D-111) cannot
 *      be written against the file itself. ALU writes the field names instead, as probe P1 reports them, and this
 *      module turns them into the positions the overlay sets and `content:check` checks.
 * Spec: H5P-008, H5P-010
 * Invariants:
 *   - A segment is a field name; `name[]` names a list's item field (whose own name is not written).
 *   - Resolution only reads the semantics; it never changes them and never throws.
 *   - A path that does not lead to a field, through groups and lists only, resolves to undefined.
 * Collaborators: ./applyLanguageOverlay.ts, ../semantics/videoGuidance.ts,
 *   ../../learningDesign/content/h5pTextsLibraryChecks.ts.
 * Tests: apps/server/test/h5p/languageOverlay/semanticsPath.test.ts
 */
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';

/** One step down: the field at `index` in the current field list, then into its list item when `item`. */
export interface SemanticsStep {
  readonly index: number;
  readonly item: boolean;
}

/** A field found by its path, with the steps that lead to it. */
export interface ResolvedSemanticsField {
  readonly field: ISemanticsEntry;
  readonly steps: readonly SemanticsStep[];
}

/** One segment as written: a field name, then `[]` for a list's item. */
const SEGMENT = /^([A-Za-z_][\w-]*)(\[\])?$/;

/** The shape of a whole path, for the content schema. */
export const SEMANTICS_PATH = /^[A-Za-z_][\w-]*(\[\])?(\.[A-Za-z_][\w-]*(\[\])?)*$/;

/**
 * Finds the field a path names.
 * @param semantics - A library's `semantics.json` (or the editor's altered copy).
 * @param path - e.g. `interactiveVideo.video.files` or `branchingScenario.content[].proceedButtonText`.
 * @returns The field and the steps to it, or undefined when the path names no field.
 * @spec H5P-008
 */
export function resolveSemanticsPath(
  semantics: readonly ISemanticsEntry[],
  path: string,
): ResolvedSemanticsField | undefined {
  if (!SEMANTICS_PATH.test(path)) return undefined;
  const segments = path.split('.');
  const steps: SemanticsStep[] = [];
  let fields: readonly ISemanticsEntry[] | undefined = semantics;
  let found: ISemanticsEntry | undefined;
  for (const [position, segment] of segments.entries()) {
    const [, name, brackets] = SEGMENT.exec(segment) ?? [];
    const index: number = (fields ?? []).findIndex((entry) => entry.name === name);
    let field: ISemanticsEntry | undefined = fields?.[index];
    if (!field) return undefined;
    const item = brackets !== undefined;
    if (item) {
      if (field.type !== 'list' || !field.field) return undefined;
      field = field.field;
    }
    steps.push({ index, item });
    found = field;
    const last = position === segments.length - 1;
    if (!last && (field.type !== 'group' || !Array.isArray(field.fields))) return undefined;
    fields = field.fields;
  }
  return found ? { field: found, steps } : undefined;
}
