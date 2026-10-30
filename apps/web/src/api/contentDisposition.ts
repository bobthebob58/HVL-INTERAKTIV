/**
 * contentDisposition — the file name a file answer suggests in its `Content-Disposition` header (RFC 6266).
 *
 * Why: the portfolio export (MAPPE-001) answers a Markdown or PDF file with `Content-Disposition: attachment`
 *      (D-099); the page saves it under the name the server chose, which may hold æ, ø and å (`filename*`, RFC 8187).
 * Spec: MAPPE-001, DOC-012
 * Invariants:
 *   - `filename*` (UTF-8, percent-encoded) wins over `filename`, as RFC 6266 §4.3 says; a value that cannot be
 *     decoded falls back to `filename`.
 *   - The result is a bare name: anything up to the last `/` or `\`, every control character and every direction
 *     mark or override are removed, and an empty name, `.` or `..` gives no name at all.
 * Collaborators: ./apiRequest.ts (`apiFileRequest`).
 * Tests: apps/web/test/api/apiFileRequest.test.ts
 */

const EXTENDED = /(?:^|;)\s*filename\*\s*=\s*([^;]*)/i;
const PLAIN = /(?:^|;)\s*filename\s*=\s*("(?:[^"\\]|\\.)*"|[^;]*)/i;
/** C0 and C1 control characters, and the marks and overrides that change the direction of text. */
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g;

const decodeExtended = (value: string): string | undefined => {
  // WHY: RFC 8187 writes charset'language'percent-encoded; the server sends UTF-8, so only UTF-8 is decoded.
  const match = /^utf-8'[^']*'(.*)$/i.exec(value.trim());
  if (!match?.[1]) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return undefined;
  }
};

const unquote = (value: string): string => {
  const text = value.trim();
  return text.startsWith('"') && text.endsWith('"') && text.length >= 2
    ? text.slice(1, -1).replace(/\\(.)/g, '$1')
    : text;
};

const bareName = (name: string): string | undefined => {
  // SECURITY: the name is only a suggestion to the browser's save dialog, but a folder part, a control character or
  // a direction override (`mappe` + U+202E + `fdp.exe` shows as `mappeexe.pdf`) could still mislead the person saving
  // it, so none is kept.
  const base = (name.split(/[/\\]/).pop() ?? '').replace(UNSAFE_CHARACTERS, '').trim();
  return base === '' || base === '.' || base === '..' ? undefined : base;
};

/**
 * The file name a `Content-Disposition` header suggests.
 * @param header - The header's value, or null when the answer has none.
 * @returns The bare file name, e.g. `pedagogisk-mappe.pdf`, or undefined.
 * @example
 * filenameFromDisposition(`attachment; filename="m.md"; filename*=UTF-8''m%C3%B8nster.md`); // 'mønster.md'
 */
export function filenameFromDisposition(header: string | null): string | undefined {
  if (!header) return undefined;
  const extended = EXTENDED.exec(header)?.[1];
  const decoded = extended === undefined ? undefined : decodeExtended(extended);
  if (decoded !== undefined) return bareName(decoded);
  const plain = PLAIN.exec(header)?.[1];
  return plain === undefined ? undefined : bareName(unquote(plain));
}
