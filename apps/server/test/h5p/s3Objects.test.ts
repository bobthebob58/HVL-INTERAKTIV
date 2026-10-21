/**
 * Unit tests for the S3 helper functions: safe object names and byte ranges.
 *
 * Spec: SEC-005, H5P-004
 */
import { describe, it, expect } from 'vitest';
import { assertSafeObjectName, isNotFound, rangeHeader } from '../../src/h5p/storage/s3Objects.js';

describe('[SEC-005] object names', () => {
  it('[SEC-005] accepts H5P file names with folders', () => {
    expect(assertSafeObjectName('images/photo-1a2b.png')).toBe('images/photo-1a2b.png');
    expect(assertSafeObjectName('video.mp4')).toBe('video.mp4');
  });

  it('[SEC-005] rejects traversal, absolute, empty-segment, backslash and control-character names', () => {
    for (const name of ['../x.png', 'a/../../x', '/etc/passwd', 'a//b', './a', 'a\\b', 'a\nb', '']) {
      expect(() => assertSafeObjectName(name), JSON.stringify(name)).toThrow('unsafe file name');
    }
  });
});

describe('[H5P-004] S3 request details', () => {
  it('[H5P-004] builds inclusive byte ranges for video seeking', () => {
    expect(rangeHeader()).toBeUndefined();
    expect(rangeHeader(0, 99)).toBe('bytes=0-99');
    expect(rangeHeader(100)).toBe('bytes=100-');
  });

  it('[H5P-004] recognises the SDK error shapes for a missing object', () => {
    expect(isNotFound({ name: 'NoSuchKey' })).toBe(true);
    expect(isNotFound({ name: 'NotFound' })).toBe(true);
    expect(isNotFound({ $metadata: { httpStatusCode: 404 } })).toBe(true);
    expect(isNotFound({ name: 'AccessDenied', $metadata: { httpStatusCode: 403 } })).toBe(false);
  });
});
