/**
 * ContentFileHeaders — the HTTP headers every user-uploaded content or temporary file is served with.
 *
 * Why: files come from authors and may be crafted (CVE-2025-7062). The type must come from our own map, never
 *      from the stored object or the uploader, browsers must not guess another type, and a file that is
 *      opened directly must not run script on any origin. SEC-004 and D-045 set these rules.
 * Spec: SEC-004
 * Invariants:
 *   - Every file gets `X-Content-Type-Options: nosniff` and the sandbox CSP, whatever its type.
 *   - Only raster images, audio, video and captions are `inline`; everything else (SVG, documents, JSON, text,
 *     unknown) is an `attachment`, with an RFC 6266 `filename*` parameter.
 *   - Text types carry `charset=utf-8`; an unknown extension is `application/octet-stream`.
 *   - Header values never contain CR, LF or quotes from the file name.
 * SPEC-DEVIATION: D-045 — SEC-004's separate files origin is not in place yet (S3 signed URLs, S6 deployment);
 *   until then the sandbox CSP and `attachment` are what keep a crafted file away from the app's origin.
 * Collaborators: ./fileExtension.ts; ../http/sendUserFile.ts and ../http/multipartUpload.ts call it.
 * Tests: apps/server/test/security/ContentFileHeaders.test.ts
 */
import { fileExtension } from './fileExtension.js';

const UTF8 = '; charset=utf-8';

/** MIME type for every extension in CONTENT_WHITELIST (SEC-002). */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  // WHY: SVG is XML text; a transport charset overrides any encoding declaration a file could still carry.
  svg: `image/svg+xml${UTF8}`,
  webm: 'video/webm',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  vtt: `text/vtt${UTF8}`,
  webvtt: `text/vtt${UTF8}`,
  pdf: 'application/pdf',
  txt: `text/plain${UTF8}`,
  csv: `text/csv${UTF8}`,
  json: `application/json${UTF8}`,
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
};

/** Extensions shown in the page: raster images, audio, video and captions (D-045). */
const INLINE_EXTENSIONS: ReadonlySet<string> = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'mp3',
  'm4a',
  'ogg',
  'wav',
  'mp4',
  'webm',
  'vtt',
  'webvtt',
]);

/** The sandbox CSP for user files: no script, no plugins, no requests; inline styles only (SEC-004). */
export const USER_FILE_CSP = "sandbox; default-src 'none'; style-src 'unsafe-inline'";

/**
 * The Content-Type for a content file, decided by its extension only.
 * @param filename - The file's name or path inside the content.
 * @returns A MIME type, with `; charset=utf-8` for text types; `application/octet-stream` when unknown.
 */
export function contentTypeFor(filename: string): string {
  return CONTENT_TYPES[fileExtension(filename)] ?? 'application/octet-stream';
}

// WHY: RFC 5987 attr-char allows only these unescaped; encodeURIComponent also leaves ' ( ) * as they are.
const encodeRfc5987 = (value: string): string =>
  encodeURIComponent(value.toWellFormed()).replace(
    /['()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/**
 * The Content-Disposition value for a content file.
 * @param filename - The file's name or path inside the content.
 * @returns `inline` for media and captions, otherwise `attachment` with an ASCII and a UTF-8 file name.
 */
export function contentDispositionFor(filename: string): string {
  if (INLINE_EXTENSIONS.has(fileExtension(filename))) return 'inline';
  const name = filename.replace(/\\/g, '/').split('/').pop() || 'file';
  // SECURITY: the fallback name keeps only safe ASCII, so no quote, CR or LF can break out of the header.
  const ascii = name.replace(/[^A-Za-z0-9._ -]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeRfc5987(name)}`;
}

/**
 * Every security header for a content or temporary file (SEC-004, D-045).
 * @param filename - The file's name or path inside the content.
 * @returns Header names and values: Content-Type, X-Content-Type-Options, Content-Security-Policy and
 *   Content-Disposition.
 */
export function contentFileHeaders(filename: string): Record<string, string> {
  return {
    'Content-Type': contentTypeFor(filename),
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': USER_FILE_CSP,
    'Content-Disposition': contentDispositionFor(filename),
  };
}
