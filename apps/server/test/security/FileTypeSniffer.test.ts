/**
 * Tests for the file-type sniffer: magic bytes per allowlisted extension, polyglots, HTML-sniffable text,
 * extensions outside the allowlist and the image formats D-030 keeps away from image-size.
 *
 * Spec: SEC-002
 */
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileSanitizerResult } from '@lumieducation/h5p-server';
import { CONTENT_WHITELIST } from '../../src/h5p/H5pConfigFactory.js';
import { FileTypeSniffer } from '../../src/security/FileTypeSniffer.js';
import { RejectedUploadError } from '../../src/security/RejectedUploadError.js';
import { t } from '../../src/i18n/translate.js';
import * as bytes from '../support/sniffFixtures.js';

const dir = mkdtempSync(join(tmpdir(), 'sniff-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let counter = 0;
const sniffer = new FileTypeSniffer();

/** Writes `data` under a fresh folder with exactly the file name given. */
const place = (name: string, data: Buffer | string): string => {
  const folder = join(dir, String((counter += 1)));
  mkdirSync(folder);
  const path = join(folder, name);
  writeFileSync(path, data);
  return path;
};

const rejection = async (name: string, data: Buffer | string): Promise<RejectedUploadError> => {
  const error = await sniffer.sanitize(place(name, data)).catch((e: unknown) => e);
  expect(error, name).toBeInstanceOf(RejectedUploadError);
  return error as RejectedUploadError;
};
const expectMismatch = async (name: string, data: Buffer | string): Promise<void> => {
  expect((await rejection(name, data)).messageKey, name).toBe('upload.file.typeMismatch');
};
const html = '<!DOCTYPE html><html><body><script>alert(document.domain)</script></body></html>';

describe('[SEC-002] FileTypeSniffer', () => {
  const allowlisted = CONTENT_WHITELIST.split(' ');

  it.each(allowlisted)(
    '[SEC-002] accepts matching magic bytes for every allowlisted extension: .%s',
    async (ext) => {
      const sample = bytes.SAMPLES[ext];
      expect(sample, `a sample for .${ext}`).toBeDefined();
      const path = place(`file.${ext}`, await sample!());
      expect(await sniffer.sanitize(path)).toBe(FileSanitizerResult.NotSanitized);
    },
  );

  it('[SEC-002] accepts the other detections an extension allows, and upper-case extensions', async () => {
    const variants: [string, Buffer | string][] = [
      ['anim.png', bytes.apng()],
      ['clip.mp4', bytes.ftyp('M4V ')],
      ['song.m4a', bytes.ftyp('mp42')],
      ['speech.ogg', bytes.ogg('opus')],
      ['lossless.ogg', bytes.ogg('flac')],
      ['tagged.mp3', bytes.mp3(true)],
      ['BILDE.PNG', bytes.png()],
      ['Foto.JPeG', bytes.jpeg()],
      ['bom.vtt', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('WEBVTT\n')])],
      ['bom.json', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('[1]')])],
      ['empty.txt', Buffer.alloc(0)],
      [
        'inkscape.svg',
        '<?xml version="1.0"?>\n<!-- x -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x">\n<svg/>',
      ],
    ];
    for (const [name, data] of variants) {
      expect(await sniffer.sanitize(place(name, data)), name).toBe(FileSanitizerResult.NotSanitized);
    }
  });

  it('[SEC-002] refuses HTML in a .png and other polyglots', async () => {
    const cases: [string, Buffer | string][] = [
      ['image.png', html],
      ['image.png', bytes.gif()],
      ['image.jpg', bytes.png()],
      ['image.gif', bytes.webp()],
      ['image.webp', bytes.wav()],
      ['image.png', Buffer.concat([bytes.png(), Buffer.from(html)])],
      ['image.gif', `GIF89a${html}`],
      ['image.jpg', bytes.jpeg([bytes.jpegComment('<script>alert(1)</script>')])],
      ['image.webp', Buffer.concat([bytes.webp(), Buffer.from(html)])],
      ['sound.mp3', bytes.ftyp('isom')],
      ['video.mp4', bytes.webm()],
      ['video.webm', bytes.ftyp('isom')],
      ['sound.ogg', bytes.mp3()],
      ['sound.wav', bytes.ogg('vorbis')],
      ['notes.pdf', html],
      ['report.docx', await bytes.zip([{ name: 'index.html', data: html }])],
      ['report.docx', await bytes.ooxml('xlsx')],
      ['sheet.xlsx', await bytes.odf('spreadsheet')],
      ['slides.odp', await bytes.ooxml('pptx')],
      ['drawing.svg', bytes.png()],
      ['data.json', bytes.pdf()],
    ];
    for (const [name, data] of cases) await expectMismatch(name, data);
  });

  it('[SEC-002] refuses text files a browser would sniff as HTML', async () => {
    const cases: [string, Buffer | string][] = [
      ['notes.txt', html],
      ['notes.txt', '  \n\t<html><script>alert(1)</script>'],
      ['notes.txt', '<script>alert(1)</script>'],
      ['notes.txt', '<!-- comment --><img src=x onerror=alert(1)>'],
      [
        'notes.txt',
        '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></html>',
      ],
      ['table.csv', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('<body onload=alert(1)>')])],
      ['table.csv', 'a;b\n1;\u0000;2\n'],
      ['notes.txt', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(html, 'utf16le')])],
      ['notes.txt', bytes.pdf()],
      ['captions.vtt', html],
      ['captions.vtt', 'WEBVTTX\n'],
      ['captions.webvtt', '1\n00:00.000 --> 00:01.000\nHei\n'],
      ['data.json', '<html></html>'],
      ['data.json', '{"a":'],
      ['data.json', Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x3a, 0x31, 0x7d])],
      ['drawing.svg', html],
      ['drawing.svg', '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><svg/></html>'],
    ];
    for (const [name, data] of cases) await expectMismatch(name, data);
  });

  it('[SEC-002] refuses extensions outside the allowlist', async () => {
    for (const name of [
      'page.html',
      'page.htm',
      'data.xml',
      'film.swf',
      'readme.md',
      'run.exe',
      'app.js',
      'x.svgz',
      'noext',
      'x.',
    ]) {
      const error = await rejection(name, 'harmless text');
      expect(error.messageKey, name).toBe('upload.file.notAllowed');
    }
    const error = await rejection('Page.HTML', html);
    expect(error.params).toEqual({ extension: 'html' });
    expect(t(error.messageKey, error.params, 'en')).toContain('.html');
  });

  it('[SEC-002] refuses ICNS, HEIF, JXL, TIFF and BMP bytes under image names (D-030)', async () => {
    for (const [format, build] of Object.entries(bytes.UNSAFE_IMAGE_FORMATS)) {
      for (const ext of ['png', 'jpg', 'jpeg', 'gif', 'webp'])
        await expectMismatch(`${format}.${ext}`, build());
    }
  });
});
