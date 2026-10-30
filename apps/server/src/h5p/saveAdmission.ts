/**
 * saveAdmission — the checks HvlH5PEditor runs on every save before it reads the parameters: the saver's
 * permission, a main library that is one of the ten, and that library being installed.
 *
 * Why: Lumi deletes invalidated learner state and writes files before it checks anything of ours, so the permission
 *      must be decided first (D-038); only the ten types may be saved (`H5P-002`); and a library that is not
 *      installed would otherwise fail deep inside Lumi with a 500. Kept apart from HvlH5PEditor so that the editor
 *      stays one readable list of steps.
 * Spec: H5P-002, H5P-006
 * Invariants:
 *   - Create for a new activity (`contentId` undefined), Edit for an existing one; a refusal is Lumi's own 403
 *     `h5p-server:content-missing-edit-permission`, before anything else is looked at.
 *   - Then the main library must be one of the ten (403 `hvl:content-type-not-allowed`, 400 for a malformed name)
 *     and installed (400 `hvl:library-not-installed`).
 * Collaborators: ./HvlH5PEditor.ts (the caller), ./HvlTop10ContentTypeFilter.ts.
 * Tests: apps/server/test/h5p/HvlH5PEditor.test.ts
 */
import {
  ContentPermission,
  H5pError,
  LibraryName,
  type ContentId,
  type IPermissionSystem,
  type IUser,
  type LibraryManager,
} from '@lumieducation/h5p-server';
import { assertAuthorableMainLibrary } from './HvlTop10ContentTypeFilter.js';
import type { HvlH5pUser } from './HvlH5pUser.js';

/** What the admission reads: the editor's permission system and library manager. */
export interface SaveAdmissionContext {
  readonly permissionSystem: IPermissionSystem<HvlH5pUser>;
  readonly libraryManager: LibraryManager;
}

/**
 * Admits a save, or refuses it before any parameter is read.
 * @param context - The editor's permission system and library manager.
 * @param contentId - The activity being saved; `undefined` for a new one.
 * @param mainLibraryUbername - The main library as the editor sends it, e.g. `H5P.MultiChoice 1.16`.
 * @param user - The saver as Lumi received them.
 * @returns The main library, parsed.
 * @throws H5pError 403 `h5p-server:content-missing-edit-permission`, 403 `hvl:content-type-not-allowed`,
 *   400 `invalid-main-library-name` or 400 `hvl:library-not-installed`.
 * @example
 * const main = await admitSave(this, contentId, 'H5P.MultiChoice 1.16', user);
 * @spec H5P-006
 */
export async function admitSave(
  context: SaveAdmissionContext,
  contentId: ContentId | undefined,
  mainLibraryUbername: string,
  user: IUser,
): Promise<LibraryName> {
  const permission = contentId === undefined ? ContentPermission.Create : ContentPermission.Edit;
  if (!(await context.permissionSystem.checkForContent(user as HvlH5pUser, permission, contentId))) {
    throw new H5pError('h5p-server:content-missing-edit-permission', {}, 403);
  }
  assertAuthorableMainLibrary(mainLibraryUbername);
  const main = LibraryName.fromUberName(mainLibraryUbername, { useWhitespace: true });
  if (!(await context.libraryManager.libraryExists(main))) {
    throw new H5pError('hvl:library-not-installed', { library: main.machineName }, 400);
  }
  return main;
}
