/**
 * zipEntryGuard — inspects an uploaded .h5p package before anything is extracted.
 *
 * Why: a package is a zip file from an author's computer. A crafted zip can write outside the target folder
 *      (zip-slip), plant symbolic links, or unpack to far more than it weighs (zip bomb). SEC-005 requires
 *      rejecting these before H5P touches the package.
 * Spec: SEC-005
 * Invariants:
 *   - Only the central directory is read; no entry is extracted or decompressed here.
 *   - Rejected: absolute paths, `..`, `.` and empty segments (only a directory's trailing `/` is allowed),
 *     backslash paths that become any of these, a name that occurs twice, symbolic links, more than
 *     `maxEntries` entries, any entry above `maxFileSize`, a declared total above `maxTotalSize`.
 *   - So every name is in the one form Lumi writes it to disk (`path.join`), and later checks that match a
 *     name exactly (h5p.json, content/content.json, library.json) see the file Lumi will read.
 *   - Declared sizes are trustworthy for extraction because yauzl verifies them while unpacking.
 * Collaborators: yauzl, ../i18n/translate.ts (message keys), ../h5p/H5pConfigFactory.ts (limits); the
 *   package import (../h5p/HvlH5PEditor.ts) calls it first; ../h5p/libraries/packageManifest.ts reuses the reader.
 * Tests: apps/server/test/security/zipEntryGuard.test.ts
 */
import yauzl from 'yauzl';
import type { MessageKey } from '../i18n/translate.js';
import { MAX_FILE_SIZE, MAX_TOTAL_SIZE } from '../h5p/H5pConfigFactory.js';

/** Limits for one package. */
export interface ZipLimits {
  maxEntries: number;
  maxFileSize: number;
  maxTotalSize: number;
}

/** SEC-005 limits; 10 000 entries is far above the largest real package of the ten types. */
export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxEntries: 10_000,
  maxFileSize: MAX_FILE_SIZE,
  maxTotalSize: MAX_TOTAL_SIZE,
};

/** Why a package was rejected, with the message key to show the author. */
export class ZipRejectedError extends Error {
  /**
   * @param messageKey - Locale key under `upload.archive`.
   * @param params - Placeholder values for the message.
   */
  constructor(
    readonly messageKey: MessageKey,
    readonly params: Record<string, string | number> = {},
  ) {
    super(`${messageKey} ${JSON.stringify(params)}`);
    this.name = 'ZipRejectedError';
  }
}

const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;
const MB = 1024 * 1024;

/** Checks one entry name; returns true when it is safe. */
const isSafeName = (name: string): boolean => {
  const normalised = name.replace(/\\/g, '/');
  if (normalised.startsWith('/') || /^[A-Za-z]:/.test(normalised)) return false;
  // SECURITY: `content/./content.json` or `content//content.json` would be written over `content/content.json`
  // when Lumi extracts the package, after our checks had read the harmless entry with the exact name.
  const segments = normalised.replace(/\/$/, '').split('/');
  return !segments.some((segment) => segment === '..' || segment === '.' || segment === '');
};

/**
 * Inspects a zip file on disk.
 * @param path - Path of the uploaded file (in a temporary folder).
 * @param limits - Limits; SEC-005 values by default.
 * @returns Entry count and declared total size, when the package is acceptable.
 * @throws ZipRejectedError describing the first problem found.
 */
export async function inspectZip(
  path: string,
  limits: ZipLimits = DEFAULT_ZIP_LIMITS,
): Promise<{ entries: number; totalSize: number }> {
  const zip = await openZip(path);
  let entries = 0;
  let totalSize = 0;
  const seen = new Set<string>();
  try {
    for await (const entry of readEntries(zip)) {
      entries += 1;
      if (entries > limits.maxEntries)
        throw new ZipRejectedError('upload.archive.tooManyEntries', { max: limits.maxEntries });
      if (!isSafeName(entry.fileName))
        throw new ZipRejectedError('upload.archive.unsafePath', { entry: entry.fileName });
      // SECURITY: a second entry with the same name replaces the first one on extraction.
      const key = entry.fileName.replace(/\\/g, '/');
      if (seen.has(key)) throw new ZipRejectedError('upload.archive.unsafePath', { entry: entry.fileName });
      seen.add(key);
      if (((entry.externalFileAttributes >>> 16) & S_IFMT) === S_IFLNK) {
        throw new ZipRejectedError('upload.archive.symlink', { entry: entry.fileName });
      }
      if (entry.uncompressedSize > limits.maxFileSize) {
        throw new ZipRejectedError('upload.archive.fileTooLarge', {
          entry: entry.fileName,
          maxMb: limits.maxFileSize / MB,
        });
      }
      totalSize += entry.uncompressedSize;
      if (totalSize > limits.maxTotalSize)
        throw new ZipRejectedError('upload.archive.totalTooLarge', { maxMb: limits.maxTotalSize / MB });
    }
  } finally {
    zip.close();
  }
  return { entries, totalSize };
}

/**
 * Opens a zip file for reading its central directory and entries (no data is read yet).
 * @param path - Path of the zip file.
 * @returns The open file; call `close()` when done.
 * @throws ZipRejectedError `upload.archive.unreadable` when it is not a readable zip.
 */
export function openZip(path: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    // WHY: strictFileNames false lets us see backslash names and reject them with our own message.
    yauzl.open(
      path,
      { lazyEntries: true, decodeStrings: true, strictFileNames: false, validateEntrySizes: true },
      (error, zip) => {
        if (error || !zip) reject(new ZipRejectedError('upload.archive.unreadable'));
        else resolve(zip);
      },
    );
  });
}

/**
 * Lists the entries of an open zip file one by one.
 * @param zip - From `openZip`.
 * @yields Each central-directory entry.
 * @throws ZipRejectedError for unsafe names yauzl itself refuses, or an unreadable directory.
 */
export async function* readEntries(zip: yauzl.ZipFile): AsyncGenerator<yauzl.Entry> {
  while (true) {
    const next = await new Promise<yauzl.Entry | null>((resolve, reject) => {
      const onEntry = (entry: yauzl.Entry) => (cleanup(), resolve(entry));
      const onEnd = () => (cleanup(), resolve(null));
      const onError = (error: Error) => (cleanup(), reject(mapYauzlError(error)));
      const cleanup = () => zip.off('entry', onEntry).off('end', onEnd).off('error', onError);
      zip.on('entry', onEntry).on('end', onEnd).on('error', onError);
      zip.readEntry();
    });
    if (next === null) return;
    yield next;
  }
}

// WHY: yauzl itself rejects some unsafe names ("invalid relative path", "absolute path"); report them as ours.
function mapYauzlError(error: Error): ZipRejectedError {
  const unsafe = /^(invalid relative path|absolute path|invalid characters in fileName): (.*)$/.exec(
    error.message,
  );
  return unsafe
    ? new ZipRejectedError('upload.archive.unsafePath', { entry: unsafe[2] ?? '' })
    : new ZipRejectedError('upload.archive.unreadable');
}
