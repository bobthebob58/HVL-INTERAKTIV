/**
 * editorTestbed — builds an HvlH5PEditor on temporary folders for unit tests (no database, no S3).
 *
 * Why: the editor's rules (content types, save order, package import) are tested in isolation on Lumi's own
 *      file-based storages, with synthetic libraries, a rule-based permission system and recorded learner-state
 *      resets (D-093). The editor is built by the production factory, so the tests see the same options (language
 *      fallback, assets, DragQuestion removal, Hub disconnection) as the server.
 * Spec: H5P-002, SEC-003
 * Tests: shared by apps/server/test/h5p/HvlH5PEditor*.test.ts.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  fsImplementations,
  SimpleLockProvider,
  type IContentUserDataStorage,
  type ILibraryInstallResult,
} from '@lumieducation/h5p-server';
import type { LearnerStateStore } from '../../src/learningDesign/safeEditing/LearnerStateGate.js';
import { ContentFileGrants } from '../../src/h5p/contentFileGrants.js';
import { createH5pConfig } from '../../src/h5p/H5pConfigFactory.js';
import { createHvlEditor } from '../../src/h5p/H5pEditorFactory.js';
import type { HvlH5PEditor } from '../../src/h5p/HvlH5PEditor.js';
import { asAccountUser, type H5pRole, type HvlH5pUser } from '../../src/h5p/HvlH5pUser.js';
import { HvlUrlGenerator } from '../../src/h5p/HvlUrlGenerator.js';
import type { LibraryChange } from '../../src/h5p/libraries/LibraryAuditSink.js';
import { keepContentTypeCacheOffline } from '../../src/h5p/offlineContentTypeCache.js';
import { createHvlTranslationCallback } from '../../src/h5p/HvlTranslationCallback.js';
import { parseKeyring } from '../../src/security/keys/keyring.js';
import { randomKey } from './authEnv.js';
import { RulePermissions } from './rulePermissions.js';
import { syntheticLibraryDir, type SyntheticLibrary } from './syntheticLibraries.js';
import { testActor } from './testActors.js';

/** An editor with its folders, permission rules and recorded audit entries. */
export interface EditorTestbed {
  editor: HvlH5PEditor;
  permissions: RulePermissions;
  audited: { results: readonly ILibraryInstallResult[]; change: LibraryChange }[];
  /** Set `auditFails` to make every audit write throw (the audit store is down). */
  control: { auditFails: boolean };
  /** The learner-state rows as the editor sees them: set `othersHaveState`; `resets` lists each reset activity. */
  learnerStates: LearnerStateStore & { othersHaveState: boolean; readonly resets: string[] };
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
  // WHY: the editor no longer deletes Lumi's invalidated state (D-093); a call would show here as a TypeError.
  const userData = {} as unknown as IContentUserDataStorage;
  const resets: string[] = [];
  const learnerStates = {
    othersHaveState: false,
    resets,
    hasOtherLearnersState: async () => learnerStates.othersHaveState,
    resetLearnerState: async (contentId: string) => void resets.push(contentId),
  };
  const editor = createHvlEditor({
    config,
    storages: {
      keyValueStorage: cache,
      libraryStorage: new fsImplementations.FileLibraryStorage(libraryDir),
      contentStorage: new fsImplementations.FileContentStorage(join(root, 'content')),
      temporaryStorage: new fsImplementations.DirectoryTemporaryFileStorage(join(root, 'tmp')),
      lockProvider: new SimpleLockProvider(),
      contentUserDataStorage: userData,
    },
    permissionSystem: permissions,
    // WHY: no database here, so no activity is a paste source anyone may copy from (the guard refuses them all).
    contentFacts: { factsFor: async () => undefined },
    learnerStates,
    // WHY: no Redis here; nothing in these tests copies an activity through the duplicator.
    copyLimit: { take: async () => ({ allowed: true }) },
    audit: {
      record: async (results, change) => {
        if (control.auditFails) throw new Error('audit store unavailable');
        audited.push({ results, change });
      },
    },
    translate: createHvlTranslationCallback(),
    fileSanitizers: [],
    urlGenerator: new HvlUrlGenerator(config, new ContentFileGrants(parseKeyring(`t1=${randomKey(9)}`))),
  });
  const user = (role: H5pRole): HvlH5pUser => asAccountUser(testActor(role));
  return { editor, permissions, audited, control, learnerStates, libraryDir, user };
}

/** Removes every folder made by `editorTestbed` (call in `afterAll`). */
export function removeEditorTestbeds(): void {
  roots.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
}
