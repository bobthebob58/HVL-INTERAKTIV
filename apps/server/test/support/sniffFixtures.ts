/**
 * sniffFixtures — byte builders for the file-type sniffer tests: one genuine sample per allowlisted extension,
 * plus the formats SEC-002 and D-030 must refuse.
 *
 * Why: committing binary fixtures hides what they contain; small builders show every magic number in code.
 * Spec: SEC-002
 * Tests: used by apps/server/test/security/FileTypeSniffer.test.ts and FileTypeSniffer.bypass.test.ts.
 */
import { crc32, deflateSync } from 'node:zlib';
import yazl from 'yazl';

const ascii = (text: string): Buffer => Buffer.from(text, 'latin1');
const u32be = (n: number): Buffer => Buffer.from([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const u32le = (n: number): Buffer => Buffer.from([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, n >>> 24]);

/** A PNG chunk with a correct CRC. */
export const pngChunk = (type: string, data: Buffer): Buffer =>
  Buffer.concat([u32be(data.length), ascii(type), data, u32be(crc32(Buffer.concat([ascii(type), data])))]);

/** A valid 1×1 RGB PNG; `extra` chunks go between IHDR and IDAT. */
export function png(extra: Buffer[] = []): Buffer {
  const ihdr = Buffer.concat([u32be(1), u32be(1), Buffer.from([8, 2, 0, 0, 0])]);
  const idat = deflateSync(Buffer.from([0, 0x00, 0x43, 0x57]));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    ...extra,
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** An animated PNG (acTL before IDAT). */
export const apng = (): Buffer => png([pngChunk('acTL', Buffer.concat([u32be(1), u32be(0)]))]);
/** A JFIF JPEG header and end marker; `segments` go between APP0 and EOI. */
export const jpeg = (segments: Buffer[] = []): Buffer =>
  Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]),
    ascii('JFIF\0'),
    Buffer.from([1, 1, 0, 0, 1, 0, 1, 0, 0]),
    ...segments,
    Buffer.from([0xff, 0xd9]),
  ]);
/** A JPEG comment (COM) segment. */
export const jpegComment = (text: string): Buffer =>
  Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from([0, text.length + 2]), ascii(text)]);
/** The classic 1×1 transparent GIF. */
export const gif = (): Buffer =>
  Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
/** A 1×1 lossless WebP. */
export const webp = (): Buffer => Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
/** An ISO base media file header with the given major brand (mp4, m4a, m4v, heic, avif …). */
export const ftyp = (brand: string): Buffer =>
  Buffer.concat([u32be(24), ascii('ftyp'), ascii(brand.padEnd(4)), u32be(0), ascii('isommp42')]);
/** An MPEG-1 Layer III frame, optionally after an empty ID3v2 tag. */
export const mp3 = (id3 = false): Buffer =>
  Buffer.concat([
    id3 ? Buffer.concat([ascii('ID3'), Buffer.from([3, 0, 0, 0, 0, 0, 0])]) : Buffer.alloc(0),
    Buffer.from([0xff, 0xfb, 0x90, 0x64]),
    Buffer.alloc(413),
    Buffer.from([0xff, 0xfb, 0x90, 0x64]),
    Buffer.alloc(413),
  ]);
/** An Ogg page whose first packet names the codec. */
export const ogg = (codec: 'vorbis' | 'opus' | 'flac'): Buffer => {
  const packet = { vorbis: '\x01vorbis\0', opus: 'OpusHead', flac: '\x7fFLAC\x01\0\0' }[codec];
  return Buffer.concat([ascii('OggS'), Buffer.alloc(24), ascii(packet), Buffer.alloc(32)]);
};
/** A PCM WAVE header with an empty data chunk. */
export const wav = (): Buffer =>
  Buffer.concat([
    ascii('RIFF'),
    u32le(36),
    ascii('WAVEfmt '),
    u32le(16),
    Buffer.from([1, 0, 1, 0, 0x40, 0x1f, 0, 0, 0x80, 0x3e, 0, 0, 2, 0, 16, 0]),
    ascii('data'),
    u32le(0),
  ]);
/** An EBML header with DocType "webm". */
export const webm = (): Buffer =>
  Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 1, 0x42, 0xf7, 0x81, 1]),
    Buffer.from([0x42, 0xf2, 0x81, 4, 0x42, 0xf3, 0x81, 8, 0x42, 0x82, 0x84]),
    ascii('webm'),
    Buffer.from([0x42, 0x87, 0x81, 4, 0x42, 0x85, 0x81, 2]),
  ]);
