/**
 * fileExtension — the lower-cased extension of a file path, the one rule every upload check agrees on.
 *
 * Why: the sniffer, the SVG sanitiser and the response headers must all read the same extension from a path.
 *      Node's `extname` returns '' for a dot-file such as ".svg", which would let such a file skip the SVG
 *      sanitiser while a browser or storage layer still treats it as SVG.
 * Spec: SEC-001, SEC-002, SEC-004
 * Invariants:
 *   - Only the last path segment counts; the extension is the text after its last dot, lower-cased.
 *   - ".svg" gives "svg"; "file" and "file." give "" (no extension, which no allowlist contains).
 * Collaborators: ./FileTypeSniffer.ts, ./SvgSanitizer.ts, ./ContentFileHeaders.ts.
 * Tests: apps/server/test/security/FileTypeSniffer.test.ts, apps/server/test/security/SvgSanitizer.test.ts
 */
import { basename } from 'node:path';

/**
 * Reads the extension of a path.
 * @param path - A file path or file name (either slash style).
 * @returns The lower-cased extension without the dot, or '' when there is none.
 */
export function fileExtension(path: string): string {
  const name = basename(path.replace(/\\/g, '/'));
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}
