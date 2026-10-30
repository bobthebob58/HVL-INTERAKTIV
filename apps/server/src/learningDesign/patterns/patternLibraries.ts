/**
 * patternLibraries — which H5P libraries an activity made from a pattern needs, and whether they are installed.
 *
 * Why: a pattern whose library is missing is shown as unavailable and answers 409 `hvl:pattern-unavailable`
 *      (D-085). "Missing" covers every library the completed skeleton names, not only the main one: the semantics
 *      defaults add libraries (InteractiveVideo's summary brings H5P.Summary), and without this check Lumi's own
 *      error would answer 500 (D-085 amendment, probe P1).
 * Spec: PROD-001, PED-010
 * Invariants:
 *   - A library is named by a `library` string of the form `H5P.Name x.y` (sub-content, as content.json writes it)
 *     at any depth, plus the activity's main library.
 *   - The checked semantics source refuses a library that is not installed with `MissingPatternLibraryError`
 *     before Lumi reads it, so a missing library is told apart from every other failure.
 *   - Reads the library manager only; never installs anything.
 * Collaborators: ./patternActivityBuild.ts, ./PatternCreator.ts, ./semanticDefaults.ts (`SemanticsSource`), Lumi's
 *   LibraryManager.
 * Tests: apps/server/test/learningDesign/patterns/patternLibraries.test.ts
 */
import { LibraryName, type ILibraryName, type LibraryManager } from '@lumieducation/h5p-server';
import type { SemanticsSource } from './semanticDefaults.js';

/** What the checks read from Lumi's library manager. */
export type InstalledLibraryLookup = Pick<LibraryManager, 'libraryExists' | 'getSemantics' | 'getLanguage'>;

// WHY: sub-content names its library as Lumi stores it in content.json (`useWhitespace`).
const LIBRARY = /^[A-Za-z][\w.]* \d+\.\d+$/;
// WHY: content.json nests about 15 levels; a bound keeps malformed parameters from exhausting the stack.
const MAX_DEPTH = 100;

/** A library the pattern needs is not installed. */
export class MissingPatternLibraryError extends Error {
  /**
   * @param library - The missing library as `H5P.Name x.y`.
   */
  constructor(readonly library: string) {
    super(`the library ${library} is not installed`);
    this.name = 'MissingPatternLibraryError';
  }
}

/**
 * Every library a set of parameters names, with the main library first.
 * @param params - The activity's parameters (content.json).
 * @param mainLibrary - The main library as `H5P.Name x.y`.
 * @returns Each library once, in document order.
 * @spec PROD-001
 */
export function librariesNamedIn(params: unknown, mainLibrary: string): string[] {
  const names = new Set<string>([mainLibrary]);
  const visit = (value: unknown, depth: number): void => {
    if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return;
    if (Array.isArray(value)) return value.forEach((item: unknown) => visit(item, depth + 1));
    const library = (value as { library?: unknown }).library;
    if (typeof library === 'string' && LIBRARY.test(library)) names.add(library);
    for (const child of Object.values(value)) visit(child, depth + 1);
  };
  visit(params, 0);
  return [...names];
}

const nameOf = (library: string): ILibraryName => LibraryName.fromUberName(library, { useWhitespace: true });

/**
 * The libraries of a list that are not installed.
 * @param libraries - Libraries as `H5P.Name x.y`.
 * @param lookup - Lumi's library manager.
 * @returns The missing ones, in the list's order.
 * @spec PROD-001
 */
export async function missingLibraries(
  libraries: readonly string[],
  lookup: Pick<InstalledLibraryLookup, 'libraryExists'>,
): Promise<string[]> {
  const installed = await Promise.all(
    libraries.map((library) => lookup.libraryExists(nameOf(library) as LibraryName)),
  );
  return libraries.filter((_, index) => !installed[index]);
}

/**
 * A semantics source for the semantics defaults that refuses a library that is not installed.
 * @param lookup - Lumi's library manager.
 * @returns The source; `getSemantics` throws `MissingPatternLibraryError` for a missing library.
 * @spec PROD-001
 */
export function installedSemanticsSource(lookup: InstalledLibraryLookup): SemanticsSource {
  return {
    getSemantics: async (library) => {
      if (!(await lookup.libraryExists(library as LibraryName)))
        throw new MissingPatternLibraryError(LibraryName.toUberName(library, { useWhitespace: true }));
      return lookup.getSemantics(library);
    },
    getLanguage: (library, language) => lookup.getLanguage(library, language),
  };
}
