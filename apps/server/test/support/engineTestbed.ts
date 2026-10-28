/**
 * engineTestbed — builds editor and player through the production factories on Lumi's file storages.
 *
 * Why: the factories decide every engine option (permissions, assets, local ID, translation, sanitisers); tests
 *      check those decisions on the real Lumi classes without a database, S3 or Redis.
 * Spec: H5P-001, H5P-006, H5P-008
 * Tests: shared by apps/server/test/h5p/H5pFactories.test.ts and apps/server/test/h5p/permissionSystemGuard.test.ts.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  fsImplementations,
  SimpleLockProvider,
  type H5PPlayer,
  type IFileSanitizer,
  type IH5PConfig,
} from '@lumieducation/h5p-server';
import { ContentFileGrants } from '../../src/h5p/contentFileGrants.js';
import { createH5pConfig } from '../../src/h5p/H5pConfigFactory.js';
import { createHvlEditor, type EditorStorages } from '../../src/h5p/H5pEditorFactory.js';
import { createHvlPlayer } from '../../src/h5p/H5pPlayerFactory.js';
import type { HvlH5PEditor } from '../../src/h5p/HvlH5PEditor.js';
import { createHvlTranslationCallback } from '../../src/h5p/HvlTranslationCallback.js';
import { HvlUrlGenerator } from '../../src/h5p/HvlUrlGenerator.js';
import { keepContentTypeCacheOffline } from '../../src/h5p/offlineContentTypeCache.js';
import { parseKeyring } from '../../src/security/keys/keyring.js';
import { randomKey } from './authEnv.js';
import { RulePermissions } from './rulePermissions.js';
import { syntheticLibraryDir, type SyntheticLibrary } from './syntheticLibraries.js';

/** Editor, player and what they were built from. */
export interface EngineTestbed {
  editor: HvlH5PEditor;
  player: H5PPlayer;
  config: IH5PConfig;
  permissions: RulePermissions;
  storages: EditorStorages;
}

const roots: string[] = [];

/**
 * Builds editor and player through the factories.
 * @param libraries - Synthetic libraries to install.
 * @param fileSanitizers - Sanitisers to pass (none by default).
 * @returns The engines; remove folders with `removeEngineTestbeds`.
 */
export async function engineTestbed(
  libraries: SyntheticLibrary[] = [],
  fileSanitizers: IFileSanitizer[] = [],
): Promise<EngineTestbed> {
  const root = mkdtempSync(join(tmpdir(), 'h5p-engines-'));
  roots.push(root);
  const keyValueStorage = new fsImplementations.InMemoryStorage();
  await keepContentTypeCacheOffline(keyValueStorage);
  const config = await createH5pConfig(undefined, { platformVersion: 'test' });
  const storages: EditorStorages = {
    keyValueStorage,
    libraryStorage: new fsImplementations.FileLibraryStorage(syntheticLibraryDir(libraries)),
    contentStorage: new fsImplementations.FileContentStorage(join(root, 'content')),
    temporaryStorage: new fsImplementations.DirectoryTemporaryFileStorage(join(root, 'tmp')),
    lockProvider: new SimpleLockProvider(),
    contentUserDataStorage: new fsImplementations.FileContentUserDataStorage(join(root, 'state')),
  };
  const permissions = new RulePermissions();
  const translate = createHvlTranslationCallback();
  const audit = { record: async () => undefined };
  const urlGenerator = new HvlUrlGenerator(config, new ContentFileGrants(parseKeyring(`t1=${randomKey(9)}`)));
  const editor = createHvlEditor({
    config,
    storages,
    permissionSystem: permissions,
    // WHY: no database here, so no activity is a paste source anyone may copy from (the guard refuses them all).
    contentFacts: { factsFor: async () => undefined },
    audit,
    translate,
    fileSanitizers,
    urlGenerator,
  });
  const player = createHvlPlayer({
    ...storages,
    config,
    permissionSystem: permissions,
    translate,
    urlGenerator,
  });
  return { editor, player, config, permissions, storages };
}

/** Removes every folder made by `engineTestbed` (call in `afterAll`). */
export function removeEngineTestbeds(): void {
  roots.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));
}
