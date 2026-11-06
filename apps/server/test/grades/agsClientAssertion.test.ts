/**
 * Unit tests for the client assertion D-104's worker signs: RS256 with the tool key, `kid` = the platform ID, and
 * ltijs's claims (`iss` = `sub` = client ID, `aud` = the authorization server or else the token endpoint, a fresh
 * `jti`, 60 seconds of life).
 *
 * Spec: LTI-012
 */
import { generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signClientAssertion } from '../../src/grades/agsClientAssertion.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
const platform = {
  id: '0195f0a0-0000-7000-8000-000000000001',
  clientId: '10000000000001',
  accessTokenEndpoint: 'https://canvas.example/login/oauth2/token',
};

const decode = (part: string | undefined): Record<string, unknown> =>
  JSON.parse(Buffer.from(part ?? '', 'base64url').toString('utf8')) as Record<string, unknown>;

describe('[LTI-012] AGS client assertion', () => {
  it('[LTI-012] signs RS256 with the tool key and the claims ltijs signs', () => {
    // Arrange
    const nowMs = Date.UTC(2026, 9, 30, 10, 0, 0, 500);
    // Act
    const jwt = signClientAssertion(platform, pem, nowMs);
    const [header, claims, signature] = jwt.split('.');
    // Assert
    const signed = Buffer.from(`${header ?? ''}.${claims ?? ''}`);
    expect(verify('sha256', signed, publicKey, Buffer.from(signature ?? '', 'base64url'))).toBe(true);
    expect(decode(header)).toEqual({ alg: 'RS256', typ: 'JWT', kid: platform.id });
    const iat = Math.floor(nowMs / 1000);
    expect(decode(claims)).toEqual({
      iss: platform.clientId,
      sub: platform.clientId,
      aud: platform.accessTokenEndpoint,
      iat,
      exp: iat + 60,
      jti: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });

  it('[LTI-012] names the authorization server as audience when the platform has one, with a new jti each time', () => {
    // Arrange
    const withServer = { ...platform, authorizationServer: 'https://sso.canvaslms.com/login/oauth2/token' };
    // Act
    const first = decode(signClientAssertion(withServer, pem, Date.now()).split('.')[1]);
    const second = decode(signClientAssertion(withServer, pem, Date.now()).split('.')[1]);
    // Assert
    expect(first.aud).toBe(withServer.authorizationServer);
    expect(first.jti).not.toBe(second.jti);
  });

  it('[LTI-012] throws for a key that cannot sign', () => {
    expect(() => signClientAssertion(platform, 'not a key', Date.now())).toThrow();
  });
});
