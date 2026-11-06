/**
 * librarySecretFindings — what the server reports when a library file holds a build machine's secrets, and the error
 * that refuses it.
 *
 * Why: the seed command, an administrator's package import and the check of an installed library folder all refuse
 *      the same way (D-110 amendment of 2026-11-06): one finding per file, with the library folder, the file and the
 *      variable names, so the person who must rebuild or delete it knows where to look.
 * Spec: H5P-003, H5P-011
 * Invariants:
 *   - SECURITY: a finding, the error's message and its parameters carry names only, never a value.
 *   - A text file over `MAX_SCANNED_FILE_BYTES` is a finding (`too large to scan`), never skipped.
 *   - The error carries `messageKey` `upload.package.librarySecrets` and status 400, so the HTTP layer answers in nn,
 *     nb or en with the library folders (../../http/h5pErrorResponse.ts, unchanged).
 * Collaborators: ./libraryBuildSecrets.ts (the rules), ./packageSecretScan.ts, ./installedLibraryScan.ts.
 * Tests: apps/server/test/h5p/libraries/librarySecretScans.test.ts
 */
import type { MessageKey } from '../../i18n/translate.js';
import { buildSecretsIn, MAX_SCANNED_FILE_BYTES, SCANNED_TEXT_FILE } from './libraryBuildSecrets.js';

/** One library file that holds a build machine's secrets. */
export interface LibrarySecretFinding {
  /** The package file it came from, when there is one (the seed command names it). */
  readonly packageName?: string;
  /** The library folder, e.g. `H5P.AudioRecorder-1.0`. */
  readonly library: string;
  /** The file's path inside the library folder. */
  readonly file: string;
  /** The variable names, or the kinds of credential-shaped values; `too large to scan` for an oversized file. */
  readonly names: readonly string[];
}

/** The note for a text file that is refused because it is too large to scan. */
export const TOO_LARGE_TO_SCAN = 'too large to scan (over 32 MB)';

/**
 * Scans one library file, if it is a text file.
 * @param where - The library folder and the file's path inside it.
 * @param size - The file's size in bytes.
 * @param read - Reads the file as UTF-8 text; called only for a text file within the size limit.
 * @returns The finding, or undefined when the file is clean or not a text file.
 */
export async function scanLibraryFile(
  where: { library: string; file: string },
  size: number,
  read: () => Promise<string>,
): Promise<LibrarySecretFinding | undefined> {
  if (!SCANNED_TEXT_FILE.test(where.file)) return undefined;
  if (size > MAX_SCANNED_FILE_BYTES) return { ...where, names: [TOO_LARGE_TO_SCAN] };
  const names = buildSecretsIn(await read());
  return names.length > 0 ? { ...where, names } : undefined;
}

const line = (finding: LibrarySecretFinding): string =>
  `  ✗ ${finding.packageName ? `${finding.packageName}: ` : ''}${finding.library}/${finding.file} holds ` +
  finding.names.join(', ');

/** Thrown when library files hold a build machine's secrets; nothing from them has been installed. */
export class LibrarySecretsFoundError extends Error {
  /** The locale key of the author-facing message (400). */
  readonly messageKey: MessageKey = 'upload.package.librarySecrets';
  /** HTTP status for the error mapping. */
  readonly status = 400;
  /** The library folders, for the `{{libraries}}` placeholder. */
  readonly params: { libraries: string };

  /**
   * @param findings - Every finding, at least one.
   * @param advice - What to do, for the message (English, for logs and the command line).
   */
  constructor(
    readonly findings: readonly LibrarySecretFinding[],
    advice: string,
  ) {
    super(`library files hold a build machine's secrets (${advice}):\n${findings.map(line).join('\n')}`);
    this.name = 'LibrarySecretsFoundError';
    this.params = { libraries: [...new Set(findings.map((f) => f.library))].sort().join(', ') };
  }
}
