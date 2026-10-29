/**
 * skeletonFile — the schema and the file names of a pattern skeleton: the H5P parameters an activity is created
 * from, with `{{token}}`s where the pattern's texts go.
 *
 * Why: D-084 puts the skeleton beside `pattern.yaml`, pinned to a library version, so ALU can make one from an
 *      exported `.h5p` without code (PED-011). Its form must be checked like any content file, by file and key.
 * Spec: PED-010, PED-011
 * Invariants:
 *   - A skeleton is a JSON object with exactly `library` (`H5P.Name major.minor`), `metadataTitle` (the activity's
 *     title, which may hold tokens) and `params` (content.json, an object).
 *   - A pattern with one content type has `skeleton.json`; one with two has `skeleton.<content type>.json` for each,
 *     e.g. `skeleton.H5P.DragText.json` and `skeleton.H5P.Blanks.json`, and no `skeleton.json`.
 *   - The skeleton's library is the content type its file is for.
 * Collaborators: ./contentSource.ts (reads it), ./patternFolder.ts, ./installedLibraries.ts (`parseLibraryName`).
 * Tests: apps/server/test/learningDesign/content/patternContent.test.ts
 */
import type { AuthorableContentType } from '@hvl-interaktiv/api-contract';
import { z } from 'zod';
import { parseLibraryName } from './installedLibraries.js';

/** The parameters of an activity or of a skeleton (content.json). */
export type SkeletonParams = Readonly<Record<string, unknown>>;

/** A loaded skeleton file. */
export interface SkeletonFile {
  /** The main library with its version, e.g. `H5P.Blanks 1.14`. */
  readonly library: string;
  /** The activity's title; may hold `{{token}}`s. */
  readonly metadataTitle: string;
  /** content.json, with `{{token}}`s in its strings. */
  readonly params: SkeletonParams;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The schema of a skeleton file. */
export const skeletonFileSchema: z.ZodType<SkeletonFile> = z.strictObject({
  library: z
    .string()
    .refine(
      (library) => parseLibraryName(library) !== undefined,
      'must name the library with its version, e.g. "H5P.Blanks 1.14"',
    ),
  metadataTitle: z.string().trim().min(1, 'is empty'),
  params: z.custom<SkeletonParams>(isObject, 'must be an object: the content.json of the activity'),
});

/**
 * The skeleton file of one content type.
 * @param contentTypes - The pattern's content types.
 * @param contentType - One of them.
 * @returns `skeleton.json` for a pattern with one type, else `skeleton.<type>.json`.
 * @example skeletonFileName(['H5P.DragText', 'H5P.Blanks'], 'H5P.Blanks') === 'skeleton.H5P.Blanks.json'
 */
export function skeletonFileName(
  contentTypes: readonly AuthorableContentType[],
  contentType: AuthorableContentType,
): string {
  return contentTypes.length === 1 ? 'skeleton.json' : `skeleton.${contentType}.json`;
}
