/**
 * Tests for the H5P startup check: matching client files, refusal on mismatch, startup log line.
 *
 * Spec: H5P-001
 */
import { describe, it, expect, afterAll } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import { CoreVersionMismatchError, readCoreApiVersion } from '../../src/h5p/coreVersionCheck.js';
import { h5pServerInit } from '../../src/h5p/h5pServerInit.js';
import { createLogger } from '../../src/logging/logger.js';

const roots: string[] = [];
afterAll(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

/** Builds a fake checkout with core files of the given API version and an editor folder. */
function fakeClientFiles(minor: number | null, withEditor = true): string {
  const root = mkdtempSync(join(tmpdir(), 'h5p-init-'));
  roots.push(root);
  mkdirSync(join(root, 'h5p/core'), { recursive: true });
  if (minor !== null) {
    const php = `class H5PCore {\n  public static $coreApi = array(\n    'majorVersion' => 1,\n    'minorVersion' => ${minor}\n  );\n}`;
    writeFileSync(join(root, 'h5p/core/h5p.classes.php'), php);
  }
  if (withEditor) {
    mkdirSync(join(root, 'h5p/editor/scripts'), { recursive: true });
    writeFileSync(join(root, 'h5p/editor/scripts/h5peditor.js'), '');
  }
  return root;
}

const ENV = {
  H5P_CORE_DIR: 'h5p/core',
  H5P_EDITOR_DIR: 'h5p/editor',
  H5P_LIBRARY_DIR: 'var/libs',
  H5P_SITE_UUID: undefined,
};

const capture = () => {
  const lines: string[] = [];
  const logger = createLogger({
    level: 'info',
    destination: new Writable({ write: (c, _e, done) => (lines.push(String(c)), done()) }),
  });
  return { lines, logger };
};

describe('[H5P-001] startup check of the H5P client files', () => {
  it('[H5P-001] reads the core API version the way H5P declares it', () => {
    expect(readCoreApiVersion(join(fakeClientFiles(28), 'h5p/core'))).toEqual({ major: 1, minor: 28 });
  });

  it('[H5P-001] starts with matching files and logs the core version and Hub host', async () => {
    const { lines, logger } = capture();
    const root = fakeClientFiles(28);
    const result = await h5pServerInit({ env: ENV, logger, root });
    expect(result.coreVersion).toEqual({ major: 1, minor: 28 });
    expect(result.paths.libraryDir).toBe(join(root, 'var/libs'));
    expect(JSON.parse(lines[0] ?? '{}')).toMatchObject({ h5pCoreApi: '1.28', hubHost: 'hub-api.h5p.org' });
  });

  it('[H5P-001] refuses to start when the core files report another version', async () => {
    const { logger } = capture();
    await expect(h5pServerInit({ env: ENV, logger, root: fakeClientFiles(27) })).rejects.toThrow(
      'are API 1.27, but the config expects 1.28',
    );
  });

  it('[H5P-001] refuses to start when the core or editor files are missing', async () => {
    const { logger } = capture();
    await expect(h5pServerInit({ env: ENV, logger, root: fakeClientFiles(null) })).rejects.toThrow(
      CoreVersionMismatchError,
    );
    await expect(h5pServerInit({ env: ENV, logger, root: fakeClientFiles(28, false) })).rejects.toThrow(
      'H5P editor files not found',
    );
  });
});
