/**
 * applyLanguageOverlay — lays HVL's texts over one library's language file: sets the default, label or description
 * of the fields an edit names, and its library strings, on a copy that keeps every other key.
 *
 * Why: the editor deep-merges a library's `language/<code>.json` over its semantics, by position (h5peditor.js), and
 *      reads the editor's own texts from its `libraryStrings`. Setting HVL's Nynorsk and Bokmål texts there reaches
 *      both the editor's form and the defaults new activities are saved with (D-111), without changing the library
 *      files fetched and pinned by hash (D-078).
 * Spec: H5P-008, H5P-010
 * Invariants:
 *   - The input file is never changed; the result is a new object with every key of the input, `libraryStrings`
 *     included.
 *   - A position the file lacks becomes `{}`, which H5P's deep merge ignores; never `null`, which would blank the
 *     field in the editor.
 *   - An edit is skipped, not applied, when its path names no field of `semantics`, or when its `english` is no
 *     longer the library's English text (the field's own property in `semantics.json`, or the key in the English
 *     language file), so a changed field never gets a stale translation.
 *   - Library-string keys that would reach the prototype (`__proto__`, `constructor`, `prototype`) are skipped.
 * Collaborators: ./languageOverlay.ts, ./semanticsPath.ts, ../storage/LanguageOverlayLibraryStorage.ts.
 * Tests: apps/server/test/h5p/languageOverlay/applyLanguageOverlay.test.ts
 */
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';
import type { OverlayEdit, OverlayFieldProperty } from './languageOverlay.js';
import { resolveSemanticsPath, type SemanticsStep } from './semanticsPath.js';

/** What an overlay is checked against. */
export interface OverlaySources {
  /** The library's own `semantics.json`; undefined when it has none (every field edit is then skipped). */
  readonly semantics: readonly ISemanticsEntry[] | undefined;
  /** The `libraryStrings` of the library's English language file; undefined when it has none. */
  readonly englishStrings: Readonly<Record<string, unknown>> | undefined;
}

/** A language file with the overlay laid over it. */
export interface OverlaidLanguageFile {
  readonly file: Record<string, unknown>;
  /** The edits that were not applied (unknown path or changed English text), in file order. */
  readonly skipped: readonly OverlayEdit[];
}

type Json = Record<string, unknown>;

// SECURITY: keys from a content file must never reach an object's prototype.
const UNSAFE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sameText = (value: unknown, english: string | undefined): boolean =>
  english === undefined || (typeof value === 'string' && value.trim() === english);

/** The object at `index` of `list`, made `{}` when missing; the gaps before it are filled with `{}` too. */
function entryAt(list: unknown[], index: number): Json {
  for (let at = list.length; at < index; at += 1) list[at] = {};
  const entry = list[index];
  if (isObject(entry)) return entry;
  const created: Json = {};
  list[index] = created;
  return created;
}

/** The array under `key` of `owner`, made `[]` when it is missing or not an array. */
function listOf(owner: Json, key: string): unknown[] {
  const value = owner[key];
  if (Array.isArray(value)) return value as unknown[];
  const created: unknown[] = [];
  owner[key] = created;
  return created;
}

/** Walks the language file's `semantics` along the steps, making each missing position, to the field's entry. */
function fieldEntry(file: Json, steps: readonly SemanticsStep[]): Json {
  let list = listOf(file, 'semantics');
  let entry: Json = {};
  for (const [position, step] of steps.entries()) {
    entry = entryAt(list, step.index);
    if (step.item) {
      if (!isObject(entry.field)) entry.field = {};
      entry = entry.field as Json;
    }
    if (position < steps.length - 1) list = listOf(entry, 'fields');
  }
  return entry;
}

function applyFieldEdit(
  file: Json,
  edit: Extract<OverlayEdit, { kind: 'field' }>,
  semantics: readonly ISemanticsEntry[] | undefined,
): boolean {
  const resolved = semantics ? resolveSemanticsPath(semantics, edit.path) : undefined;
  const property: OverlayFieldProperty = edit.property;
  if (!resolved || !sameText(resolved.field[property], edit.english)) return false;
  fieldEntry(file, resolved.steps)[property] = edit.text;
  return true;
}

function applyStringEdit(
  file: Json,
  edit: Extract<OverlayEdit, { kind: 'libraryString' }>,
  englishStrings: OverlaySources['englishStrings'],
): boolean {
  if (UNSAFE_KEYS.has(edit.key) || !englishStrings || !Object.hasOwn(englishStrings, edit.key)) return false;
  if (!sameText(englishStrings[edit.key], edit.english)) return false;
  if (!isObject(file.libraryStrings)) file.libraryStrings = {};
  (file.libraryStrings as Json)[edit.key] = edit.text;
  return true;
}

/**
 * Lays the overlay's edits for one library and language over its language file.
 * @param file - The parsed language file H5P ships (`{}` when the library has none).
 * @param edits - The overlay's edits for this library version and language.
 * @param sources - The library's semantics and English library strings, to find fields and spot changed texts.
 * @returns A new file with the edits that apply, and the edits skipped.
 * @spec H5P-008
 */
export function applyLanguageOverlay(
  file: unknown,
  edits: readonly OverlayEdit[],
  sources: OverlaySources,
): OverlaidLanguageFile {
  const copy: Json = isObject(file) ? (structuredClone(file) as Json) : {};
  const skipped = edits.filter(
    (edit) =>
      !(edit.kind === 'field'
        ? applyFieldEdit(copy, edit, sources.semantics)
        : applyStringEdit(copy, edit, sources.englishStrings)),
  );
  return { file: copy, skipped };
}
