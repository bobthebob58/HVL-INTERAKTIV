/**
 * Adversarial uploads beyond the main sniffer tests: polyglot images, encoding and whitespace tricks in text
 * files, dot-files and double extensions, and SVG root tricks. Each must be refused.
 *
 * Spec: SEC-002
 */
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileSanitizerResult } from '@lumieducation/h5p-server';
import { FileTypeSniffer } from '../../src/security/FileTypeSniffer.js';
import { RejectedUploadError } from '../../src/security/RejectedUploadError.js';
import * as bytes from '../support/sniffFixtures.js';

const dir = mkdtempSync(join(tmpdir(), 'sniff-bypass-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let counter = 0;
const sniffer = new FileTypeSniffer();
const place = (name: string, data: Buffer | string): string => {
  const folder = join(dir, String((counter += 1)));
  mkdirSync(folder);
  writeFileSync(join(folder, name), data);
  return join(folder, name);
};

const HTML = '<html><body><script>alert(document.domain)</script></body></html>';
const utf8 = (text: string) => Buffer.from(text, 'utf8');
const bom = Buffer.from([0xef, 0xbb, 0xbf]);
const padding = (size: number) => Buffer.alloc(size, 0x41);

/** [what it tries, file name, bytes]. */
const ATTEMPTS: [string, string, Buffer | string][] = [
  ['HTML in a PNG tEXt chunk', 'a.png', bytes.png([bytes.pngChunk('tEXt', utf8(`Comment\0${HTML}`))])],
  [
    'PNG with a chunk length past the end',
    'a.png',
    Buffer.concat([bytes.png().subarray(0, 33), bytes.pngChunk('IDAT', padding(4)).subarray(0, 6)]),
  ],
  ['PNG with plain bytes after IEND', 'a.png', Buffer.concat([bytes.png(), padding(16)])],
  ['WebP with plain bytes after the RIFF chunk', 'a.webp', Buffer.concat([bytes.webp(), padding(16)])],
  [
    'PNG without IHDR first',
    'a.png',
    Buffer.concat([bytes.png().subarray(0, 8), bytes.pngChunk('tEXt', utf8('x')), bytes.png().subarray(8)]),
  ],
  ['GIF/JS polyglot in the header', 'a.gif', 'GIF89a/*<svg/onload=alert(1)>*/=1;'],
  [
    'GIF with a script far into the file',
    'a.gif',
    Buffer.concat([bytes.gif(), padding(9000), utf8('<SCRIPT>alert(1)</SCRIPT>')]),
  ],
  ['JPEG with javascript: in metadata', 'a.jpg', bytes.jpeg([bytes.jpegComment('href=JavaScript:alert(1)')])],
  ['JPEG with HTML after EOI', 'a.jpeg', Buffer.concat([bytes.jpeg(), utf8(HTML)])],
  [
    'WebP with an iframe in the first 4 KB',
    'a.webp',
    Buffer.concat([bytes.webp().subarray(0, 30), utf8('<iframe src=//x>')]),
  ],
  [
    'UTF-16LE HTML with BOM in .txt',
    'a.txt',
    Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(HTML, 'utf16le')]),
  ],
  ['UTF-16BE HTML without BOM in .txt', 'a.txt', Buffer.from(HTML, 'utf16le').swap16()],
  ['UTF-32 BOM in .csv', 'a.csv', Buffer.concat([Buffer.from([0x00, 0x00, 0xfe, 0xff]), utf8('a;b')])],
  ['several BOMs, then HTML', 'a.txt', Buffer.concat([bom, bom, bom, utf8(HTML)])],
  [
    'control characters before HTML',
    'a.txt',
    Buffer.concat([Buffer.from([0x0b, 0x0c, 0x1b, 0x0d, 0x0a]), utf8(HTML)]),
  ],
  ['64 KB of spaces, then HTML', 'a.txt', Buffer.concat([Buffer.alloc(64 * 1024, 0x20), utf8(HTML)])],
  [
    'XHTML with an XML declaration in .csv',
    'a.csv',
    '<?xml version="1.0"?><x:script xmlns:x="http://www.w3.org/1999/xhtml">alert(1)</x:script>',
  ],
  ['PDF as .csv', 'a.csv', bytes.pdf()],
  ['zip archive as .csv', 'a.csv', await bytes.zip([{ name: 'a.html', data: HTML }])],
  ['executable as .txt', 'a.txt', Buffer.concat([utf8('MZ'), Buffer.alloc(64)])],
  ['JSON that is HTML after a BOM', 'a.json', Buffer.concat([bom, utf8(' <script>alert(1)</script>')])],
  ['JSON in UTF-16', 'a.json', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('{"a":1}', 'utf16le')])],
  ['captions that are HTML', 'a.webvtt', `\n\n${HTML}`],
  ['a dot-file named .png holding HTML', '.png', HTML],
  ['a double extension x.html.png', 'x.html.png', HTML],
  ['upper-case .TXT holding HTML', 'NOTAT.TXT', HTML],
  [
    'SVG whose root is HTML behind a comment',
    'a.svg',
    '<!-- <svg> --><html><script>alert(1)</script></html>',
  ],
  ['SVG whose root is upper-case <SVG>', 'a.svg', '<SVG xmlns="http://www.w3.org/2000/svg"></SVG>'],
  ['SVG with an unterminated comment', 'a.svg', '<!-- <svg xmlns="http://www.w3.org/2000/svg"/>'],
  ['SVG with a prefixed root', 'a.svg', '<svg:svg xmlns:svg="http://www.w3.org/2000/svg"/>'],
  [
    'SVG in UTF-16',
    'a.svg',
    Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>', 'utf16le'),
    ]),
  ],
  [
    'SVG behind 64 KB of comment',
    'a.svg',
    `<!--${'x'.repeat(65 * 1024)}--><svg xmlns="http://www.w3.org/2000/svg"/>`,
  ],
  ['GIF disguised as SVG', 'a.svg', bytes.gif()],
  ['a trailing space after the extension', 'a.png ', bytes.png()],
  ['a trailing dot after the extension', 'a.png.', bytes.png()],
];

describe('[SEC-002] FileTypeSniffer bypass attempts', () => {
  it.each(ATTEMPTS)('[SEC-002] refuses: %s', async (_what, name, data) => {
    const error = await sniffer.sanitize(place(name, data)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RejectedUploadError);
    expect(['upload.file.typeMismatch', 'upload.file.notAllowed']).toContain(
      (error as RejectedUploadError).messageKey,
    );
  });

  it('[SEC-002] large genuine images are still accepted (no false positive from the markup scan)', async () => {
    const noise = Buffer.alloc(3 * 1024 * 1024);
    for (let i = 0; i < noise.length; i += 1) noise[i] = (i * 2654435761) >>> 24;
    const big = bytes.png([bytes.pngChunk('IDAT', noise)]);
    expect(await sniffer.sanitize(place('big.png', big))).toBe(FileSanitizerResult.NotSanitized);
    const exif = bytes.jpeg([
      bytes.jpegComment('<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta>'),
    ]);
    expect(await sniffer.sanitize(place('photo.jpg', exif))).toBe(FileSanitizerResult.NotSanitized);
  });
});
