/**
 * H5pConfigFactory — builds the H5P engine configuration: Core API 1.28, the new Hub, our size limits
 * and our file allowlist.
 *
 * Why: h5p-server 10.0.4 defaults to Core 1.27 and the retired `api.h5p.org` Hub, and it loads stored
 *      settings over its defaults. Building the config here, and re-applying the enforced values after
 *      loading, means no stored or default value can bring the old Hub or looser limits back.
 * Spec: H5P-001, SEC-005, SEC-002
 * Invariants:
 *   - `coreApiVersion` is 1.28; both Hub endpoints are on hub-api.h5p.org (F1/F2 workarounds below).
 *   - `maxFileSize` 50 MB, `maxTotalSize` 200 MB, narrowed `contentWhitelist` (SEC-002 list).
 *   - Usage statistics and the H5P Content Hub (sharing to h5p.com) are off: no learner or author data
 *     leaves HVL without a decision. Finished data is off and state is saved every 5 s (D-037).
 *   - Only the settings in `STORAGE_LOADABLE_SETTINGS` keep a stored value; URLs, library config,
 *     customisation, add-ons, proxy and allowlists always come from Lumi's defaults or from this file.
 * Collaborators: ./h5pServerInit.ts, ./storage/RedisKeyValueStorage.ts, ../config/env.ts.
 * Tests: apps/server/test/h5p/H5pConfigFactory.test.ts
 */
import { createHash } from 'node:crypto';
import { H5PConfig, type IKeyValueStorage } from '@lumieducation/h5p-server';

/** The H5P core API version this service is built for (H5P-001). */
export const CORE_API_VERSION = { major: 1, minor: 28 } as const;
/** Core release served to browsers and reported to the Hub; matches CORE_TAG in tools/h5p-core. */
export const H5P_CORE_VERSION = '1.28.0';
/** Content-type list endpoint of the new Hub. */
export const HUB_CONTENT_TYPES_ENDPOINT = 'https://hub-api.h5p.org/v1/content-types/';
/** Site registration endpoint of the new Hub. */
export const HUB_REGISTRATION_ENDPOINT = 'https://hub-api.h5p.org/v1/sites';
/** Largest single file in content or a package: 50 MB (SEC-005). */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;
/** Largest unpacked package: 200 MB (SEC-005). */
export const MAX_TOTAL_SIZE = 200 * 1024 * 1024;
/** File extensions allowed in content, narrowed to what the ten types need (SEC-002). */
export const CONTENT_WHITELIST =
  'json png jpg jpeg gif webp svg webm mp4 mp3 m4a ogg wav vtt webvtt pdf txt csv docx xlsx pptx odt ods odp';
/** How often the player saves learner state, in milliseconds (`H5P-005`: the H5P default of 5 s). */
export const CONTENT_USER_STATE_SAVE_INTERVAL_MS = 5000;
/** The new Hub rejects a `local_id` longer than this (finding F1). */
export const LOCAL_ID_MAX_LENGTH = 15;

/** Options for `createH5pConfig`. */
export interface H5pConfigOptions {
  /** Pre-registered Hub site UUID (H5P_SITE_UUID). Workaround F2: with a UUID, no registration call is made. */
  siteUuid?: string | undefined;
  /** Version string reported to the Hub as `platform_version`. */
  platformVersion: string;
}

/**
 * Derives the `local_id` sent to the Hub, short enough for the new Hub (finding F1).
 * @param seed - A stable installation value, e.g. the site UUID.
 * @returns 15 lowercase hex characters.
 *
 * UPSTREAM: https://github.com/Lumieducation/H5P-Nodejs-library/commit/fcc7063 fixes this, unreleased
 *   (docs/reference/h5p-core-1.28-seed-packages/README.md §4).
 */
export function localIdFor(seed: string): string {
  return createHash('sha256').update(seed).digest('hex').slice(0, LOCAL_ID_MAX_LENGTH);
}

/**
 * Settings that may keep a value loaded from storage: the Hub registration result and harmless timings
 * or toggles. Every other setting comes from Lumi's defaults or from this file.
 */
export const STORAGE_LOADABLE_SETTINGS: ReadonlySet<string> = new Set([
  'uuid',
  'contentHubMetadataRefreshInterval',
  'contentTypeCacheRefreshInterval',
  'disableFullscreen',
  'exportMaxContentPathLength',
  'fetchingDisabled',
  'siteType',
]);

/**
 * Sets every value we enforce. Called after `load()`, so stored settings cannot override them.
 * @param config - A loaded config.
 * @param options - Installation options.
 */
export function applyEnforcedSettings(config: H5PConfig, options: H5pConfigOptions): void {
  // SECURITY: a stored baseUrl, file-URL override, libraryConfig, customisation or allowlist would decide
  // which scripts every player and editor page loads, so everything outside the allowlist is reset to
  // Lumi's defaults. Later sessions set such values in code (e.g. the S2 files origin), never from storage.
  const defaults = new H5PConfig() as unknown as Record<string, unknown>;
  const target = config as unknown as Record<string, unknown>;
  for (const key of Object.keys(defaults)) {
    if (key !== 'storage' && !STORAGE_LOADABLE_SETTINGS.has(key))
      target[key] = structuredClone(defaults[key]);
  }
  config.coreApiVersion = { ...CORE_API_VERSION };
  config.h5pVersion = H5P_CORE_VERSION;
  config.hubContentTypesEndpoint = HUB_CONTENT_TYPES_ENDPOINT;
  config.hubRegistrationEndpoint = HUB_REGISTRATION_ENDPOINT;
  config.maxFileSize = MAX_FILE_SIZE;
  config.maxTotalSize = MAX_TOTAL_SIZE;
  config.contentWhitelist = CONTENT_WHITELIST;
  config.platformName = 'HVL Interaktiv';
  config.platformVersion = options.platformVersion;
  // PRIVACY: no usage statistics to H5P Group, and no publishing to the public Content Hub.
  config.sendUsageStatistics = false;
  config.contentHubEnabled = false;
  // PRIVACY: no separate "finished" record per learner; scores reach the LMS through xAPI in S6 (D-037).
  config.setFinishedEnabled = false;
  config.contentUserStateSaveInterval = CONTENT_USER_STATE_SAVE_INTERVAL_MS;
  // UPSTREAM: finding F2, https://github.com/h5p/h5p-wordpress-plugin/commit/79235d0 — a known UUID skips registration.
  if (options.siteUuid) config.uuid = options.siteUuid;
}

/**
 * Creates and loads the H5P configuration.
 * @param storage - Shared settings store (Redis in production); omit for an in-memory config.
 * @param options - Installation options.
 * @returns The loaded config with every enforced value applied.
 */
export async function createH5pConfig(
  storage: IKeyValueStorage | undefined,
  options: H5pConfigOptions,
): Promise<H5PConfig> {
  const config = new H5PConfig(storage);
  await config.load();
  applyEnforcedSettings(config, options);
  return config;
}
