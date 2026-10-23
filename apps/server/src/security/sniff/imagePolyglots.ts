/**
 * imagePolyglots — refuses raster images that also carry HTML or script, or bytes after the image ends.
 *
 * Why: a file can be a valid PNG/GIF/JPEG/WebP and at the same time an HTML page (a polyglot). Served with
 *      our headers it stays an image, but a legacy sniffer, a misconfigured proxy or a download that is
 *      opened locally could treat it as HTML. These checks stop the common polyglot forms at upload (SEC-002).
 * Spec: SEC-002
 * Invariants:
 *   - PNG must end exactly at its IEND chunk, and IHDR must come first; WebP's RIFF size must equal the file size.
 *   - The first 4 KB (where legacy sniffers look) may hold no HTML/SVG start tag of 4 or more bytes.
 *   - Anywhere in the file: no `<script`, `<iframe`, `<object`, `<embed`, `<applet`, `<html>`, `<body>` or
 *     `javascript:`. Shorter tags are not searched there, because random compressed bytes contain them.
 *   - Reads at most 1 MB at a time, so a 50 MB upload does not need 50 MB of memory.
 * Collaborators: ../FileTypeSniffer.ts, ./binaryFormats.ts (RASTER_IMAGE_EXTENSIONS).
 * Tests: apps/server/test/security/FileTypeSniffer.test.ts, apps/server/test/security/FileTypeSniffer.bypass.test.ts
 */
import { createReadStream } from 'node:fs';
import { open } from 'node:fs/promises';

const BLOCK = 1024 * 1024;
const HEAD_WINDOW = 4096;
const OVERLAP = 32;

// WHY: the WHATWG "identify unknown MIME type" HTML table plus SVG and embedding tags; legacy browsers
// searched the first bytes for any of them, not only at offset 0. Two-letter tags (<a, <b, <p) are left out
// because binary data contains them by chance.
const HEAD_MARKUP =
  /<(?:!doctype|html|head|body|script|iframe|frame|frameset|object|embed|applet|svg|math|img|image|meta|link|base|form|style|title|table|font|div|h1)[\s/>]/i;
const ANYWHERE_MARKUP = /<(?:script|iframe|object|embed|applet)|<(?:html|body)[\s/>]|javascript:/i;

/** Scans the whole file in blocks for markup; the first block is also checked against the head list. */
async function containsMarkup(path: string): Promise<boolean> {
  let carry = '';
  let first = true;
  for await (const chunk of createReadStream(path, { highWaterMark: BLOCK })) {
    const text = carry + (chunk as Buffer).toString('latin1');
    if (first && HEAD_MARKUP.test(text.slice(0, HEAD_WINDOW))) return true;
    if (ANYWHERE_MARKUP.test(text)) return true;
    carry = text.slice(-OVERLAP);
    first = false;
  }
  return false;
}

/** Walks the PNG chunk headers; true when IHDR is first and the file ends right after IEND. */
async function pngEndsAtIend(path: string): Promise<boolean> {
  const handle = await open(path, 'r');
  try {
    const { size } = await handle.stat();
    const buffer = Buffer.allocUnsafe(BLOCK);
    let blockStart = 0;
    let blockLength = 0;
    let offset = 8;
    let first = true;
    while (offset + 12 <= size) {
      if (offset < blockStart || offset + 8 > blockStart + blockLength) {
        blockLength = (await handle.read(buffer, 0, BLOCK, offset)).bytesRead;
        blockStart = offset;
        if (blockLength < 8) return false;
      }
      const at = offset - blockStart;
      const length = buffer.readUInt32BE(at);
      const type = buffer.toString('latin1', at + 4, at + 8);
      if (length > 0x7fffffff || (first && type !== 'IHDR')) return false;
      first = false;
      offset += 12 + length;
      if (type === 'IEND') return offset === size;
    }
    return false;
  } finally {
    await handle.close();
  }
}

/** True when the RIFF size field of a WebP file covers exactly the whole file. */
async function riffCoversFile(path: string): Promise<boolean> {
  const handle = await open(path, 'r');
  try {
    const { size } = await handle.stat();
    const header = Buffer.alloc(8);
    const { bytesRead } = await handle.read(header, 0, 8, 0);
    return bytesRead === 8 && header.readUInt32LE(4) + 8 === size;
  } finally {
    await handle.close();
  }
}

/**
 * Looks for polyglot traits in a file already detected as a raster image.
 * @param path - Path of the uploaded file.
 * @param detectedExt - file-type's `ext` for the file (png, apng, jpg, gif or webp).
 * @returns True when the image carries markup or trailing bytes and must be refused.
 */
export async function hasImagePolyglotTraits(path: string, detectedExt: string): Promise<boolean> {
  if ((detectedExt === 'png' || detectedExt === 'apng') && !(await pngEndsAtIend(path))) return true;
  if (detectedExt === 'webp' && !(await riffCoversFile(path))) return true;
  return containsMarkup(path);
}
