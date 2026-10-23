/**
 * textFormats — content checks for the text extensions (json, vtt, webvtt, txt, csv, svg).
 *
 * Why: text files have no magic bytes, so SEC-002 checks their structure instead. A text file must never be
 *      something a browser would sniff as HTML or XML (WHATWG MIME Sniffing, "identify unknown MIME type"),
 *      and must not be a binary file in disguise. An SVG must really be an SVG document.
 * Spec: SEC-002
 * Invariants:
 *   - UTF-16 and UTF-32 byte-order marks are refused (we serve text as UTF-8, and a BOM overrides the charset).
 *   - No NUL byte in the first 8 KB; file-type may only report the listed textual types.
 *   - Except for SVG, the first byte after an optional UTF-8 BOM and any whitespace or control bytes is not "<",
 *     and lies within the first 64 KB. This is stricter than the WHATWG table and also covers `<?xml`, `<svg`
 *     and comments.
 *   - json: valid UTF-8 that JSON.parse accepts. vtt/webvtt: optional BOM, then "WEBVTT" and a separator.
 *   - svg: after an optional prolog (XML declaration, processing instructions, comments, DOCTYPE) the root
 *     start tag is exactly `<svg`.
 * Collaborators: ../FileTypeSniffer.ts; ../SvgSanitizer.ts cleans SVG content afterwards.
 * Tests: apps/server/test/security/FileTypeSniffer.test.ts, apps/server/test/security/FileTypeSniffer.bypass.test.ts
 */
import { open, readFile } from 'node:fs/promises';
import type { FileTypeResult } from 'file-type';

const HEAD = 64 * 1024;
const NUL_WINDOW = 8 * 1024;

/** For each text extension, the file-type detections that are still plain text. */
const TEXTUAL_DETECTIONS: Readonly<Record<string, readonly string[]>> = {
  json: [],
  vtt: ['vtt'],
  webvtt: ['vtt'],
  txt: ['vtt', 'vcf', 'ics'],
  csv: ['vtt', 'vcf', 'ics'],
  svg: ['xml'],
};

/**
 * Tells whether an extension is checked as text.
 * @param extension - Lower-cased extension without the dot.
 * @returns True for json, vtt, webvtt, txt, csv and svg.
 */
export const isTextExtension = (extension: string): boolean => Object.hasOwn(TEXTUAL_DETECTIONS, extension);

const startsWithBytes = (head: Buffer, bytes: number[]): boolean => bytes.every((b, i) => head[i] === b);

/** True for a UTF-16 or UTF-32 byte-order mark. */
const hasWideBom = (head: Buffer): boolean =>
  startsWithBytes(head, [0xfe, 0xff]) ||
  startsWithBytes(head, [0xff, 0xfe]) ||
  startsWithBytes(head, [0x00, 0x00, 0xfe, 0xff]);

/** Index of the first byte after any UTF-8 BOMs and bytes up to 0x20 (space and control characters). */
function contentStart(head: Buffer): number {
  let i = 0;
  while (i < head.length) {
    if (head[i] === 0xef && head[i + 1] === 0xbb && head[i + 2] === 0xbf) i += 3;
    else if ((head[i] ?? 0xff) <= 0x20) i += 1;
    else break;
  }
  return i;
}

/** Index of the ">" that closes a DOCTYPE starting at `start`, skipping quoted text and an internal subset. */
function doctypeEnd(text: string, start: number): number {
  let quote = '';
  let depth = 0;
  for (let i = start + 9; i < text.length; i += 1) {
    const c = text[i];
    if (quote) quote = c === quote ? '' : quote;
    else if (c === '"' || c === "'") quote = c;
    else if (c === '[') depth += 1;
    else if (c === ']') depth -= 1;
    else if (c === '>' && depth <= 0) return i;
  }
  return -1;
}

/** True when the document element of the SVG text is `<svg`, after an optional prolog. */
function hasSvgRoot(head: Buffer): boolean {
  const text = head.toString('latin1');
  const skip = (from: number) => from + contentStart(head.subarray(from));
  const after = (at: number, length: number) => (at < 0 ? -1 : at + length);
  let i = skip(0);
  for (;;) {
    let end: number;
    if (text.startsWith('<?', i)) end = after(text.indexOf('?>', i + 2), 2);
    else if (text.startsWith('<!--', i)) end = after(text.indexOf('-->', i + 4), 3);
    else if (text.slice(i, i + 9).toUpperCase() === '<!DOCTYPE') end = after(doctypeEnd(text, i), 1);
    else break;
    if (end < 0) return false;
    i = skip(end);
  }
  return /^<svg[\s/>]/.test(text.slice(i, i + 5));
}

/** True when a JSON file is valid UTF-8 and parses. */
async function isJson(path: string): Promise<boolean> {
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(await readFile(path));
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** True when a caption file starts with an optional BOM, then "WEBVTT" and a space, tab, line break or the end. */
function isWebVtt(head: Buffer): boolean {
  const from = startsWithBytes(head, [0xef, 0xbb, 0xbf]) ? 3 : 0;
  return /^WEBVTT(?:[ \t\r\n]|$)/.test(head.toString('latin1', from, from + 7));
}

/** Reads the first `HEAD` bytes of a file. */
async function readHead(path: string): Promise<Buffer> {
  const handle = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(HEAD);
    const { bytesRead } = await handle.read(buffer, 0, HEAD, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/**
 * Checks a file whose extension is a text format.
 * @param path - Path of the uploaded file.
 * @param extension - Lower-cased extension without the dot (json, vtt, webvtt, txt, csv or svg).
 * @param detected - file-type's result for the file; undefined when it recognised nothing.
 * @returns True when the content fits the extension and cannot be sniffed as HTML.
 */
export async function matchesTextFormat(
  path: string,
  extension: string,
  detected: FileTypeResult | undefined,
): Promise<boolean> {
  const textual = TEXTUAL_DETECTIONS[extension];
  if (!textual || (detected && !textual.includes(detected.ext))) return false;
  const head = await readHead(path);
  if (hasWideBom(head) || head.subarray(0, NUL_WINDOW).includes(0)) return false;
  if (extension === 'svg') return hasSvgRoot(head);
  // SECURITY: no text file may begin with markup; browsers sniff "<" starts as HTML or XML (WHATWG table).
  // A head that is only whitespace hides the first real byte, so a full head of it is refused as well.
  const start = contentStart(head);
  if (head[start] === 0x3c || (start === head.length && head.length === HEAD)) return false;
  if (extension === 'json') return isJson(path);
  if (extension === 'vtt' || extension === 'webvtt') return isWebVtt(head);
  return true;
}
