/**
 * FileTypeSniffer — refuses content files whose bytes do not match their extension.
 *
 * Why: H5P decides how to treat and serve a file by its extension (MIME type, image-size, Content-Type), but
 *      the bytes come from the author's computer. HTML in a `.png`, a `.txt` a browser would sniff as HTML, or
 *      ICNS/HEIF/JXL bytes that crash `image-size` (D-030) must be stopped before H5P stores the file. SEC-002.
 * Spec: SEC-002
 * Invariants:
 *   - The extension is lower-cased (./fileExtension.ts); one outside CONTENT_WHITELIST is refused (`notAllowed`).
 *   - Binary extensions need a matching file-type detection (./sniff/binaryFormats.ts); raster images must also
 *     pass the polyglot checks (./sniff/imagePolyglots.ts). Text extensions follow ./sniff/textFormats.ts.
 *   - Fails closed: an extension with no rule, a detection error or any mismatch is refused (`typeMismatch`).
 *   - Never changes the file; returns NotSanitized when the file is acceptable.
 * Collaborators: registered first in `fileSanitizers` of H5PEditor (editor uploads and package imports), before
 *   ./SvgSanitizer.ts; Lumi turns any thrown error into `upload-validation-error`, so routes that want the
 *   message call `sanitize` themselves first (../http). Uses file-type 22.
 * Tests: apps/server/test/security/FileTypeSniffer.test.ts, apps/server/test/security/FileTypeSniffer.bypass.test.ts
 */
import { FileSanitizerResult, type IFileSanitizer } from '@lumieducation/h5p-server';
import { fileTypeFromFile, type FileTypeResult } from 'file-type';
import { CONTENT_WHITELIST } from '../h5p/H5pConfigFactory.js';
import { fileExtension } from './fileExtension.js';
import { RejectedUploadError } from './RejectedUploadError.js';
import { isBinaryExtension, matchesBinaryFormat, RASTER_IMAGE_EXTENSIONS } from './sniff/binaryFormats.js';
import { hasImagePolyglotTraits } from './sniff/imagePolyglots.js';
import { isTextExtension, matchesTextFormat } from './sniff/textFormats.js';

/** The extensions authors may upload (SEC-002), as a set. */
export const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set(
  CONTENT_WHITELIST.split(/\s+/).filter(Boolean),
);

/** Checks that a content file is what its extension says. */
export class FileTypeSniffer implements IFileSanitizer {
  readonly name = 'HVL file-type sniffer (SEC-002)';

  /**
   * Inspects the file at `file`.
   * @param file - Path of the uploaded file; its extension decides the expected type.
   * @returns NotSanitized when the file is acceptable (it is never modified).
   * @throws RejectedUploadError `upload.file.notAllowed` or `upload.file.typeMismatch`.
   */
  async sanitize(file: string): Promise<FileSanitizerResult> {
    const extension = fileExtension(file);
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new RejectedUploadError('upload.file.notAllowed', { extension });
    }
    const mismatch = new RejectedUploadError('upload.file.typeMismatch', { extension });
    let detected: FileTypeResult | undefined;
    try {
      detected = await fileTypeFromFile(file);
    } catch {
      throw mismatch;
    }
    if (!(await this.matches(file, extension, detected).catch(() => false))) throw mismatch;
    return FileSanitizerResult.NotSanitized;
  }

  private async matches(
    file: string,
    extension: string,
    detected: FileTypeResult | undefined,
  ): Promise<boolean> {
    if (isBinaryExtension(extension)) {
      if (!matchesBinaryFormat(extension, detected) || !detected) return false;
      return !RASTER_IMAGE_EXTENSIONS.has(extension) || !(await hasImagePolyglotTraits(file, detected.ext));
    }
    // SECURITY: an allowlisted extension without a rule here is refused, never waved through.
    return isTextExtension(extension) && matchesTextFormat(file, extension, detected);
  }
}
