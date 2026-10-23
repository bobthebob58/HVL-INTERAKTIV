/**
 * Tests for the nonce policy of the web app's pages: no inline scripts without the nonce, first-party sources only,
 * and the development relaxations only in development.
 *
 * Spec: DATA-011, H5P-009
 */
import { describe, expect, it } from 'vitest';
import { createNonce, webPageCsp } from '../../src/web/webPageCsp.js';

const directives = (csp: string) =>
  new Map(csp.split('; ').map((d) => [d.split(' ')[0] ?? '', d.split(' ').slice(1)] as const));

describe('[DATA-011] web page policy', () => {
  it('[DATA-011] production: scripts and styles by nonce, everything first-party, no inline or eval', () => {
    // Act
    const csp = directives(webPageCsp({ nonce: 'abc', dev: false, frameAncestors: ["'self'"] }));
    // Assert
    expect(csp.get('default-src')).toEqual(["'none'"]);
    expect(csp.get('script-src')).toEqual(["'self'", "'nonce-abc'"]);
    expect(csp.get('style-src')).toEqual(["'self'", "'nonce-abc'"]);
    for (const name of ['img-src', 'connect-src', 'frame-src', 'font-src'])
      expect(csp.get(name)?.[0]).toBe("'self'");
    expect([...csp.values()].flat().filter((source) => /^https?:/.test(source))).toEqual([]);
    expect([...csp.values()].flat()).not.toContain("'unsafe-inline'");
    expect([...csp.values()].flat()).not.toContain("'unsafe-eval'");
    expect(csp.get('frame-ancestors')).toEqual(["'self'"]);
  });

  it('[H5P-009] development allows eval and inline styles for the dev server, never inline scripts', () => {
    const csp = directives(webPageCsp({ nonce: 'abc', dev: true, frameAncestors: [] }));
    expect(csp.get('script-src')).toEqual(["'self'", "'nonce-abc'", "'unsafe-eval'"]);
    expect(csp.get('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
  });

  it('[DATA-011] every nonce is fresh, 128 bits in base64', () => {
    const nonces = new Set(Array.from({ length: 50 }, createNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(Buffer.from(nonce, 'base64')).toHaveLength(16);
  });
});
