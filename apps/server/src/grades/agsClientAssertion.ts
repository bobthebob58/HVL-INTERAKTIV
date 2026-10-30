/**
 * agsClientAssertion — the signed JWT with which the grade worker asks a platform for a client-credentials token.
 *
 * Why: LTI 1.3 services take a token from the platform's token endpoint, requested with a JWT client assertion that
 *      the tool signs with its private key (RFC 7523). ltijs signs one only inside a live launch, so D-104's worker
 *      signs its own with the same key and claims ltijs's `AccessTokenManager` uses, with `node:crypto` alone (probe
 *      P2: no new runtime dependency).
 * Spec: LTI-012
 * Invariants:
 *   - RS256 with the tool's private key for that platform; `kid` is the platform ID, which `/lti/keys` publishes.
 *   - Claims as ltijs signs them: `iss` = `sub` = the client ID; `aud` = the platform's authorization server, which
 *     is its token endpoint while `authorizationServer` stays unset (canvas-platform-values.md §2); a fresh `jti`;
 *     a 60-second lifetime from `iat`.
 *   - SECURITY: the private key and the signed assertion are never logged or stored; the assertion lives for one
 *     token request and its `jti` is single-use at the platform.
 * Collaborators: ./AgsAccessTokens.ts, ../lti/storage/PrismaLtiDatabaseManager.ts (decrypts the key, D-056).
 * Tests: apps/server/test/grades/agsClientAssertion.test.ts
 */
import { createPrivateKey, randomUUID, sign } from 'node:crypto';

/** The platform facts an assertion names; ltijs's `Platform` has them. */
export interface AssertionPlatform {
  /** `LtiPlatform.id`, the `kid` of the tool key published at `/lti/keys`. */
  readonly id: string;
  readonly clientId: string;
  readonly accessTokenEndpoint: string;
  /** The audience the platform expects; ltijs sets it to the token endpoint when the platform names none. */
  readonly authorizationServer?: string | undefined;
}

/** How long an assertion is valid, as ltijs signs it. */
export const ASSERTION_LIFETIME_SECONDS = 60;

const base64url = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');

/**
 * Signs a client assertion for one token request.
 * @param platform - The platform the token is for.
 * @param privateKeyPem - The tool's private key for that platform (PEM), as ltijs's `getPrivateKey` returns it.
 * @param nowMs - The wall-clock time in milliseconds; the platform checks `iat` and `exp` against its own clock.
 * @returns The compact JWT.
 * @throws Error from `node:crypto` when the key cannot be read (a configuration fault, never retried).
 * @spec LTI-012
 */
export function signClientAssertion(
  platform: AssertionPlatform,
  privateKeyPem: string,
  nowMs: number,
): string {
  const iat = Math.floor(nowMs / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: platform.id };
  const claims = {
    iss: platform.clientId,
    sub: platform.clientId,
    aud: platform.authorizationServer || platform.accessTokenEndpoint,
    iat,
    exp: iat + ASSERTION_LIFETIME_SECONDS,
    jti: randomUUID(),
  };
  const input = `${base64url(header)}.${base64url(claims)}`;
  const signature = sign('sha256', Buffer.from(input), createPrivateKey(privateKeyPem));
  return `${input}.${signature.toString('base64url')}`;
}