/** A minimal PDF. */
export const pdf = (): Buffer =>
  ascii('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

/** One file inside a test zip. */
export interface ZipEntry {
  name: string;
  data: string | Buffer;
  store?: boolean;
}

/** A zip archive built with yazl. */
export async function zip(entries: ZipEntry[]): Promise<Buffer> {
  const archive = new yazl.ZipFile();
  for (const e of entries) {
    archive.addBuffer(Buffer.from(e.data), e.name, { compress: !e.store });
  }
  archive.end();
  const chunks: Buffer[] = [];
  for await (const chunk of archive.outputStream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

const OOXML = {
  docx: ['wordprocessingml.document', 'word/document.xml'],
  xlsx: ['spreadsheetml.sheet', 'xl/workbook.xml'],
  pptx: ['presentationml.presentation', 'ppt/presentation.xml'],
} as const;

/** A minimal Office Open XML package. */
export const ooxml = (kind: keyof typeof OOXML): Promise<Buffer> => {
  const [type, part] = OOXML[kind];
  const contentTypes =
    '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    `<Override PartName="/${part}" ContentType="application/vnd.openxmlformats-officedocument.${type}.main+xml"/></Types>`;
  return zip([
    { name: '[Content_Types].xml', data: contentTypes },
    { name: part, data: '<?xml version="1.0"?><root/>' },
  ]);
};

/** A minimal OpenDocument package (stored `mimetype` first, as the format requires). */
export const odf = (kind: 'text' | 'spreadsheet' | 'presentation'): Promise<Buffer> =>
  zip([
    { name: 'mimetype', data: `application/vnd.oasis.opendocument.${kind}`, store: true },
    { name: 'content.xml', data: '<?xml version="1.0"?><office:document-content/>' },
  ]);

const SVG = '<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>\n';

/** A genuine sample for every extension in CONTENT_WHITELIST. */
export const SAMPLES: Readonly<Record<string, () => Buffer | Promise<Buffer>>> = {
  json: () => Buffer.from('{"title":"Oppgåve","items":[1,2]}', 'utf8'),
  png: () => png(),
  jpg: () => jpeg(),
  jpeg: () => jpeg(),
  gif,
  webp,
  svg: () => ascii(SVG),
  webm,
  mp4: () => ftyp('isom'),
  mp3: () => mp3(),
  m4a: () => ftyp('M4A '),
  ogg: () => ogg('vorbis'),
  wav,
  vtt: () => ascii('WEBVTT\n\n00:00.000 --> 00:01.000\n<v Lærar>Hei</v>\n'),
  webvtt: () => ascii('WEBVTT - tekst\n\n00:00.000 --> 00:01.000\nHei\n'),
  pdf,
  txt: () => Buffer.from('Notat om blåbær.\n', 'utf8'),
  csv: () => Buffer.from('namn;poeng\nÅse;3\n', 'utf8'),
  docx: () => ooxml('docx'),
  xlsx: () => ooxml('xlsx'),
  pptx: () => ooxml('pptx'),
  odt: () => odf('text'),
  ods: () => odf('spreadsheet'),
  odp: () => odf('presentation'),
};

/** Bytes of formats `image-size` parses with known loops (D-030) or that are not on the allowlist. */
export const UNSAFE_IMAGE_FORMATS: Readonly<Record<string, () => Buffer>> = {
  icns: () => Buffer.concat([ascii('icns'), u32be(24), ascii('ic07'), u32be(16), Buffer.alloc(8)]),
  heic: () => ftyp('heic'),
  heif: () => ftyp('mif1'),
  avif: () => ftyp('avif'),
  jxl: () => Buffer.concat([Buffer.from([0xff, 0x0a]), Buffer.alloc(30)]),
  jxlContainer: () =>
    Buffer.concat([u32be(12), ascii('JXL '), Buffer.from([0x0d, 0x0a, 0x87, 0x0a]), Buffer.alloc(20)]),
  tiff: () => Buffer.concat([ascii('II*\0'), u32le(8), Buffer.alloc(24)]),
  bmp: () => Buffer.concat([ascii('BM'), u32le(70), Buffer.alloc(64)]),
};
