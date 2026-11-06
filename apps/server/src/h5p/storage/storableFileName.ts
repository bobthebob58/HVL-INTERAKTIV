/**
 * storableFileName — tells, without throwing, whether a stored content file could have a given name.
 *
 * Why: the S3 store refuses unsafe names when it writes a file (`assertSafeObjectName` in ./s3Objects.ts), so a
 *      lookup by such a name can only miss. Asking the database anyway fails for a NUL byte, which PostgreSQL refuses
 *      in text: H5P's cookie route `/h5p/content/:id/*file` answered 500 with an error-level log line at a signed-in
 *      person's will (D-110's amendment of 2026-11-05, S6 step 7).
 * Spec: H5P-004, SEC-004
 * Invariants:
 *   - Exactly the names `assertSafeObjectName` accepts are storable; this module adds no rule of its own.
 * Collaborators: ./s3Objects.ts, ./PrismaContentStorage.ts (`fileExists`, `requireFile`).
 * Tests: apps/server/test/h5p/storableFileName.test.ts, apps/server/test/h5p/contentStorage.int.test.ts,
 *   apps/server/test/http/contentFiles.int.test.ts
 */
import { assertSafeObjectName, UnsafeObjectNameError } from './s3Objects.js';

/**
 * Whether a stored content file could have this name.
 * @param name - File name as H5P gives it, e.g. `images/photo-1a2b.png`.
 * @returns False for every name the S3 store refuses to write (a control character, a backslash, an empty, `.` or
 *   `..` segment, a leading `/`); true otherwise.
 */
export function isStorableFileName(name: string): boolean {
  try {
    assertSafeObjectName(name);
    return true;
  } catch (error) {
    if (error instanceof UnsafeObjectNameError) return false;
    throw error;
  }
}
