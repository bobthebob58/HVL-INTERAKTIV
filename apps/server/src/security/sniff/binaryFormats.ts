/**
 * binaryFormats — the magic-byte detections each binary content extension accepts.
 *
 * Why: an author's file must be what its extension says (SEC-002). The extension decides how the file is served
 *      (./../ContentFileHeaders.ts) and whether H5P runs `image-size` on it (D-030), so a file whose bytes say
 *      ICNS, HEIF, JXL, TIFF, BMP or HTML must never pass as a `.png`.
 * Spec: SEC-002
 * Invariants:
 *   - A binary extension passes only when file-type 22 detects one of the listed types; no detection fails.
 *   - Image extensions accept only PNG/APNG, JPEG, GIF and WebP, so `image-size` never parses its vulnerable
 *     formats (D-030).
 *   - The map is the single list of binary extensions; text extensions live in ./textFormats.ts.
 * Collaborators: ../FileTypeSniffer.ts (calls it with file-type's result), ./imagePolyglots.ts.
 * Tests: apps/server/test/security/FileTypeSniffer.test.ts
 */
import type { FileTypeResult } from 'file-type';

/** For each binary extension, the file-type `ext` values that may stand behind it. */
export const BINARY_FORMATS: Readonly<Record<string, readonly string[]>> = {
  png: ['png', 'apng'],
  jpg: ['jpg'],
  jpeg: ['jpg'],
  gif: ['gif'],
  webp: ['webp'],
  // WHY: MP4-family files differ only in the ftyp brand; M4V and plain-ISO-brand audio are the same container.
  mp4: ['mp4', 'm4v'],
  m4a: ['m4a', 'mp4'],
  mp3: ['mp3'],
  ogg: ['ogg', 'oga', 'opus'],
  wav: ['wav'],
  webm: ['webm'],
  pdf: ['pdf'],
  docx: ['docx'],
  xlsx: ['xlsx'],
  pptx: ['pptx'],
  odt: ['odt'],
  ods: ['ods'],
  odp: ['odp'],
};

/** Extensions shown as images in the page; they get the extra polyglot checks of ./imagePolyglots.ts. */
export const RASTER_IMAGE_EXTENSIONS: ReadonlySet<string> = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);

/**
 * Tells whether an extension is checked by magic bytes.
 * @param extension - Lower-cased extension without the dot.
 * @returns True for the extensions in `BINARY_FORMATS`.
 */
export const isBinaryExtension = (extension: string): boolean => Object.hasOwn(BINARY_FORMATS, extension);

/**
 * Tells whether file-type's detection fits the extension.
 * @param extension - Lower-cased extension without the dot (a key of `BINARY_FORMATS`).
 * @param detected - file-type's result for the file; undefined when it recognised nothing.
 * @returns True only when the detected type is listed for the extension.
 */
export function matchesBinaryFormat(extension: string, detected: FileTypeResult | undefined): boolean {
  if (!detected || !isBinaryExtension(extension)) return false;
  return (BINARY_FORMATS[extension] ?? []).includes(detected.ext);
}
