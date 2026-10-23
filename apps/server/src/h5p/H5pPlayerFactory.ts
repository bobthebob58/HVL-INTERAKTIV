/**
 * H5pPlayerFactory — builds the one H5PPlayer the server uses, with HVL's permission system and assets.
 *
 * Why: Lumi's player defaults to allow-everything permissions and to its own HTML template, which puts the
 *      integration object into a `<script>` unescaped (A1, D-040). The factory sets HVL's permission system, the
 *      learner-state storage, Nynorsk-first strings and the Core 1.28 styles (F3), and makes `render` return
 *      the model so ../http/routes/playerRoutes.ts renders it with our template.
 * Spec: H5P-004, H5P-005, H5P-006, H5P-008, SEC-008
 * Invariants:
 *   - The renderer returns the model unchanged; HTML is produced only by ./render/playerPage.ts.
 *   - The player and the editor share the same permission system, library storage wrapper and state storage.
 * Collaborators: ./h5pAssets.ts, ./render/playerPage.ts, ./storage/LanguageFallbackLibraryStorage.ts,
 *   ./createH5pRuntime.ts.
 * Tests: apps/server/test/h5p/H5pFactories.test.ts, apps/server/test/h5p/permissionSystemGuard.test.ts
 */
import {
  H5PPlayer,
  UrlGenerator,
  type IContentStorage,
  type IContentUserDataStorage,
  type IH5PConfig,
  type ILibraryStorage,
  type ILockProvider,
  type IPermissionSystem,
  type IPlayerModel,
  type ITranslationFunction,
} from '@lumieducation/h5p-server';
import { playerGlobalAssets } from './h5pAssets.js';
import type { HvlH5pUser } from './HvlH5pUser.js';
import { withLanguageFallback } from './storage/LanguageFallbackLibraryStorage.js';

/** Everything the player is built from. */
export interface PlayerFactoryInputs {
  readonly config: IH5PConfig;
  /** The plain library storage; the factory adds the language fallback. */
  readonly libraryStorage: ILibraryStorage;
  readonly contentStorage: IContentStorage;
  readonly contentUserDataStorage: IContentUserDataStorage;
  readonly lockProvider: ILockProvider;
  readonly permissionSystem: IPermissionSystem<HvlH5pUser>;
  readonly translate: ITranslationFunction;
}

/** The renderer that hands Lumi's model to our template instead of Lumi's HTML. */
export const modelRenderer = (model: IPlayerModel): IPlayerModel => model;

/**
 * Builds the player.
 * @param inputs - Config, storages, permission system and translation.
 * @returns The player; `render` resolves to an `IPlayerModel`.
 */
export function createHvlPlayer(inputs: PlayerFactoryInputs): H5PPlayer {
  const urls = new UrlGenerator(inputs.config);
  const player = new H5PPlayer(
    withLanguageFallback(inputs.libraryStorage),
    inputs.contentStorage,
    inputs.config,
    undefined,
    urls,
    inputs.translate,
    {
      // WHY: Lumi types the option as IPermissionSystem<IUser>; ours denies any user it did not issue.
      permissionSystem: inputs.permissionSystem as unknown as IPermissionSystem,
      lockProvider: inputs.lockProvider,
      customization: { global: playerGlobalAssets(urls) },
    },
    inputs.contentUserDataStorage,
  );
  player.setRenderer(modelRenderer);
  return player;
}
