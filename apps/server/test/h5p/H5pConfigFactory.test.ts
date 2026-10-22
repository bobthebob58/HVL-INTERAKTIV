/**
 * Tests for the H5P configuration: Core 1.28, the new Hub, limits, allowlist and Hub workarounds.
 *
 * Spec: H5P-001, SEC-005, SEC-002
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { H5PConfig, type IKeyValueStorage } from '@lumieducation/h5p-server';
import {
  CONTENT_WHITELIST,
  LOCAL_ID_MAX_LENGTH,
  STORAGE_LOADABLE_SETTINGS,
  createH5pConfig,
  localIdFor,
} from '../../src/h5p/H5pConfigFactory.js';

const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const THIS_FILE = fileURLToPath(import.meta.url);
const OPTIONS = { platformVersion: '0.1.0' };

/** A settings store that already holds stale values, as an older installation might. */
const staleStorage = (): IKeyValueStorage => {
  const values: Record<string, unknown> = {
    hubContentTypesEndpoint: 'https://api.h5p.org/v1/content-types/',
    maxFileSize: 1024 * 1024 * 1024,
    contentWhitelist: 'json png xml swf',
    libraryWhitelist: 'js css html php',
    proxy: { host: 'attacker.example', port: 8080 },
    customization: { global: { player: { scripts: ['https://cdn.example/evil.js'] } } },
    baseUrl: 'https://attacker.example/h5p',
    contentFilesUrlPlayerOverride: 'https://attacker.example/files/{{contentId}}',
    libraryConfig: {
      'H5P.MathDisplay': { renderer: { mathjax: { src: 'https://attacker.example/mj.js' } } },
    },
    playerAddons: { 'H5P.InteractiveVideo': ['H5P.Evil'] },
    sendUsageStatistics: true,
    uuid: 'stored-uuid',
    contentUserStateSaveInterval: 15_000,
  };
  return { load: async (key) => values[key], save: async (key, value) => (values[key] = value) };
};

describe('[H5P-001] Core API 1.28 and the new Hub', () => {
  it('[H5P-001] targets Core 1.28 and hub-api.h5p.org', async () => {
    const config = await createH5pConfig(undefined, OPTIONS);
    expect(config.coreApiVersion).toEqual({ major: 1, minor: 28 });
    expect(config.hubContentTypesEndpoint).toBe('https://hub-api.h5p.org/v1/content-types/');
    expect(config.hubRegistrationEndpoint).toBe('https://hub-api.h5p.org/v1/sites');
  });

  it('[H5P-001] stored settings cannot bring back the old Hub or looser limits', async () => {
    const config = await createH5pConfig(staleStorage(), OPTIONS);
    expect(config.hubContentTypesEndpoint).toBe('https://hub-api.h5p.org/v1/content-types/');
    expect(config.maxFileSize).toBe(50 * 1024 * 1024);
    expect(config.contentWhitelist).toBe(CONTENT_WHITELIST);
    expect(config.libraryWhitelist).toBe(new H5PConfig().libraryWhitelist);
    expect(config.proxy).toBeUndefined();
    expect(JSON.stringify(config.customization)).not.toContain('evil.js');
    expect(config.uuid).toBe('stored-uuid');
    expect(config.contentUserStateSaveInterval).toBe(15_000);
  });

  it('[H5P-001] stored settings cannot change which scripts or file URLs a page loads', async () => {
    const config = await createH5pConfig(staleStorage(), OPTIONS);
    const defaults = new H5PConfig();
    expect(config.baseUrl).toBe(defaults.baseUrl);
    expect(config.contentFilesUrlPlayerOverride).toBeUndefined();
    expect(config.libraryConfig).toBeUndefined();
    expect(config.playerAddons).toBeUndefined();
    expect(config.sendUsageStatistics).toBe(false);
    expect(config.h5pVersion).toBe('1.28.0');
    for (const key of STORAGE_LOADABLE_SETTINGS) expect(Object.keys(defaults), key).toContain(key);
  });

  it('[H5P-001] uses a pre-registered site UUID (F2) and a local_id of at most 15 characters (F1)', async () => {
    const uuid = '0b3c6a9e-6d1f-4c1e-9f0a-2f6a1d2b3c4d';
    expect((await createH5pConfig(staleStorage(), { ...OPTIONS, siteUuid: uuid })).uuid).toBe(uuid);
    expect(localIdFor(uuid)).toMatch(new RegExp(`^[0-9a-f]{${LOCAL_ID_MAX_LENGTH}}$`));
    expect(localIdFor(uuid)).toBe(localIdFor(uuid));
  });

  it('[H5P-001] sends no usage statistics and disables Content Hub sharing', async () => {
    const config = await createH5pConfig(undefined, OPTIONS);
    expect(config.sendUsageStatistics).toBe(false);
    expect(config.contentHubEnabled).toBe(false);
  });

  it('[H5P-001] no source file refers to the retired api.h5p.org Hub', () => {
    // WHY: built from parts so this test file does not contain the string it searches for.
    const oldHost = ['//api', 'h5p', 'org'].join('.');
    const sources = ['apps', 'packages', 'tools']
      .flatMap((dir) => {
        try {
          return readdirSync(join(REPO, dir), { recursive: true, withFileTypes: true });
        } catch {
          return [];
        }
      })
      .filter((e) => e.isFile() && /\.(ts|tsx|js|mjs|sh|json)$/.test(e.name))
      .map((e) => join(e.parentPath, e.name))
      .filter(
        (f) => !/node_modules|[\\/]h5p[\\/](core|editor)[\\/]|[\\/]generated[\\/]/.test(f) && f !== THIS_FILE,
      );
    const offenders = sources
      .filter((f) => readFileSync(f, 'utf8').includes(oldHost))
      .map((f) => relative(REPO, f));
    expect(sources.length).toBeGreaterThan(20);
    expect(offenders).toEqual([]);
  });
});

describe('[SEC-005] size limits', () => {
  it('[SEC-005] limits single files to 50 MB and packages to 200 MB', async () => {
    const config = await createH5pConfig(undefined, OPTIONS);
    expect(config.maxFileSize).toBe(52_428_800);
    expect(config.maxTotalSize).toBe(209_715_200);
  });
});

describe('[SEC-002] narrowed content allowlist', () => {
  it('[SEC-002] allows exactly the extensions the ten types need', async () => {
    const allowed = (await createH5pConfig(undefined, OPTIONS)).contentWhitelist.split(' ');
    expect(allowed).toEqual(CONTENT_WHITELIST.split(' '));
    for (const removed of ['xml', 'swf', 'md', 'textile', 'diff', 'patch', 'html', 'js']) {
      expect(allowed, removed).not.toContain(removed);
    }
  });
});
