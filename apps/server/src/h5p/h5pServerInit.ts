/**
 * h5pServerInit — the H5P part of server startup: check the client files, build the config, log what runs.
 *
 * Why: H5P-001 requires the server to refuse to start when the fetched core files and the config disagree,
 *      and to log the core version and Hub host it starts with. One function does this for the server
 *      (S2) and for the boot check that CI runs now.
 * Spec: H5P-001
 * Invariants:
 *   - Relative H5P folders in the config are resolved against the server package root (apps/server).
 *   - Nothing is logged that identifies a person; the site UUID is not logged either.
 * Collaborators: ./H5pConfigFactory.ts, ./coreVersionCheck.ts, ./bootCheck.ts, ../config/env.ts.
 * Tests: apps/server/test/h5p/h5pServerInit.test.ts
 */
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { H5PConfig, IKeyValueStorage } from '@lumieducation/h5p-server';
import type { Logger } from 'pino';
import serverPackage from '../../package.json' with { type: 'json' };
import type { Env } from '../config/env.js';
import { assertClientFiles, type CoreApiVersion } from './coreVersionCheck.js';
import { createH5pConfig } from './H5pConfigFactory.js';

/** The server package root (apps/server), used to resolve relative folders from the config. */
export const SERVER_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** Inputs of `h5pServerInit`. */
export interface H5pServerInitOptions {
  env: Pick<Env, 'H5P_CORE_DIR' | 'H5P_EDITOR_DIR' | 'H5P_LIBRARY_DIR' | 'H5P_SITE_UUID'>;
  logger: Logger;
  /** Shared settings store; omit to keep settings in memory (boot check, tests). */
  keyValueStorage?: IKeyValueStorage;
  /** Base folder for relative paths; defaults to `SERVER_ROOT`. */
  root?: string;
  /** Reported to the Hub; defaults to the version in apps/server/package.json. */
  platformVersion?: string;
}

/** What startup needs next. */
export interface H5pServerInitResult {
  config: H5PConfig;
  coreVersion: CoreApiVersion;
  paths: { coreDir: string; editorDir: string; libraryDir: string };
}

/**
 * Validates the H5P client files and builds the H5P configuration.
 * @param options - Config, logger and optional storage.
 * @returns The config, the verified core version and the resolved folders.
 * @throws CoreVersionMismatchError when the client files are missing or have another core API version.
 */
export async function h5pServerInit(options: H5pServerInitOptions): Promise<H5pServerInitResult> {
  const root = options.root ?? SERVER_ROOT;
  const at = (dir: string) => (isAbsolute(dir) ? dir : resolve(root, dir));
  const paths = {
    coreDir: at(options.env.H5P_CORE_DIR),
    editorDir: at(options.env.H5P_EDITOR_DIR),
    libraryDir: at(options.env.H5P_LIBRARY_DIR),
  };
  const config = await createH5pConfig(options.keyValueStorage, {
    siteUuid: options.env.H5P_SITE_UUID,
    platformVersion: options.platformVersion ?? serverPackage.version,
  });
  const coreVersion = assertClientFiles(paths.coreDir, paths.editorDir, config.coreApiVersion);
  options.logger.info(
    {
      h5pCoreApi: `${coreVersion.major}.${coreVersion.minor}`,
      hubHost: new URL(config.hubContentTypesEndpoint).host,
      siteRegistered: config.uuid !== '',
    },
    'H5P engine configured',
  );
  return { config, coreVersion, paths };
}
