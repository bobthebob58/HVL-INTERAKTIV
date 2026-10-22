/**
 * paramsWalker — visits every value in H5P content parameters together with the semantics that define it.
 *
 * Why: Lumi's ContentScanner hands list items to its callback with the list as the "parent", so a rule that
 *      replaces or removes a value cannot reach list items (D-039). This walker gives every visit the exact
 *      container and key of the value, so policies can change list items as safely as object fields. The S4
 *      validator walks parameters the same way.
 * Spec: SEC-008, H5P-002
 * Invariants:
 *   - Follows H5P's parameter layout as Lumi reads it: a group with a single field holds that field's value
 *     directly (ContentScanner.js, "special case"), lists are arrays, and `library` values are
 *     `{ library: "H5P.Name 1.2", params, metadata, subContentId }` whose params use that library's semantics.
 *   - `container[key]` is the visited value at the moment of the visit.
 *   - Nesting deeper than `MAX_LIBRARY_DEPTH` libraries is refused instead of walked (no stack exhaustion).
 * Collaborators: ./SubContentPolicy.ts, Lumi's LibraryManager.getSemantics (the semantics lookup).
 * Tests: apps/server/test/h5p/semantics/paramsWalker.test.ts
 */
import { H5pError, LibraryName, type ILibraryName } from '@lumieducation/h5p-server';
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';

/** Deepest nesting of sub-content libraries that is walked (H5P containers nest a few levels at most). */
export const MAX_LIBRARY_DEPTH = 16;

/** One value in the parameters, with where it lives and what defines it. */
export interface ParamsVisit {
  /** Semantics of the value (for a single-field group: that field, under the group's name). */
  readonly semantics: ISemanticsEntry;
  /** The value itself. */
  readonly value: unknown;
  /** The object or array that holds the value. */
  readonly container: Record<string, unknown> | unknown[];
  /** Key or index of the value in its container. */
  readonly key: string | number;
  /** JSON path for messages, e.g. `$.questions[0].params.text`. */
  readonly path: string;
}

/** Returns the semantics of a library (Lumi's `libraryManager.getSemantics`, with our alterations). */
export type SemanticsLookup = (library: ILibraryName) => Promise<ISemanticsEntry[]>;

/** Called for every value; return `'skip'` to leave the value's children unvisited. */
export type ParamsVisitor = (visit: ParamsVisit) => void | 'skip' | Promise<void | 'skip'>;

type Container = Record<string, unknown> | unknown[];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

class Walk {
  constructor(
    private readonly getSemantics: SemanticsLookup,
    private readonly visit: ParamsVisitor,
  ) {}

  async fields(semantics: ISemanticsEntry[], params: unknown, path: string, depth: number): Promise<void> {
    if (!isObject(params)) return;
    for (const entry of semantics) {
      await this.entry(entry, params, entry.name, `${path}.${entry.name}`, depth);
    }
  }

  async entry(
    semantics: ISemanticsEntry,
    container: Container,
    key: string | number,
    path: string,
    depth: number,
  ) {
    const value = (container as Record<string | number, unknown>)[key];
    if (value === undefined) return;
    const fields = semantics.fields ?? [];
    // WHY: H5P stores a group with one field as that field's value, not as an object (see Lumi's ContentScanner).
    const single = fields.length === 1 ? fields[0] : undefined;
    if (semantics.type === 'group' && single && !(isObject(value) && value[semantics.name])) {
      await this.entry({ ...single, name: semantics.name }, container, key, path, depth);
      return;
    }
    if ((await this.visit({ semantics, value, container, key, path })) === 'skip') return;
    if (semantics.type === 'group' && isObject(value)) {
      for (const field of fields) await this.entry(field, value, field.name, `${path}.${field.name}`, depth);
    } else if (semantics.type === 'list' && Array.isArray(value) && semantics.field) {
      for (let index = 0; index < value.length; index += 1) {
        await this.entry(semantics.field, value, index, `${path}[${index}]`, depth);
      }
    } else if (semantics.type === 'library' && isObject(value) && typeof value.library === 'string') {
      await this.library(value.library, value.params, `${path}.params`, depth + 1);
    }
  }

  async library(ubername: string, params: unknown, path: string, depth: number): Promise<void> {
    if (depth > MAX_LIBRARY_DEPTH) throw new H5pError('hvl:content-too-deep', { path }, 400);
    let name: ILibraryName;
    try {
      name = LibraryName.fromUberName(ubername, { useWhitespace: true });
    } catch {
      return; // WHY: the visitor already saw this value; policies refuse names they cannot read.
    }
    await this.fields(await this.getSemantics(name), params, path, depth);
  }
}

/**
 * Visits every value of the content parameters and of all nested sub-content.
 * @param params - The content parameters (content.json); visitors may change values in place.
 * @param mainLibrary - The content's main library.
 * @param getSemantics - Semantics lookup.
 * @param visit - Called once per value, parents before children.
 */
export async function walkParams(
  params: Record<string, unknown>,
  mainLibrary: ILibraryName,
  getSemantics: SemanticsLookup,
  visit: ParamsVisitor,
): Promise<void> {
  const walk = new Walk(getSemantics, visit);
  await walk.fields(await getSemantics(mainLibrary), params, '$', 0);
}
