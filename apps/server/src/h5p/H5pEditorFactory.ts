/**
 * H5pEditorFactory — builds the one HvlH5PEditor the server uses, with every HVL option set.
 *
 * Why: Lumi's defaults are unsafe or wrong for HVL (allow-everything permissions, Core 1.27 assets, a 64-char
 *      Hub `local_id`, English-only strings, no upload sanitisers). One factory sets them all, so no code path
 *      can build an editor that misses one (H5P-002, H5P-006, H5P-008, SEC-001/002).
 * Spec: H5P-002, H5P-006, H5P-008, SEC-001, SEC-002, SEC-008
 * Invariants:
 *   - `options.permissionSystem` and the editor policy hold the same HvlPermissionSystem instance.
 *   - The library storage is the language-fallback wrapper; DragQuestion is removed from every semantics.
 *   - F1: `local_id` is at most 15 characters; F3: Core 1.28 styles and scripts are added (./h5pAssets.ts).
 *   - The file sanitisers run on every uploaded file (editor uploads and package import).
 *   - `render` returns Lumi's model, never Lumi's HTML (its template is unsafe, D-040).
 * Collaborators: ./HvlH5PEditor.ts, ./h5pAssets.ts, ./H5pConfigFactory.ts, ./semantics/removeDragQuestion.ts,
 *   ./storage/LanguageFallbackLibraryStorage.ts, ./createH5pRuntime.ts.
 * Tests: apps/server/test/h5p/H5pFactories.test.ts, apps/server/test/h5p/permissionSystemGuard.test.ts
 */
import {
  UrlGenerator,
  type IContentStorage,
  type IContentUserDataStorage,
  type IFileSanitizer,
  type IH5PConfig,
  type IKeyValueStorage,
  type ILibraryStorage,
  type ILockProvider,
  type IPermissionSystem,
  type ITemporaryFileStorage,
  type ITranslationFunction,
} from '@lumieducation/h5p-server';
import { editorGlobalAssets } from './h5pAssets.js';
import { localIdFor } from './H5pConfigFactory.js';
import { HvlH5PEditor } from './HvlH5PEditor.js';
import type { HvlH5pUser } from './HvlH5pUser.js';
import type { LibraryAuditSink } from './libraries/LibraryAuditRecorder.js';
import { removeDragQuestion } from './semantics/removeDragQuestion.js';
import { withLanguageFallback } from './storage/LanguageFallbackLibraryStorage.js';

/** The storages the editor works on. */
export interface EditorStorages {
  readonly keyValueStorage: IKeyValueStorage;
  /** The plain library storage; the factory adds the language fallback. */
  readonly libraryStorage: ILibraryStorage;
  readonly contentStorage: IContentStorage;
  readonly temporaryStorage: ITemporaryFileStorage;
  readonly lockProvider: ILockProvider;
  readonly contentUserDataStorage: IContentUserDataStorage;
}

/** Everything the editor is built from. */
export interface EditorFactoryInputs {
  readonly config: IH5PConfig;
  readonly storages: EditorStorages;
  readonly permissionSystem: IPermissionSystem<HvlH5pUser>;
  readonly audit: LibraryAuditSink;
  readonly translate: ITranslationFunction;
  readonly fileSanitizers: readonly IFileSanitizer[];
}

/**
 * Builds the editor.
 * @param inputs - Config, storages, permission system, audit sink, translation and sanitisers.
 * @returns The editor; check it with `assertPermissionSystem` before use.
 */
export function createHvlEditor(inputs: EditorFactoryInputs): HvlH5PEditor {
  const { config, storages, permissionSystem } = inputs;
  const urls = new UrlGenerator(config);
  const editor = new HvlH5PEditor(
    [
      storages.keyValueStorage,
      config,
      withLanguageFallback(storages.libraryStorage),
      storages.contentStorage,
      storages.temporaryStorage,
      inputs.translate,
      urls,
      {
        // WHY: Lumi types the option as IPermissionSystem<IUser>; ours denies any user it did not issue.
        permissionSystem: permissionSystem as unknown as IPermissionSystem,
        lockProvider: storages.lockProvider,
        fileSanitizers: [...inputs.fileSanitizers],
        customization: { alterLibrarySemantics: removeDragQuestion, global: editorGlobalAssets(urls) },
        // WHY: F1, the new Hub refuses a local_id over 15 characters; read lazily, the UUID may arrive later.
        getLocalIdOverride: () => localIdFor(config.uuid),
        enableHubLocalization: true,
        enableLibraryNameLocalization: true,
      },
      storages.contentUserDataStorage,
    ],
    { permissionSystem, audit: inputs.audit },
  );
  // SECURITY: Lumi's editor template puts the integration JSON in a <script> unescaped (D-040); S4 brings ours.
  editor.setRenderer((model) => model);
  return editor;
}
