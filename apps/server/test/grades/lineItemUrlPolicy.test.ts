/**
 * Unit tests for the line item URL rule (D-104's amendment of 2026-11-04, the step-3 security review): only an origin
 * in `CANVAS_ORIGINS` or one of the platform's own configured URLs may receive scores, never with credentials in the
 * URL, and only over https where https is required.
 *
 * Spec: LTI-012
 */
import { describe, expect, it } from 'vitest';
import { lineItemUrlRefusal, platformOrigins, webOriginOf } from '../../src/grades/lineItemUrlPolicy.js';

const PLATFORM = {
  url: 'https://canvas.instructure.com',
  authenticationEndpoint: 'https://sso.canvaslms.com/api/lti/authorize_redirect',
  accessTokenEndpoint: 'https://sso.canvaslms.com/login/oauth2/token',
};
const RULES = { origins: ['https://hvl.instructure.com'], requireHttps: true };

describe('[LTI-012] which line item URLs may receive scores', () => {
  it('[LTI-012] takes the platform’s own origins from its issuer and endpoints, once each', () => {
    // Act
    const origins = platformOrigins({ ...PLATFORM, accessTokenEndpoint: 'not a url' });
    // Assert
    expect(origins).toEqual(['https://canvas.instructure.com', 'https://sso.canvaslms.com']);
  });

  it.each([
    [
      'the institution’s Canvas, with a query',
      'https://hvl.instructure.com/api/lti/courses/1/line_items/2?x=1',
    ],
    [
      'the institution’s Canvas with its default port',
      'https://hvl.instructure.com:443/api/lti/line_items/2',
    ],
    ['the issuer’s host (a self-hosted Canvas)', 'https://canvas.instructure.com/api/lti/line_items/2'],
    ['a host in capitals', 'https://HVL.instructure.com/api/lti/line_items/2'],
  ])('[LTI-012] allows %s', (_name, url) => {
    expect(lineItemUrlRefusal(url, PLATFORM, RULES)).toBeUndefined();
  });

  it.each([
    ['another host', 'https://evil.example/api/lti/line_items/2', 'origin'],
    ['a sibling of the Canvas host', 'https://hvl.instructure.com.evil.example/li', 'origin'],
    ['another port of the Canvas host', 'https://hvl.instructure.com:8443/li', 'origin'],
    ['a private address', 'https://10.0.0.5/li', 'origin'],
    ['a user name that hides the host', 'https://hvl.instructure.com@evil.example/li', 'credentials'],
    ['a user name before the Canvas host', 'https://user:pw@hvl.instructure.com/li', 'credentials'],
    ['plain http to Canvas', 'http://hvl.instructure.com/li', 'scheme'],
    ['a file URL', 'file:///etc/passwd', 'invalid'],
    ['no URL', 'line item 2', 'invalid'],
  ])('[LTI-012] refuses %s', (_name, url, reason) => {
    expect(lineItemUrlRefusal(url, PLATFORM, RULES)).toBe(reason);
  });

  it('[LTI-012] without rules allows the platform’s own origins over any web scheme, and nothing else', () => {
    // Arrange: the mock Canvas of the tests, on http, issuer and AGS on one origin
    const mock = {
      url: 'http://127.0.0.1:4100',
      authenticationEndpoint: 'http://127.0.0.1:4100/api/lti/authorize_redirect',
      accessTokenEndpoint: 'http://127.0.0.1:4100/login/oauth2/token',
    };
    // Act and assert
    expect(lineItemUrlRefusal('http://127.0.0.1:4100/api/lti/courses/1/line_items/1', mock)).toBeUndefined();
    expect(lineItemUrlRefusal('https://hvl.instructure.com/li', mock)).toBe('origin');
  });

  it('[LTI-012] reads the origin of a web URL only', () => {
    expect(webOriginOf('https://hvl.instructure.com/a?b')).toBe('https://hvl.instructure.com');
    expect(webOriginOf('javascript:alert(1)')).toBeUndefined();
    expect(webOriginOf('')).toBeUndefined();
  });
});
