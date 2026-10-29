/**
 * installedLibraries — reads the pinned H5P libraries that `npm run h5p:fetch-libraries` installs (one folder per
 * library, `Name-major.minor`, D-078) into what the pattern check needs: the installed versions of each library
 * and each library's semantics, with the server's own changes applied.
 *
 * Why: the content check must refuse a skeleton that names a library version the editor would not offer, and a text
 *      Lumi would clip (D-084 amendment). The loader is synchronous and runs without a server, so it reads the
 *      library files directly instead of asking Lumi's asynchronous library manager.
 * Spec: PED-010, PED-011
 * Invariants:
 *   - Reads only `library.json` and `semantics.json` of folders directly under `folder`; never runs library code.
 *   - Semantics are filtered as the server's `alterLibrarySemantics` hook filters them (no H5P.DragQuestion option),
 *     so a skeleton is checked against the options the editor and the sub-content policy really allow.
 *   - A missing folder is not an error here: the result says so, and whether the check must fail without it (CI).
 *   - Semantics are read once per library and cached; an unreadable or malformed file reads as "not installed".
 * Collaborators: ./studioContentContext.ts (the optional input), ./contentCheckCli.ts (builds it),
 *   ./skeletonLibraryChecks.ts (uses it), ../../h5p/semantics/removeDragQuestion.ts.
 * Tests: apps/server/test/learningDesign/content/patternLibraryChecks.test.ts
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ISemanticsEntry } from '@lumieducation/h5p-server/build/src/types.js';
import { removeDragQuestion } from '../../h5p/semantics/removeDragQuestion.js';
import { REPOSITORY_ROOT } from './contentProblem.js';

/** Where `npm run h5p:fetch-libraries` writes the library folders. */
export const PINNED_LIBRARIES_DIR = join(REPOSITORY_ROOT, 'apps', 'server', 'var', 'h5p-real', 'libraries');

/** One installed version of a library. */
export interface LibraryVersion {
  readonly major: number;
  readonly minor: number;
}

/** The installed libraries, as the pattern check reads them. */
export interface InstalledLibraryCatalogue {
  /**
   * The installed versions of a library.
   * @param machineName - e.g. `H5P.Column`.
   * @returns Every installed `major.minor`, newest first; empty when none is installed.
   */
  versionsOf(machineName: string): readonly LibraryVersion[];
  /**
   * The semantics of one installed library, as the editor offers them.
   * @param library - `H5P.Name major.minor`.
   * @returns The fields, or undefined when that version is not installed.
   */
  semanticsOf(library: string): readonly ISemanticsEntry[] | undefined;
}

/** The installed libraries for the content check, or the fact that they are missing. */
export type InstalledLibraries =
  | { readonly kind: 'installed'; readonly folder: string; readonly catalogue: InstalledLibraryCatalogue }
  | { readonly kind: 'missing'; readonly folder: string; readonly required: boolean };

const LIBRARY_NAME = /^([A-Za-z][\w.]*) (\d+)\.(\d+)$/;

/**
 * Splits `H5P.Name major.minor` into its parts.
 * @param library - A library name with its version, e.g. `H5P.Blanks 1.14`.
 * @returns The machine name and version, or undefined for anything else.
 */
export function parseLibraryName(library: string): (LibraryVersion & { machineName: string }) | undefined {
  const match = LIBRARY_NAME.exec(library);
  if (!match) return undefined;
  return { machineName: match[1] ?? '', major: Number(match[2]), minor: Number(match[3]) };
}

const readJson = (file: string): unknown => {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as unknown;
  } catch {
    return undefined;
  }
};

function catalogueOf(folder: string): InstalledLibraryCatalogue {
  const versions = new Map<string, LibraryVersion[]>();
  const folders = new Map<string, string>();
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const info = readJson(join(folder, entry.name, 'library.json')) as
      { machineName?: unknown; majorVersion?: unknown; minorVersion?: unknown } | undefined;
    const { machineName, majorVersion: major, minorVersion: minor } = info ?? {};
    if (typeof machineName !== 'string' || typeof major !== 'number' || typeof minor !== 'number') continue;
    versions.set(machineName, [...(versions.get(machineName) ?? []), { major, minor }]);
    folders.set(`${machineName} ${major}.${minor}`, join(folder, entry.name));
  }
  for (const list of versions.values()) list.sort((a, b) => b.major - a.major || b.minor - a.minor);
  const semantics = new Map<string, readonly ISemanticsEntry[] | undefined>();
  return {
    versionsOf: (machineName) => versions.get(machineName) ?? [],
    semanticsOf: (library) => {
      if (!semantics.has(library)) {
        const where = folders.get(library);
        const name = parseLibraryName(library);
        const fields = where ? readJson(join(where, 'semantics.json')) : undefined;
        // WHY: as the server's alterLibrarySemantics hook, so DragQuestion is never an allowed option (D-006).
        const altered =
          name && Array.isArray(fields)
            ? removeDragQuestion(
                { machineName: name.machineName, majorVersion: name.major, minorVersion: name.minor },
                fields as ISemanticsEntry[],
              )
            : undefined;
        semantics.set(library, altered);
      }
      return semantics.get(library);
    },
  };
}

/**
 * Reads the installed library folder for the content check.
 * @param folder - The folder of library folders; `PINNED_LIBRARIES_DIR` by default.
 * @param required - Whether the check must fail when the folder is missing (true in CI).
 * @returns The catalogue, or `missing` when the folder does not exist.
 * @spec PED-011
 */
export function readInstalledLibraries(
  folder: string = PINNED_LIBRARIES_DIR,
  required = false,
): InstalledLibraries {
  if (!existsSync(folder)) return { kind: 'missing', folder, required };
  return { kind: 'installed', folder, catalogue: catalogueOf(folder) };
}
