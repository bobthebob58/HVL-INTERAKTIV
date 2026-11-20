/**
 * Tests for the start-up sweep of upload folders an earlier run left behind: only the server's own folders, only
 * old ones, and never an error.
 *
 * Spec: SEC-005
 */
import { mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UPLOAD_FOLDER_PREFIX } from '../../src/http/multipartUpload.js';
import {
  OWN_FOLDER_PREFIXES,
  removeStaleUploadFolders,
  STALE_AFTER_MS,
} from '../../src/http/staleUploadFolders.js';
import { SVG_COPY_FOLDER_PREFIX } from '../../src/security/SvgSanitizer.js';

describe('[SEC-005] stale upload folders', () => {
  let dir: string;
  const now = Date.now();
  /** Makes a folder with one file, last changed `ageMs` ago. */
  const folder = (name: string, ageMs: number): void => {
    mkdirSync(join(dir, name));
    writeFileSync(join(dir, name, 'upload.h5p'), 'x');
    const changed = new Date(now - ageMs);
    utimesSync(join(dir, name), changed, changed);
  };
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'stale-sweep-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('[SEC-005] removes the server’s own folders that are older than an hour, with their files', async () => {
    // Arrange
    folder(`${UPLOAD_FOLDER_PREFIX}old`, STALE_AFTER_MS + 60_000);
    folder(`${SVG_COPY_FOLDER_PREFIX}old`, STALE_AFTER_MS + 60_000);
    folder(`${UPLOAD_FOLDER_PREFIX}fresh`, 5_000);
    folder('someone-elses-old-folder', STALE_AFTER_MS * 10);
    // Act
    const removed = await removeStaleUploadFolders({ dir, now });
    // Assert
    expect(removed).toBe(2);
    expect(readdirSync(dir).sort()).toEqual([`${UPLOAD_FOLDER_PREFIX}fresh`, 'someone-elses-old-folder']);
    expect(OWN_FOLDER_PREFIXES).toEqual(['hvli-upload-', 'hvl-svg-']);
  });

  it('[SEC-005] leaves a file with a folder’s name alone, and a missing temporary folder is no error', async () => {
    // Arrange
    writeFileSync(join(dir, `${UPLOAD_FOLDER_PREFIX}a-file`), 'x');
    const old = new Date(now - STALE_AFTER_MS * 2);
    utimesSync(join(dir, `${UPLOAD_FOLDER_PREFIX}a-file`), old, old);
    // Act
    const removed = await removeStaleUploadFolders({ dir, now });
    const nowhere = await removeStaleUploadFolders({ dir: join(dir, 'missing'), now });
    // Assert
    expect([removed, nowhere]).toEqual([0, 0]);
    expect(readdirSync(dir)).toEqual([`${UPLOAD_FOLDER_PREFIX}a-file`]);
  });
});
