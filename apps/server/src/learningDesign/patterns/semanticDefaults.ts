/**
 * semanticDefaults — fills a pattern skeleton's parameters with the defaults of each library's semantics, in the
 * activity's language, as H5P's editor does when an author opens new content.
 *
 * Why: an activity created from a pattern on the server (D-084, D-085) never passes through the editor's form, so
 *      it would lack the button labels, feedback texts and behaviour switches the editor fills in. The skeleton then
 *      only holds what the pattern is about. This is a port of tools/h5p-libraries/semanticDefaults.mjs that reads
 *      semantics and language files through Lumi's library manager, as the editor's AJAX endpoint does.
 * Spec: PED-010, PROD-001
 * Invariants:
 *   - Translation is H5P editor behaviour (h5peditor.js:229): the language file's `semantics` is deep-merged over
 *     `semantics.json` by index and key, so it can replace labels and defaults at any depth. The language comes from
 *     Lumi's `getLanguage`, with its fallbacks (and ours: nn → nb, then en).
 *   - A field gets its default only when its value is undefined, at any depth: in groups, in list items and in
 *     sub-content (`{ library: "H5P.Name x.y", params }`, with that library's own semantics), as the editor's
 *     processSemanticsChunk does. Given values always win; keys the semantics do not define are kept.
 *   - A group gets an object only when it has a value or a child has a default; a group with one field holds that
 *     field's value directly unless it `isSubContent` (H5P's flattening rule). Lists are never lengthened.
 *   - A sub-content group (`isSubContent`, e.g. H5P.Summary's statements) without a `subContentId` gets one, as the
 *     editor's group widget gives it; ./subContentIds.ts then renews every ID, which it can only find by shape.
 *   - The result shares no object with the input or the semantics cache (callers change it in place, e.g. the
 *     sub-content policy on save), and the input is never mutated.
 * Collaborators: Lumi's LibraryManager (`getSemantics`, `getLanguage`); ./patternActivityBuild.ts and
 *   ./patternLibraries.ts, which create an activity from a pattern (D-085).
 * Tests: apps/server/test/learningDesign/patterns/semanticDefaults.test.ts,
 *   apps/server/test/learningDesign/patterns/skeletonCreation.browser.int.test.ts
 */
import { randomUUID } from 'node:crypto';
import { LibraryName, type ILibraryName } from '@lumieducation/h5p-server';
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';

/** What the filler reads from Lumi's LibraryManager (the server passes `editor.libraryManager`). */
export interface SemanticsSource {
  /** `semantics.json`, with our `alterLibrarySemantics` applied. */
  getSemantics(library: ILibraryName): Promise<ISemanticsEntry[]>;
  /** The language file as text (with Lumi's fallbacks), or null when there is none. */
  getLanguage(library: ILibraryName, language: string): Promise<string | null>;
}

/** The languages an activity can be created in. */
export type ActivityLanguage = 'nn' | 'nb' | 'en';

/** H5P parameters as JSON: a skeleton's, or a sub-content node's `params`. */
export type Params = Record<string, unknown>;
type Field = ISemanticsEntry & { readonly isSubContent?: boolean };
interface Fill {
  readonly semanticsOf: (library: string) => Promise<readonly Field[]>;
  readonly newId: () => string;
}

// SECURITY: a language file is JSON from a library package; these keys would reach the prototype when merged.
const UNSAFE_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);
// WHY: sub-content names its library as Lumi stores it in content.json (`useWhitespace`).
const SUB_CONTENT_LIBRARY = /^[A-Za-z][\w.]* \d+\.\d+$/;

const isObject = (value: unknown): value is Params =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Deep-merges `source` over `target` as jQuery's `$.extend(true, …)` does: arrays by index, objects by key,
 * undefined skipped; neither argument is changed.
 * @param target - The value merged into.
 * @param source - The value that wins.
 * @returns The merged copy.
 */
export function extendDeep(target: unknown, source: unknown): unknown {
  if (Array.isArray(source)) {
    const out: unknown[] = Array.isArray(target) ? [...(target as unknown[])] : [];
    source.forEach((value, index) => {
      if (value !== undefined) out[index] = extendDeep(out[index], value);
    });
    return out;
  }
  if (!isObject(source)) return source;
  const out: Params = isObject(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && !UNSAFE_KEYS.has(key)) out[key] = extendDeep(out[key], value);
  }
  return out;
}

/**
 * Applies a library's translation (the `semantics` of `language/<code>.json`) to its semantics.
 * @param semantics - `semantics.json`.
 * @param translation - The translated fields, same shape; undefined when the library has none.
 * @returns The translated semantics (a copy).
 */
