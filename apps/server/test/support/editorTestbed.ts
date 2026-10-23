/**
 * editorTestbed — builds an HvlH5PEditor on temporary folders for unit tests (no database, no S3).
 *
 * Why: the editor's rules (content types, save order, package import) are tested in isolation on Lumi's own
 *      file-based storages, with synthetic libraries and a rule-based permission system.
 * Spec: H5P-002, SEC-003
 * Tests: shared by apps/server/test/h5p/HvlH5PEditor*.test.ts.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  fsImplementations,
  type IContentUserDataStorage,
  type ILibraryInstallResult,
  type IPermissionSystem,
} from '@lumieducation/h5p-server';
import { createH5pConfig } from '../../src/h5p/H5pConfigFactory.js';
import { HvlH5PEditor } from '../../src/h5p/HvlH5PEditor.js';
import { asAccountUser, type H5pRole, type HvlH5pUser } from '../../src/h5p/HvlH5pUser.js';
import type { LibraryChange } from '../../src/h5p/libraries/LibraryAuditRecorder.js';
import { keepContentTypeCacheOffline } from '../../src/h5p/offlineContentTypeCache.js';
import { removeDragQuestion } from '../../src/h5p/semantics/removeDragQuestion.js';
import { RulePermissions } from './rulePermissions.js';
import { syntheticLibraryDir, type SyntheticLibrary } from './syntheticLibraries.js';

/** An editor with its folders, permission rules and recorded audit entries. */
export interface EditorTestbed {
  editor: HvlH5PEditor;
  permissions: RulePermissions;
  audited: { results: readonly ILibraryInstallResult[]; change: LibraryChange }[];
  /** Set `auditFails` to make every audit write throw (the audit store is down). */
  control: { auditFails: boolean };
  invalidated: string[];
  libraryDir: string;
  user(role: H5pRole): HvlH5pUser;
}

const roots: string[] = [];

/**
 * Builds an editor whose library folder holds the given libraries.
 * @param libraries - Synthetic libraries to install.
 * @returns The editor and its helpers; remove folders with `removeEditorTestbeds`.
 */
export async function editorTestbed(libraries: SyntheticLibrary[]): Promise<EditorTestbed> {
  const root = mkdtempSync(join(tmpdir(), 'h5p-editor-'));
  roots.push(root);
  const libraryDir = syntheticLibraryDir(libraries);
  const cache = new fsImplementations.InMemoryStorage();
  await keepContentTypeCacheOffline(cache);
  const config = await createH5pConfig(undefined, { platformVersion: 'test' });
  const permissions = new RulePermissions();
  const audited: EditorTestbed['audited'] = [];
  const control = { auditFails: false };
  const invalidated: string[] = [];
  const userData = {
    deleteInvalidatedContentUserData: async (contentId: string) => void invalidated.push(contentId),
  } as unknown as IContentUserDataStorage;
  const editor = new HvlH5PEditor(
    [
      cache,
      config,
      new fsImplementations.FileLibraryStorage(libraryDir),
      new fsImplementations.FileContentStorage(join(root, 'content')),
      new fsImplementations.DirectoryTemporaryFileStorage(join(root, 'tmp')),
      undefined,
      undefined,
      {
        // WHY: Lumi types the option as IPermissionSystem<IUser>; ours denies any user it did not issue.
        permissionSystem: permissions as unknown as IPermissionSystem,
        customization: { alterLibrarySemantics: removeDragQuestion },
      },
      userData,
    ],
    {
      permissionSystem: permissions,
      audit: {
        record: async (results, change) => {
          if (control.auditFails) throw new Error('audit store unavailable');
          audited.push({ results, change });
        },
      },
    },
  );
  let n = 0;
  const user = (role: H5pRole): HvlH5pUser =>
    asAccountUser({
      accountId: `0192f0c4-0000-7000-8000-${String((n += 1)).padStart(12, '0')}`,
      role,
      learnerKey: `learner-key-${n}`,
      contextId: '',
      locale: 'nn',
      hvlMember: true,
      feideAuthenticated: true,
      ltiLaunchContentIds: [],
    });
  return { editor, permissions, audited, control, invalidated, libraryDir, user };
}

/** Removes every folder made by `editorTestbed` (call in `afterAll`). */
export function removeEditorTestbeds(): void {
  roots.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
}
