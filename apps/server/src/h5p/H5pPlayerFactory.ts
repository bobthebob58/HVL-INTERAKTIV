/**
 * H5pPlayerFactory — builds the one H5PPlayer the server uses, with HVL's permission system and assets.
 *
 * Why: Lumi's player defaults to allow-everything permissions and to its own HTML template, which puts the
 *      integration object into a `<script>` unescaped (D-040). The factory sets HVL's permission system, the
 *      learner-state storage, Nynorsk-first strings and the Core 1.28 styles (F3), and makes `render` return
 *      the model so ../http/routes/playerRoutes.ts renders it with our template.
 * Spec: H5P-004, H5P-005, H5P-006, H5P-007, H5P-008, SEC-008, PROD-013
 * Invariants:
 *   - The renderer returns the model unchanged; HTML is produced only by ./render/playerPage.ts.
 *   - Every URL comes from the HvlUrlGenerator passed in: tokens on H5P's AJAX URLs and a signed `contentUrl`
 *     for the activity's files (H5P-007, D-058).
 *   - `render` always loads the activity as the acting user, so Lumi's View check runs before the grant is
 *     signed: `ignoreUserPermissions`, `parametersOverride` and `metadataOverride` are refused (D-058).
 *   - Built by createH5pRuntime with the editor's inputs: one permission system, one state storage, and the
 *     same library storage, each engine behind its own language-fallback wrapper.
 *   - With `contentVersions` (createH5pRuntime always passes it), every rendered model's learner-state URL carries
 *     the activity's version, so a page opened before a structural save cannot write its old state (D-093).
 * Collaborators: ./h5pAssets.ts, ./HvlUrlGenerator.ts, ./render/playerPage.ts,
 *   ./storage/LanguageFallbackLibraryStorage.ts, ./createH5pRuntime.ts,
 *   ../learningDesign/safeEditing/contentVersionOnPages.ts.
 * Tests: apps/server/test/h5p/H5pFactories.test.ts, apps/server/test/h5p/permissionSystemGuard.test.ts,
 *   apps/server/test/h5p/HvlUrlGenerator.test.ts
 */
import {
  H5PPlayer,
  type IContentStorage,
  type IContentUserDataStorage,
  type IH5PConfig,
  type ILibraryStorage,
  type ILockProvider,
  type IPermissionSystem,
  type IPlayerModel,
  type ITranslationFunction,
} from '@lumieducation/h5p-server';
import {
  stampContentVersion,
  type ContentVersionReader,
} from '../learningDesign/safeEditing/contentVersionOnPages.js';
import { playerGlobalAssets } from './h5pAssets.js';
import type { HvlH5pUser } from './HvlH5pUser.js';
import type { HvlUrlGenerator } from './HvlUrlGenerator.js';
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
  /** Builds every URL of the player page; shared with the editor (H5P-007). */
  readonly urlGenerator: HvlUrlGenerator;
  /** Reads an activity's version for its learner-state URL (D-093); absent in engine-only tests. */
  readonly contentVersions?: ContentVersionReader;
}

/** The renderer that hands Lumi's model to our template instead of Lumi's HTML. */
export const modelRenderer = (model: IPlayerModel): IPlayerModel => model;

/** `render` options that make Lumi skip loading the activity as the acting user, and so its View check. */
export const UNCHECKED_RENDER_OPTIONS = [
  'ignoreUserPermissions',
  'parametersOverride',
  'metadataOverride',
] as const;

// SECURITY: Lumi checks View only while it loads parameters and metadata as the acting user, and signs the
// content-file grant afterwards (./HvlUrlGenerator.ts). With these options it would sign one unchecked (D-058).
function refuseUncheckedRenders(player: H5PPlayer): void {
  const render = player.render.bind(player);
  player.render = (contentId, actingUser, language, options) => {
    const unchecked = UNCHECKED_RENDER_OPTIONS.filter((name) => Boolean(options?.[name]));
    if (unchecked.length > 0)
      return Promise.reject(new Error(`H5PPlayer.render refuses ${unchecked.join(', ')}`));
    return render(contentId, actingUser, language, options);
  };
}

/**
 * Builds the player.
 * @param inputs - Config, storages, permission system, translation, URL generator and the version reader.
 * @returns The player; `render` resolves to an `IPlayerModel` (with the version in its state URL when a reader is
 *   given) and refuses `UNCHECKED_RENDER_OPTIONS`.
 */
export function createHvlPlayer(inputs: PlayerFactoryInputs): H5PPlayer {
  const urls = inputs.urlGenerator;
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
  refuseUncheckedRenders(player);
  if (inputs.contentVersions) stampContentVersion(player, inputs.contentVersions);
  return player;
}
