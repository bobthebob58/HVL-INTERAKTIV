/**
 * RejectedUploadError — why an uploaded content file was refused, as a message key the author can read.
 *
 * Why: the upload checks (file-type sniffing, SVG sanitising) must tell authors in Nynorsk, Bokmål or English
 *      what is wrong with a file, and the HTTP layer must turn the refusal into a 4xx answer without leaking
 *      internal details. A typed message key (like ZipRejectedError) does both.
 * Spec: SEC-001, SEC-002
 * Invariants:
 *   - `messageKey` is always an `upload.file.*` key that exists in every locale (typed against nn.json).
 *   - `params` hold only the extension or a size limit, never a file name, path or file content.
 * Collaborators: ./FileTypeSniffer.ts, ./SvgSanitizer.ts, ../i18n/translate.ts,
 *   ../http/h5pErrorResponse.ts (maps `messageKey` to the response).
 * Tests: apps/server/test/security/FileTypeSniffer.test.ts, apps/server/test/security/SvgSanitizer.test.ts
 */
import type { MessageKey } from '../i18n/translate.js';

/** The message keys an upload refusal may carry. */
export type RejectedUploadKey = Extract<MessageKey, `upload.file.${string}`>;

/** A content file that must not be stored, with the message key to show the author. */
export class RejectedUploadError extends Error {
  /**
   * @param messageKey - Locale key under `upload.file`.
   * @param params - Placeholder values for the message (`extension`, `maxMb`).
   */
  constructor(
    readonly messageKey: RejectedUploadKey,
    readonly params: Record<string, string | number> = {},
  ) {
    super(`${messageKey} ${JSON.stringify(params)}`);
    this.name = 'RejectedUploadError';
  }
}
