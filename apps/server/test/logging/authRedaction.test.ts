/**
 * Tests that the values Session 3 adds never reach a log: OIDC login values, session and CSRF tokens, our
 * cookies, signed file grants, ciphertext and client addresses.
 *
 * Spec: DATA-009, LTI-003, AUTH-003, H5P-007
 */
import { describe, expect, it } from 'vitest';
import { isSensitiveKey, redactPersonalData } from '../../src/logging/redactPersonalData.js';
import { redactText } from '../../src/logging/redactText.js';

describe('[DATA-009] Session 3 redaction by key', () => {
  it('[DATA-009] redacts OIDC, session, CSRF, grant and address keys in any spelling', () => {
    // Arrange
    const keys = [
      'state',
      'nonce',
      'codeVerifier',
      'code_verifier',
      'sid',
      'sessionId',
      'txId',
      'csrf',
      'csrfToken',
      'grant',
      'lti_message_hint',
      'ip',
      'remoteAddress',
      'X-Forwarded-For',
      'x-real-ip',
      'forwarded',
      'userid_sec',
      'privateKeyEncrypted',
      'idTokenEncrypted',
      'loginNonce',
      'pkceVerifier',
    ];
    // Act and assert
    for (const key of keys) expect(isSensitiveKey(key), key).toBe(true);
    for (const key of ['status', 'contentId', 'deploymentId', 'platformId', 'event', 'reason', 'keyId']) {
      expect(isSensitiveKey(key), key).toBe(false);
    }
  });

  it('[AUTH-003] keeps a session record readable but without its secrets', () => {
    // Act
    const out = redactPersonalData({
      session: { userId: 'u1', csrfToken: 'c1', idTokenEncrypted: Buffer.from('x'), roles: ['author'] },
      req: {
        headers: { cookie: '__Host-hvli_sid=abc', 'x-forwarded-for': '10.0.0.1' },
        remoteAddress: '10.0.0.2',
      },
    });
    // Assert
    expect(out).toEqual({
      session: { userId: 'u1', csrfToken: '[Redacted]', idTokenEncrypted: '[Redacted]', roles: ['author'] },
      req: {
        headers: { cookie: '[Redacted]', 'x-forwarded-for': '[Redacted]' },
        remoteAddress: '[Redacted]',
      },
    });
  });
});

describe('[LTI-003] Session 3 redaction in free text', () => {
  it('[LTI-003] masks login values and the CSRF token in query strings and form bodies', () => {
    expect(redactText('GET /auth/feide/callback?code=abc&state=s1&iss=https://x')).toBe(
      'GET /auth/feide/callback?code=[Redacted]&state=[Redacted]&iss=https://x',
    );
    expect(redactText('/h5p/ajax?action=files&csrf=t0k&nonce=n1&code_verifier=v1')).toBe(
      '/h5p/ajax?action=files&csrf=[Redacted]&nonce=[Redacted]&code_verifier=[Redacted]',
    );
    expect(redactText('POST /lti/login iss=a&login_hint=42&lti_message_hint=eyJx')).toBe(
      'POST /lti/login iss=a&login_hint=[Redacted]&lti_message_hint=[Redacted]',
    );
  });

  it('[AUTH-003] masks our cookies in Cookie and Set-Cookie text', () => {
    expect(redactText('cookie: a=1; __Host-hvli_sid=Zm9vYmFy; hvli_login=tx1')).toBe(
      'cookie: a=1; __Host-hvli_sid=[Redacted]; hvli_login=[Redacted]',
    );
    expect(redactText('set-cookie: __Host-hvli_sid=abc; Path=/; HttpOnly')).toBe(
      'set-cookie: __Host-hvli_sid=[Redacted]; Path=/; HttpOnly',
    );
  });

  it('[H5P-007] masks the grant segment of a signed content-file URL and keeps the rest', () => {
    expect(redactText('GET /h5p/files/k1.1767225600.c2lnbmF0dXJl/0192-abc/images/a.png 403')).toBe(
      'GET /h5p/files/[Redacted]/0192-abc/images/a.png 403',
    );
    expect(redactText('/h5p/content/0192-abc and /h5p/libraries/H5P.Foo')).toBe(
      '/h5p/content/0192-abc and /h5p/libraries/H5P.Foo',
    );
  });

  it('[DATA-009] runs in linear time on long cookie and grant strings', () => {
    // Arrange
    const long = `${'hvli_'.repeat(20_000)} /h5p/files/${'a'.repeat(100_000)}`;
    // Act
    const started = performance.now();
    redactText(long);
    // Assert
    expect(performance.now() - started).toBeLessThan(500);
  });
});
