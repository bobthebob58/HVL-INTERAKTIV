/**
 * Tests for file answers (D-099): the portfolio export comes back as a typed blob with the server's suggested name,
 * the request carries the CSRF token and a JSON body and is never cached, a refusal comes back as the JSON error body,
 * nothing throws, and `Content-Disposition` names are read as RFC 6266 says and reduced to a bare name.
 *
 * Spec: MAPPE-001, AUTH-003, DOC-012
 */
import { describe, expect, it, vi } from 'vitest';
import { apiFileRequest, CSRF_HEADER } from '../../src/api/apiRequest';
import { filenameFromDisposition } from '../../src/api/contentDisposition';
import { errorBody, fakeFetch } from '../support/fakeFetch';

const EXPORT = '/api/mappe/export?format=md';
const PORTAL = { kind: 'portal', csrfToken: 'tok' } as const;

describe('[MAPPE-001] file answers', () => {
  it('[MAPPE-001] a POST export answers the file, its type and its name, and is never cached', async () => {
    // Arrange
    const requests = fakeFetch({
      [`POST ${EXPORT}`]: {
        status: 200,
        raw: '# Pedagogisk mappe\n',
        headers: {
          'content-type': 'text/markdown; charset=utf-8',
          'content-disposition': `attachment; filename="mappe.md"; filename*=UTF-8''pedagogisk%20mappe.md`,
        },
      },
    });
    // Act
    const result = await apiFileRequest(EXPORT, PORTAL, {
      method: 'POST',
      body: { activityIds: [] },
      accept: 'text/markdown',
    });
    // Assert
    expect(result).toMatchObject({
      ok: true,
      status: 200,
      mediaType: 'text/markdown; charset=utf-8',
      filename: 'pedagogisk mappe.md',
    });
    expect(result.ok && (await result.blob.text())).toBe('# Pedagogisk mappe\n');
    expect(requests[0]).toMatchObject({ method: 'POST', body: { activityIds: [] }, cache: 'no-store' });
    expect(requests[0]?.headers).toEqual({
      Accept: 'text/markdown',
      'Content-Type': 'application/json',
      [CSRF_HEADER]: 'tok',
    });
  });

  it('[MAPPE-001] a binary PDF arrives byte for byte, and a missing name is left out', async () => {
    // Arrange
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0xff]);
    fakeFetch({
      [`GET /api/file`]: { status: 200, raw: bytes, headers: { 'content-type': 'application/pdf' } },
    });
    // Act
    const result = await apiFileRequest('/api/file', PORTAL);
    // Assert
    expect(result).toMatchObject({ ok: true, mediaType: 'application/pdf' });
    expect(result.ok && 'filename' in result).toBe(false);
    expect(result.ok && new Uint8Array(await result.blob.arrayBuffer())).toEqual(bytes);
  });

  it('[DOC-012] a refusal answers the server’s JSON error body, as for any other route', async () => {
    fakeFetch({
      [`POST ${EXPORT}`]: { status: 503, body: errorBody(503, 'hvl:pdf-unavailable', 'Ikkje no.') },
    });
    const result = await apiFileRequest(EXPORT, PORTAL, { method: 'POST', body: {} });
    expect(result).toMatchObject({ ok: false, status: 503, error: { errorCode: 'hvl:pdf-unavailable' } });
  });

  it('[DOC-012] a network failure is status 0, never an exception', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline')));
    expect(await apiFileRequest(EXPORT, PORTAL, { method: 'POST', body: {} })).toEqual({
      ok: false,
      status: 0,
    });
  });
});

describe('[MAPPE-001] the suggested file name', () => {
  it.each([
    ['a quoted name', 'attachment; filename="mappe.pdf"', 'mappe.pdf'],
    ['a token name', 'attachment; filename=mappe.md', 'mappe.md'],
    ['a quoted name with escapes and a semicolon', 'attachment; filename="a\\"b;c.md"', 'a"b;c.md'],
    [
      'filename* before filename, in any case',
      `attachment; FILENAME*=utf-8'nn'm%C3%B8nster.md; filename="x"`,
      'mønster.md',
    ],
    [
      'filename* that cannot be decoded, falling back',
      `attachment; filename*=UTF-8''%E0%A4%A; filename="x.md"`,
      'x.md',
    ],
    [
      'filename* in another charset, falling back',
      `attachment; filename*=ISO-8859-1''%E6.md; filename="y.md"`,
      'y.md',
    ],
    ['a folder part', 'attachment; filename="../../etc/passwd"', 'passwd'],
    ['a Windows folder part', 'attachment; filename="C:\\\\Users\\\\x.pdf"', 'x.pdf'],
    ['control characters', `attachment; filename*=UTF-8''a%0Ab%00.md`, 'ab.md'],
    ['a direction override', `attachment; filename*=UTF-8''mappe%E2%80%AEfdp.exe`, 'mappefdp.exe'],
    ['direction marks and isolates', 'attachment; filename="a\u200f\u2066b\u2069.md"', 'ab.md'],
  ])('[MAPPE-001] reads %s', (_case, header, expected) => {
    expect(filenameFromDisposition(header)).toBe(expected);
  });

  it.each([
    ['no header', null],
    ['no name', 'attachment'],
    ['an empty name', 'attachment; filename=""'],
    ['a dot-dot name', 'attachment; filename=".."'],
  ])('[MAPPE-001] gives no name for %s', (_case, header) => {
    expect(filenameFromDisposition(header)).toBeUndefined();
  });
});
