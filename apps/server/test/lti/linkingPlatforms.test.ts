/**
 * Unit tests for which platforms may link Canvas and Feide identities (`feideLinking`, D-063).
 *
 * Spec: AUTH-005
 */
import { describe, expect, it } from 'vitest';
import type { LtiPlatformConfig } from '../../src/config/envParsers.js';
import { platformLinksFeide } from '../../src/lti/linkingPlatforms.js';

const platform = (clientId: string, feideLinking: boolean): LtiPlatformConfig => ({
  name: `Canvas ${clientId}`,
  issuer: 'https://canvas.instructure.com',
  clientId,
  authEndpoint: 'https://sso.canvaslms.com/api/lti/authorize_redirect',
  tokenEndpoint: 'https://sso.canvaslms.com/login/oauth2/token',
  jwksUrl: 'https://sso.canvaslms.com/api/lti/security/jwks',
  deployments: ['1:a'],
  feideLinking,
});

describe('[AUTH-005] platforms that may link identities', () => {
  const links = platformLinksFeide([platform('100', true), platform('200', false)]);

  it('[AUTH-005] links for the configured issuer and client with `feideLinking: true`', () => {
    expect(links('https://canvas.instructure.com', '100')).toBe(true);
  });

  it.each([
    ['a platform with `feideLinking: false`', 'https://canvas.instructure.com', '200'],
    ['another client ID of the same issuer', 'https://canvas.instructure.com', '300'],
    ['an issuer that differs only in case', 'https://Canvas.instructure.com', '100'],
    ['an unknown issuer', 'https://canvas.example', '100'],
  ])('[AUTH-005] never links for %s', (_case, issuer, clientId) => {
    expect(links(issuer, clientId)).toBe(false);
  });

  it('[AUTH-005] links nothing when no platform is configured', () => {
    expect(platformLinksFeide([])('https://canvas.instructure.com', '100')).toBe(false);
  });
});
