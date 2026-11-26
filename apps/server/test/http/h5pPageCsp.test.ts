/**
 * Tests for the Content Security Policy of the H5P pages: no inline or eval scripts, first-party sources, outside
 * media only from configured origins, Panopto's embed API only with a configured Panopto site, and the framing the
 * caller asks for.
 *
 * Spec: DATA-011, H5P-009, LTI-003
 */
import { describe, expect, it } from 'vitest';
import { h5pPageCsp, isPanoptoOrigin, PANOPTO_EMBED_API_URL } from '../../src/http/h5pPageCsp.js';

const directives = (csp: string) =>
  new Map(csp.split('; ').map((d) => [d.split(' ')[0] ?? '', d.split(' ').slice(1)] as const));

describe('[DATA-011] H5P page policy', () => {
  it('[DATA-011] allows our own script files only: no inline script, hash, nonce or eval, and nothing third-party', () => {
    // Act
    const policy = h5pPageCsp({ externalMediaOrigins: [] }, ["'self'"]);
    const csp = directives(policy);
    // Assert: `script-src` is our own origin and nothing else, so no inline script runs by a hash either (D-140)
    expect(csp.get('default-src')).toEqual(["'none'"]);
    expect(csp.get('script-src')).toEqual(["'self'"]);
    expect(policy).not.toMatch(/'sha(256|384|512)-|'nonce-|'unsafe-inline' *;? *script|'strict-dynamic'/);
    for (const page of [{}, { playerFiles: true }]) {
      const scripts = directives(h5pPageCsp({ externalMediaOrigins: [] }, ["'self'"], page)).get(
        'script-src',
      );
      expect(scripts).toEqual(["'self'"]);
    }
    expect(csp.get('img-src')).toEqual(["'self'", 'data:', 'blob:']);
    expect(csp.get('media-src')).toEqual(["'self'", 'blob:']);
    expect(csp.get('connect-src')).toEqual(["'self'"]);
    expect(csp.get('frame-src')).toEqual(["'self'"]);
    expect(csp.get('font-src')).toEqual(["'self'", 'data:']);
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('base-uri')).toEqual(["'self'"]);
    expect([...csp.values()].flat()).not.toContain("'unsafe-eval'");
    expect(csp.get('script-src')).not.toContain("'unsafe-inline'");
  });

  it('[DATA-011] configured media origins are allowed for images, media and frames only', () => {
    const csp = directives(
      h5pPageCsp({ externalMediaOrigins: ['https://hvl.cloud.panopto.eu'] }, ["'self'"]),
    );
    for (const name of ['img-src', 'media-src', 'frame-src'])
      expect(csp.get(name)).toContain('https://hvl.cloud.panopto.eu');
    for (const name of ['script-src', 'connect-src', 'style-src']) {
      expect(csp.get(name)).not.toContain('https://hvl.cloud.panopto.eu');
    }
  });

  it('[DATA-011] a configured Panopto site adds Panopto’s embed API to script-src, and nothing else does', () => {
    // Arrange
    const scriptsWith = (origins: string[]) =>
      directives(h5pPageCsp({ externalMediaOrigins: origins }, ["'self'"])).get('script-src');
    // Act and assert
    expect(scriptsWith(['https://media.hvl.no', 'https://hvl.cloud.panopto.eu'])).toEqual([
      "'self'",
      PANOPTO_EMBED_API_URL,
    ]);
    expect(scriptsWith(['https://hvl.hosted.panopto.com'])).toContain(PANOPTO_EMBED_API_URL);
    // SECURITY: the file H5P.Video 1.6 inserts, as a path source; never the whole developers.panopto.com origin.
    expect(PANOPTO_EMBED_API_URL).toBe('https://developers.panopto.com/scripts/v1.2.0/embedapi.min.js');
    expect(scriptsWith(['https://hvl.cloud.panopto.eu'])).not.toContain('https://developers.panopto.com');
    expect(scriptsWith(['https://media.hvl.no'])).toEqual(["'self'"]);
    expect(scriptsWith([])).toEqual(["'self'"]);
  });

  it('[DATA-011] only subdomains of panopto.com and panopto.eu count as Panopto sites', () => {
    expect(isPanoptoOrigin('https://hvl.cloud.panopto.eu')).toBe(true);
    expect(isPanoptoOrigin('https://HVL.Hosted.Panopto.COM')).toBe(true);
    for (const origin of [
      'https://panopto.eu.evil.example',
      'https://evilpanopto.com',
      'https://panopto.com',
      'https://hvl.panopto.eu.example',
    ]) {
      expect(isPanoptoOrigin(origin)).toBe(false);
    }
  });

  it('[DATA-011] a player page frames only configured media origins, never our own origin; the editor page may', () => {
    // Arrange
    const none = { externalMediaOrigins: [] as string[] };
    const panopto = { externalMediaOrigins: ['https://hvl.cloud.panopto.eu'] };
    const frames = (settings: typeof none, player: boolean) =>
      directives(h5pPageCsp(settings, ["'self'"], { playerFiles: player })).get('frame-src');
    // Act and assert
    expect(frames(none, true)).toEqual(["'none'"]);
    expect(frames(panopto, true)).toEqual(['https://hvl.cloud.panopto.eu']);
    expect(frames(none, false)).toEqual(["'self'"]);
    expect(frames(panopto, false)).toEqual(["'self'", 'https://hvl.cloud.panopto.eu']);
  });

  it('[LTI-003] frame-ancestors is what the caller gives, or none at all', () => {
    const settings = { externalMediaOrigins: [] };
    expect(
      directives(h5pPageCsp(settings, ["'self'", 'https://hvl.instructure.com'])).get('frame-ancestors'),
    ).toEqual(["'self'", 'https://hvl.instructure.com']);
    expect(directives(h5pPageCsp(settings, [])).get('frame-ancestors')).toEqual(["'none'"]);
  });
});
