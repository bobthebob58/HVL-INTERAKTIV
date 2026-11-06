/**
 * Unit tests for the predicate that tells whether a stored content file could have a name: exactly the names the S3
 * store writes, so a lookup by any other name is "not found" before the database (D-110, S6 step 7).
 *
 * Spec: H5P-004, SEC-004
 */
import { describe, it, expect } from 'vitest';
import { assertSafeObjectName } from '../../src/h5p/storage/s3Objects.js';
import { isStorableFileName } from '../../src/h5p/storage/storableFileName.js';

const STORABLE = ['images/photo-1a2b.png', 'videos/Blåbær (1).mp4', 'file.pdf', 'a/b/c.txt', '..x/y..'];
const REFUSED = [
  'images/a.png\0.svg',
  'images/a\u0001.png',
  'images/a\u007f.png',
  'images\\a.png',
  'images/../a.png',
  './a.png',
  'images//a.png',
  '/etc/passwd',
  '',
];

describe('[H5P-004] storable file names', () => {
  it('[H5P-004] accepts the names the S3 store writes', () => {
    for (const name of STORABLE) expect(isStorableFileName(name), name).toBe(true);
  });

  it('[SEC-004] refuses a NUL byte, control characters, backslashes, dot or empty segments and absolute paths', () => {
    for (const name of REFUSED) expect(isStorableFileName(name), JSON.stringify(name)).toBe(false);
  });

  it('[H5P-004] agrees with assertSafeObjectName on every name, without throwing', () => {
    for (const name of [...STORABLE, ...REFUSED]) {
      // Act: what the S3 store does when it writes the name
      const written = (() => {
        try {
          assertSafeObjectName(name);
          return true;
        } catch {
          return false;
        }
      })();
      // Assert
      expect(isStorableFileName(name), JSON.stringify(name)).toBe(written);
    }
  });
});
