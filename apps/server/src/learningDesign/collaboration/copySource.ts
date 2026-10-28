/**
 * copySource — reads the activity a copy is made from, and the h5p.json the copy is saved with.
 *
 * Why: the copy is saved as a new activity of the source's own main library version, with the source's h5p.json,
 *      so its title, licence, authors and languages travel with it (D-092). «Lagre som ny versjon» (D-093) saves the
 *      editor's metadata instead, but the editor may leave out the languages, which h5p.json must keep.
 * Spec: PROD-007, PROD-013
 * Invariants:
 *   - Everything is read through Lumi's content manager, so our permission system checks View on the source.
 *   - The main library comes from h5p.json's `preloadedDependencies`, the exact version the source was saved with;
 *     an h5p.json that does not list it is an error (the copy cannot be saved faithfully).
 *   - Only a missing or empty `defaultLanguage` or `language` is filled in from the source; nothing else is merged.
 * Collaborators: ./ContentDuplicator.ts (the caller), ./ownFileCopies.ts (`ContentManager`).
 * Tests: apps/server/test/learningDesign/collaboration/ContentDuplicator.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/ContentDuplicatorSaveAsCopy.int.test.ts
 */
import {
  LibraryName,
  type ContentParameters,
  type IContentMetadata,
  type IUser,
} from '@lumieducation/h5p-server';
import type { ContentManager } from './ownFileCopies.js';

/** The source of a copy, as stored. */
export interface CopySourceActivity {
  /** h5p.json. */
  readonly metadata: IContentMetadata;
  /** content.json. */
  readonly params: ContentParameters;
  /** The names of the files the source stores. */
  readonly files: readonly string[];
  /** The main library with the version the source was saved with. */
  readonly library: LibraryName;
  /** The same as `H5P.Name major.minor`, as the editor's save takes it. */
  readonly ubername: string;
}

const LANGUAGE_FIELDS = ['defaultLanguage', 'language'] as const;

/**
 * Reads a source activity for copying.
 * @param manager - The editor's content manager.
 * @param sourceId - The source's canonical ID.
 * @param user - The person copying, in the account view.
 * @returns The source's h5p.json, parameters, file names and main library.
 * @throws Error when h5p.json does not list its main library; Lumi's 403 when the person may not View it.
 */
export async function readCopySource(
  manager: ContentManager,
  sourceId: string,
  user: IUser,
): Promise<CopySourceActivity> {
  const metadata = await manager.getContentMetadata(sourceId, user);
  const main = metadata.preloadedDependencies.find((d) => d.machineName === metadata.mainLibrary);
  if (!main) throw new Error('the source h5p.json does not list its main library');
  const { machineName, majorVersion, minorVersion } = main;
  return {
    metadata,
    params: await manager.getContentParameters(sourceId, user),
    files: await manager.listContentFiles(sourceId, user),
    library: new LibraryName(machineName, majorVersion, minorVersion),
    ubername: `${machineName} ${String(majorVersion)}.${String(minorVersion)}`,
  };
}

/**
 * The editor's metadata with the source's languages where the editor sent none.
 * @param given - The metadata the editor sent with «Lagre som ny versjon».
 * @param source - The source's h5p.json.
 * @returns A new object; `given` is not changed.
 */
export function withSourceLanguages(given: IContentMetadata, source: IContentMetadata): IContentMetadata {
  const merged = { ...given };
  for (const field of LANGUAGE_FIELDS) {
    const value: unknown = given[field];
    const fallback: unknown = source[field];
    if ((typeof value !== 'string' || value === '') && typeof fallback === 'string') merged[field] = fallback;
  }
  return merged;
}
