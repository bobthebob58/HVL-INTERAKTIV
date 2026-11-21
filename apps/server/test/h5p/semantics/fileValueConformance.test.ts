/**
 * Unit tests of what a file, image, video or audio value may hold (D-123): H5P's keys for it and nothing else,
 * each of its type; what does not fit is listed for removal, and a number written as text becomes a number.
 *
 * Spec: SEC-008
 */
import { describe, expect, it } from 'vitest';
import {
  fileValueFixes,
  finiteNumber,
  type ConformanceFix,
  type FileKind,
} from '../../../src/h5p/semantics/fileValueConformance.js';

const MARKUP = '"><img src=x onerror=alert(1)>';
/** Applies the fixes, as ./semanticsConformance.ts does. */
const fitted = (file: Record<string, unknown>, kind: FileKind, extra: string[] = []) => {
  for (const fix of fileValueFixes(file, kind, extra) as ConformanceFix[]) {
    if ('remove' in fix) delete fix.from[fix.remove];
    else fix.on[fix.set] = fix.to;
  }
  return file;
};

describe('[SEC-008] what a file value may hold', () => {
  it('[SEC-008] a file as the editor writes it needs no fix', () => {
    // Arrange
    const image = {
      path: 'images/celle-1a2b.png',
      mime: 'image/png',
      copyright: { license: 'CC BY' },
      width: 800,
      height: 600,
      originalImage: { path: 'images/original-3c4d.png', mime: 'image/png', width: 1600, height: 1200 },
    };
    const video = {
      path: 'https://www.youtube.com/watch?v=abc',
      mime: 'video/YouTube',
      copyright: { license: 'U' },
      aspectRatio: '16:9',
      metadata: { qualityName: 'HD' },
    };
    const clip = { path: 'videos/a.mp4', mime: 'video/mp4', codecs: 'avc1.42E01E, mp4a.40.2', bitrate: 1200 };
    // Act and assert
    expect(fileValueFixes(image, 'image')).toEqual([]);
    expect(fileValueFixes(video, 'video', ['metadata'])).toEqual([]);
    expect(fileValueFixes({ ...clip, quality: { level: 2, label: '720p' } }, 'video')).toEqual([]);
    expect(fileValueFixes({ path: 'audios/a.mp3', mime: 'audio/mpeg' }, 'audio')).toEqual([]);
  });

  it('[SEC-008] keys a file does not have are removed, by the kind of field', () => {
    // Arrange: one unknown key, and keys that only another kind of file has
    const keys = {
      path: 'a.png',
      mime: 'image/png',
      width: 1,
      codecs: 'vp9',
      aspectRatio: '4:3',
      title: MARKUP,
    };
    // Act and assert
    expect(Object.keys(fitted({ ...keys }, 'image')).sort()).toEqual(['mime', 'path', 'width']);
    expect(Object.keys(fitted({ ...keys }, 'video')).sort()).toEqual(
      ['aspectRatio', 'codecs', 'mime', 'path', 'width'].sort(),
    );
    expect(Object.keys(fitted({ ...keys }, 'audio')).sort()).toEqual(['mime', 'path']);
    expect(Object.keys(fitted({ ...keys, metadata: {} }, 'file')).sort()).toEqual(['mime', 'path']);
    expect(Object.keys(fitted({ ...keys, metadata: {} }, 'video', ['metadata']))).toContain('metadata');
  });

  it('[SEC-008] a value that is not of its key’s type is removed, and a numeric string becomes a number', () => {
    // Arrange
    const video = {
      path: 'a.mp4',
      mime: `video/mp4${MARKUP}`,
      width: '640',
      height: MARKUP,
      bitrate: Number.POSITIVE_INFINITY,
      codecs: MARKUP,
      aspectRatio: `16:9${MARKUP}`,
      copyright: MARKUP,
      quality: { level: '3', label: `HD${MARKUP}`, onclick: MARKUP },
    };
    // Act
    const result = fitted(video, 'video');
    // Assert
    expect(result).toEqual({ path: 'a.mp4', width: 640, quality: { level: 3, label: 'HD"&gt;' } });
    expect(JSON.stringify(fitted({ path: 'a.mp4', quality: { level: MARKUP, label: 'HD' } }, 'video'))).toBe(
      '{"path":"a.mp4"}',
    );
  });

  it('[SEC-008] an original image is an image value without an original of its own', () => {
    // Arrange
    const nested = { path: 'c.png', mime: 'image/png' };
    const image = {
      path: 'a.png',
      originalImage: { path: 'b.png', width: '10', title: MARKUP, originalImage: nested },
    };
    // Act and assert
    expect(fitted(image, 'image')).toEqual({ path: 'a.png', originalImage: { path: 'b.png', width: 10 } });
    expect(fitted({ path: 'a.png', originalImage: [nested] }, 'image')).toEqual({ path: 'a.png' });
    expect(fitted({ path: 'a.mp4', originalImage: nested }, 'video')).toEqual({ path: 'a.mp4' });
  });

  it('[SEC-008] a finite number is a number or a string that holds one, and nothing else', () => {
    // Act and assert
    expect([finiteNumber(3), finiteNumber('3.5'), finiteNumber(' 7 ')]).toEqual([3, 3.5, 7]);
    for (const value of ['', ' ', '3px', MARKUP, Number.NaN, Number.POSITIVE_INFINITY, null, true, [1], {}]) {
      expect(finiteNumber(value)).toBeUndefined();
    }
  });
});
