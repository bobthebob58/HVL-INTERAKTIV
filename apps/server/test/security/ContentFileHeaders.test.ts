/**
 * Tests for the headers user files are served with: nosniff and the sandbox CSP everywhere, attachment for
 * everything that is not media or captions, UTF-8 for text, and safe file-name parameters.
 *
 * Spec: SEC-004
 */
import { describe, it, expect } from 'vitest';
import { CONTENT_WHITELIST } from '../../src/h5p/H5pConfigFactory.js';
import {
  contentDispositionFor,
  contentFileHeaders,
  contentTypeFor,
  USER_FILE_CSP,
} from '../../src/security/ContentFileHeaders.js';

const allowlisted = CONTENT_WHITELIST.split(' ');
const INLINE = [
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
];

describe('[SEC-004] ContentFileHeaders', () => {
  it('[SEC-004] every user file gets nosniff and the sandbox CSP', () => {
    // Act and assert: allowlisted, unknown and extension-less names all get both headers.
    for (const name of [
      ...allowlisted.map((ext) => `images/file.${ext}`),
      'unknown.bin',
      'noext',
      'x.HTML',
    ]) {
      const headers = contentFileHeaders(name);
      expect(headers['X-Content-Type-Options'], name).toBe('nosniff');
      expect(headers['Content-Security-Policy'], name).toBe(USER_FILE_CSP);
      expect(headers['Content-Type'], name).toBe(contentTypeFor(name));
    }
    // Assert: the policy text itself.
    expect(USER_FILE_CSP).toBe("sandbox; default-src 'none'; style-src 'unsafe-inline'");
  });

  it('[SEC-004] SVG and documents are attachments; images, audio, video and captions are inline', () => {
    for (const ext of allowlisted) {
      const disposition = contentDispositionFor(`file.${ext}`);
      if (INLINE.includes(ext)) expect(disposition, ext).toBe('inline');
      else expect(disposition, ext).toBe(`attachment; filename="file.${ext}"; filename*=UTF-8''file.${ext}`);
    }
    expect(contentDispositionFor('BILDE.PNG')).toBe('inline');
    expect(contentDispositionFor('Figur.SVG')).toMatch(/^attachment;/);
    expect(contentDispositionFor('page.html')).toMatch(/^attachment;/);
    expect(contentDispositionFor('noext')).toMatch(/^attachment;/);
  });

  it('[SEC-004] the attachment file name is RFC 6266 encoded and cannot break the header', () => {
    expect(contentDispositionFor('content/files/Blåbær (1).pdf')).toBe(
      `attachment; filename="Bl_b_r _1_.pdf"; filename*=UTF-8''Bl%C3%A5b%C3%A6r%20%281%29.pdf`,
    );
    const hostile = contentDispositionFor('a"\r\nSet-Cookie: x=1;\'*.pdf');
    expect(hostile).not.toMatch(/[\r\n]/);
    expect(hostile).toBe(
      `attachment; filename="a___Set-Cookie_ x_1___.pdf"; filename*=UTF-8''a%22%0D%0ASet-Cookie%3A%20x%3D1%3B%27%2A.pdf`,
    );
    expect(() => contentDispositionFor('lone\ud800surrogate.pdf')).not.toThrow();
    expect(contentDispositionFor('dir\\sub\\Notat.docx')).toContain('filename="Notat.docx"');
  });

  it('[SEC-004] text types are served as UTF-8', () => {
    expect(contentTypeFor('a.txt')).toBe('text/plain; charset=utf-8');
    expect(contentTypeFor('a.csv')).toBe('text/csv; charset=utf-8');
    expect(contentTypeFor('a.json')).toBe('application/json; charset=utf-8');
    expect(contentTypeFor('a.vtt')).toBe('text/vtt; charset=utf-8');
    expect(contentTypeFor('a.webvtt')).toBe('text/vtt; charset=utf-8');
    expect(contentTypeFor('a.svg')).toBe('image/svg+xml; charset=utf-8');
    for (const ext of ['png', 'mp4', 'mp3', 'pdf', 'docx'])
      expect(contentTypeFor(`a.${ext}`)).not.toContain('charset');
  });

  it('[SEC-004] the type comes from an explicit map; anything else is a download of octet-stream', () => {
    // Arrange
    const expected: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      webm: 'video/webm',
      mp4: 'video/mp4',
      mp3: 'audio/mpeg',
      m4a: 'audio/mp4',
      ogg: 'audio/ogg',
      wav: 'audio/wav',
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      odt: 'application/vnd.oasis.opendocument.text',
      ods: 'application/vnd.oasis.opendocument.spreadsheet',
      odp: 'application/vnd.oasis.opendocument.presentation',
    };
    // Act and assert: no allowlisted extension falls back to octet-stream, and the listed ones match.
    for (const ext of allowlisted) {
      expect(contentTypeFor(`x.${ext}`), ext).not.toBe('application/octet-stream');
      if (expected[ext]) expect(contentTypeFor(`x.${ext}`), ext).toBe(expected[ext]);
    }
    // Act and assert: anything else is an octet-stream attachment.
    for (const name of ['x.html', 'x.htm', 'x.xml', 'x.js', 'x.svgz', 'noext', '.svg.html']) {
      expect(contentTypeFor(name), name).toBe('application/octet-stream');
      expect(contentDispositionFor(name), name).toMatch(/^attachment;/);
    }
    // Act and assert: the case of the extension does not matter.
    expect(contentTypeFor('IMAGE.PNG')).toBe('image/png');
  });
});
