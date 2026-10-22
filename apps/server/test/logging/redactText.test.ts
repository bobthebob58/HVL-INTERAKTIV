/**
 * Tests for free-text redaction: what is masked, what is kept, valid output and linear running time.
 *
 * Spec: DATA-009, NFR-006
 */
import { describe, it, expect } from 'vitest';
import { redactText } from '../../src/logging/redactText.js';

describe('[DATA-009] credentials and e-mail addresses in free text', () => {
  it('[DATA-009] masks tokens in query strings and form bodies', () => {
    const text = redactText(
      'GET /cb?code=abc123&state=s1&access_token=AT9&api_key=K1 body ltik=L1&id_token_hint=eyJx&password=hunter2',
    );
    for (const leaked of ['abc123', 'AT9', 'K1', 'L1', 'eyJx', 'hunter2'])
      expect(text, leaked).not.toContain(leaked);
    expect(text).toContain('state=s1');
  });

  it('[DATA-009] masks authorization credentials in any case, with or without a colon', () => {
    for (const header of [
      'Bearer abc.def',
      'bearer abc.def',
      'BEARER x1y2',
      'Bearer: abc123secret',
      'Basic dXNlcjpwYXNzd29yZA==',
    ]) {
      expect(redactText(`authorization: ${header}`), header).toMatch(/\[Redacted\]$/);
    }
  });

  it('[DATA-009] masks passwords in URLs up to the last @ before the host', () => {
    expect(redactText('postgres://u:p@ss@db:5432/hvli')).toBe('postgres://[Redacted]@db:5432/hvli');
    expect(redactText('redis://default:hunter2@cache:6379')).toBe('redis://[Redacted]@cache:6379');
  });

  it('[DATA-009] masks e-mail addresses, including non-ASCII and %40-encoded ones', () => {
    for (const mail of ['kari@hvl.no', 'kåre@hvl.no', 'kari@høgskulen.no', 'login_hint=kari%40hvl.no']) {
      expect(redactText(`user ${mail} logged in`), mail).not.toMatch(/kari|kåre/);
    }
  });

  it('[DATA-009] keeps ordinary prose, package versions and URLs without credentials', () => {
    const kept = [
      'basic validation failed for field',
      'the bearer of bad news',
      '@lumieducation/h5p-server@10.0.4 loaded; installed express@4.22.3',
      'https://hub-api.h5p.org/v1/content-types/',
      'exit code=1',
    ];
    for (const text of kept) expect(redactText(text), text).toBe(text);
  });

  it('[NFR-006] never consumes quotes, commas or braces, so JSON around a match stays valid', () => {
    const json = JSON.stringify({
      u: 'http://h',
      k: { x: 'a@b' },
      ref: '<a href="/app?ltik=abc">',
      pkg: '@hvl/x',
    });
    expect(() => JSON.parse(redactText(json))).not.toThrow();
    expect(JSON.parse(redactText(json))).toMatchObject({ u: 'http://h', pkg: '@hvl/x' });
  });

  it('[NFR-006] runs in linear time on long strings without matches', () => {
    for (const filler of ['A', 'a.b', 'x@']) {
      const long = `data:image/png;base64,${filler.repeat(Math.ceil(200_000 / filler.length))}`;
      const started = performance.now();
      redactText(long);
      expect(performance.now() - started, filler).toBeLessThan(250);
    }
  });
});