export function translateSemantics(
  semantics: readonly ISemanticsEntry[],
  translation: unknown,
): ISemanticsEntry[] {
  return extendDeep(semantics, Array.isArray(translation) ? translation : []) as ISemanticsEntry[];
}

const defaultOf = (field: Field): unknown =>
  field.default === undefined ? undefined : structuredClone(field.default as unknown);

async function fillValue(field: Field, value: unknown, fill: Fill): Promise<unknown> {
  const filled = value === undefined ? defaultOf(field) : value;
  if (field.type === 'group') {
    const fields = (field.fields ?? []) as Field[];
    const [only] = fields;
    // WHY: H5P stores a group of one field as that field's value, except for sub-content groups.
    if (fields.length === 1 && only && !field.isSubContent) return fillValue(only, filled, fill);
    if (filled !== undefined && !isObject(filled)) return filled;
    const group = await fillFields(fields, filled ?? {}, fill);
    if (filled === undefined && Object.keys(group).length === 0) return undefined;
    // WHY: the editor's group widget gives a sub-content group its ID when it builds it (h5peditor-group.js:162).
    if (field.isSubContent && group.subContentId === undefined) group.subContentId = fill.newId();
    return group;
  }
  if (field.type === 'list' && Array.isArray(filled) && field.field) {
    const items: unknown[] = [];
    // WHY: one item after the other, so IDs are made in document order (tests can predict them).
    for (const entry of filled as unknown[]) items.push(await fillValue(field.field as Field, entry, fill));
    return items;
  }
  if (field.type === 'library' && isObject(filled)) return fillSubContent(filled, fill);
  return filled;
}

async function fillFields(fields: readonly Field[], params: Params, fill: Fill): Promise<Params> {
  const out: Params = { ...params };
  for (const field of fields) {
    const value = await fillValue(field, params[field.name], fill);
    if (value !== undefined) out[field.name] = value;
  }
  return out;
}

async function fillSubContent(node: Params, fill: Fill): Promise<Params> {
  const { library, params } = node;
  // WHY: an entry the editor left empty (no library yet) has no semantics to fill; Lumi removes it on save.
  if (typeof library !== 'string' || !SUB_CONTENT_LIBRARY.test(library)) return node;
  if (params !== undefined && !isObject(params)) return node;
  return { ...node, params: await fillFields(await fill.semanticsOf(library), params ?? {}, fill) };
}

/**
 * The translated semantics of one library.
 * @param source - Lumi's library manager.
 * @param library - The library.
 * @param language - The activity's language.
 * @returns Semantics with the language file's labels and defaults.
 */
export async function localisedSemantics(
  source: SemanticsSource,
  library: ILibraryName,
  language: ActivityLanguage,
): Promise<ISemanticsEntry[]> {
  const [semantics, file] = await Promise.all([
    source.getSemantics(library),
    source.getLanguage(library, language),
  ]);
  const translation = file === null ? undefined : (JSON.parse(file) as { semantics?: unknown }).semantics;
  return translateSemantics(semantics, translation);
}

/**
 * Fills a skeleton's parameters, and all sub-content in them, with localised semantics defaults.
 * @param params - The skeleton's parameters (content.json); not changed.
 * @param mainLibrary - The activity's library as `H5P.Name x.y`.
 * @param source - Lumi's library manager (`editor.libraryManager` on the server).
 * @param language - The activity's language.
 * @param newId - Makes the ID of a sub-content group that has none; a random UUID by default.
 * @returns The completed parameters.
 * @throws Error from Lumi when the main library or a sub-content library is not installed, or when a library
 *   name is malformed.
 * @example
 *   const params = await withSemanticDefaults(skeleton, 'H5P.MultiChoice 1.16', editor.libraryManager, 'nn');
 * @spec PED-010
 */
export async function withSemanticDefaults(
  params: Params,
  mainLibrary: string,
  source: SemanticsSource,
  language: ActivityLanguage,
  newId: () => string = randomUUID,
): Promise<Params> {
  const cache = new Map<string, Promise<readonly Field[]>>();
  const semanticsOf = (library: string): Promise<readonly Field[]> => {
    let semantics = cache.get(library);
    if (!semantics) {
      const name = LibraryName.fromUberName(library, { useWhitespace: true });
      semantics = localisedSemantics(source, name, language);
      cache.set(library, semantics);
    }
    return semantics;
  };
  // WHY: a pattern's skeleton is loaded once and frozen (D-082); the save path changes parameters in place.
  return fillFields(await semanticsOf(mainLibrary), structuredClone(params), { semanticsOf, newId });
}
