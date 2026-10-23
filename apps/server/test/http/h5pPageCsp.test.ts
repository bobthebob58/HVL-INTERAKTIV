/**
 * Tests for the Content Security Policy of the H5P pages: no inline or eval scripts, first-party sources, outside
 * media only from configured origins, and the framing the caller asks for.
 *
 * Spec: DATA-011, H5P-009, LTI-003
 */
import { describe, expect, it } from 'vitest';
import { h5pPageCsp } from '../../src/http/h5pPageCsp.js';

const directives = (csp: string) =>
  new Map(csp.split('; ').map((d) => [d.split(' ')[0] ?? '', d.split(' ').slice(1)] as const));

describe('[DATA-011] H5P page policy', () => {
  it('[DATA-011] allows our own scripts and the core hashes, never inline or eval, and nothing third-party', () => {
    // Act
    const csp = directives(
      h5pPageCsp({ scriptHashes: ["'sha256-abc'"], externalMediaOrigins: [] }, ["'self'"]),
    );
    // Assert
    expect(csp.get('default-src')).toEqual(["'none'"]);
    expect(csp.get('script-src')).toEqual(["'self'", "'sha256-abc'"]);
    expect(csp.get('img-src')).toEqual(["'self'", 'data:', 'blob:']);
    expect(csp.get('media-src')).toEqual(["'self'", 'blob:']);
    expect(csp.get('connect-src')).toEqual(["'self'"]);
    expect(csp.get('frame-src')).toEqual(["'self'"]);
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('base-uri')).toEqual(["'none'"]);
    expect([...csp.values()].flat()).not.toContain("'unsafe-eval'");
    expect(csp.get('script-src')).not.toContain("'unsafe-inline'");
  });

  it('[DATA-011] configured media origins are allowed for images, media and frames only', () => {
    const csp = directives(
      h5pPageCsp({ scriptHashes: [], externalMediaOrigins: ['https://hvl.cloud.panopto.eu'] }, ["'self'"]),
    );
    for (const name of ['img-src', 'media-src', 'frame-src'])
      expect(csp.get(name)).toContain('https://hvl.cloud.panopto.eu');
    for (const name of ['script-src', 'connect-src', 'style-src']) {
      expect(csp.get(name)).not.toContain('https://hvl.cloud.panopto.eu');
    }
  });

  it('[LTI-003] frame-ancestors is what the caller gives, or none at all', () => {
    const settings = { scriptHashes: [], externalMediaOrigins: [] };
    expect(
      directives(h5pPageCsp(settings, ["'self'", 'https://hvl.instructure.com'])).get('frame-ancestors'),
    ).toEqual(["'self'", 'https://hvl.instructure.com']);
    expect(directives(h5pPageCsp(settings, [])).get('frame-ancestors')).toEqual(["'none'"]);
  });
});
