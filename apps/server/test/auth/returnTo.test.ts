/**
 * Tests for the post-login return target: local paths pass, every open-redirect and script trick falls back to `/`.
 *
 * Spec: AUTH-003, PROD-004
 */
import { describe, expect, it } from 'vitest';
import { MAX_RETURN_TO_LENGTH, safeReturnTo } from '../../src/auth/returnTo.js';

describe('[AUTH-003] safe return target after login', () => {
  it.each([
    ['/', '/'],
    ['/mappe', '/mappe'],
    ['/h5p/play/0192f6a8?embed=1', '/h5p/play/0192f6a8?embed=1'],
    ['/innsikt?course=ppu&tab=2#chart', '/innsikt?course=ppu&tab=2'],
    ['/a/./b/../c', '/a/c'],
    ['/s%C3%B8k?q=l%C3%A6ring', '/s%C3%B8k?q=l%C3%A6ring'],
    ['/søk', '/s%C3%B8k'],
    ['/ok?next=//evil.example', '/ok?next=//evil.example'],
    ['/a//b', '/a//b'],
  ])('[AUTH-003] keeps the local path %j as %j', (raw, expected) => {
    expect(safeReturnTo(raw)).toBe(expected);
  });

  it.each([
    ['an absolute URL', 'https://evil.example/'],
    ['an absolute URL to our own host', 'https://interaktiv.hvl.no/mappe'],
    ['a protocol-relative URL', '//evil.example'],
    ['three slashes', '///evil.example'],
    ['slash backslash', '/\\evil.example'],
    ['backslash slash', '\\/evil.example'],
    ['a backslash later in the path', '/a\\b'],
    ['javascript:', 'javascript:alert(1)'],
    ['JavaScript: in mixed case', 'JaVaScRiPt:alert(1)'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['a relative path', 'mappe'],
    ['a query only', '?x=1'],
    ['a fragment only', '#top'],
    ['an empty string', ''],
    ['a leading blank', ' /mappe'],
    ['a tab inside //', '/\t/evil.example'],
    ['a newline (header injection)', '/mappe\r\nSet-Cookie: x=1'],
    ['a NUL byte', '/mappe\u0000'],
    ['DEL', '/mappe\u007f'],
    ['an encoded second slash', '/%2Fevil.example'],
    ['encoded double slash', '/%2F%2Fevil.example'],
    ['an encoded backslash', '/%5Cevil.example'],
    ['a lower-case encoded backslash', '/%5cevil.example'],
    ['double-encoded slashes', '/%252F%252Fevil.example'],
    ['triple-encoded slashes', '/%25252F%25252Fevil.example'],
    ['an encoded newline', '/mappe%0D%0ALocation:%20https://evil.example'],
    ['an encoded NUL', '/mappe%00'],
    ['a malformed percent escape', '/mappe%E0%A4%A'],
    ['an encoded percent sign, which decodes to a malformed escape', '/mappe?q=50%25'],
    ['four levels of encoding', '/a%2525252F'],
    ['dot segments that end in //', '/..//evil.example'],
    ['a dot segment that ends in //', '/.//evil.example'],
    ['encoded dot segments that end in //', '/a/%2e%2e/%2E%2E//evil.example'],
    ['a value that is not text', ['/mappe']],
    ['undefined', undefined],
  ])('[AUTH-003] refuses %s', (_case, raw) => {
    expect(safeReturnTo(raw)).toBe('/');
  });

  it('[AUTH-003] refuses anything over 2048 characters, before and after normalisation', () => {
    // Arrange
    const atLimit = `/${'a'.repeat(MAX_RETURN_TO_LENGTH - 1)}`;
    const overLimit = `${atLimit}a`;
    const growsWhenEncoded = `/${'ø'.repeat(MAX_RETURN_TO_LENGTH / 2)}`;
    // Act and assert
    expect(safeReturnTo(atLimit)).toBe(atLimit);
    expect(safeReturnTo(overLimit)).toBe('/');
    expect(growsWhenEncoded.length).toBeLessThan(MAX_RETURN_TO_LENGTH);
    expect(safeReturnTo(growsWhenEncoded)).toBe('/');
  });

  it('[AUTH-003] always returns a path that a browser resolves on our own origin', () => {
    // Arrange
    const ours = 'https://interaktiv.hvl.no';
    const tricky = [
      '/..//evil.example',
      '/%2F%2Fevil.example',
      '/a/../b?c=//d',
      '/\u3000/evil.example',
      '/x?y=%2F%2F',
    ];
    // Act and assert
    for (const raw of tricky) {
      expect(new URL(safeReturnTo(raw), ours).origin, raw).toBe(ours);
    }
  });
});
