/**
 * canvasClientAssertion — verifies the JWT client assertion a tool sends to the mock Canvas's token endpoint
 * (client credentials with a `jwt-bearer` client assertion, RFC 7523 §2.2) and lists every problem Canvas would
 * refuse it for.
 *
 * Why: D-104's grade worker signs its own assertion with the tool key ltijs stores, and ltijs signs one for NRPS
 *      (LTI-008). Both must meet a platform that checks what Canvas checks, against the tool's key set at
 *      `<toolUrl>/lti/keys` (the developer key's `public_jwk_url`, canvas-platform-values.md §1.1).
 * Spec: LTI-008, LTI-012
 * Invariants:
 *   - Only RS256, a `kid` in the tool's key set and a valid signature pass (./toolSignature.mjs).
 *   - As Canvas's validator (C:`lib/canvas/security/jwt_validator.rb:24,36,55-82`, used by
 *     C:`lib/canvas/oauth/asymmetric_client_credentials_provider.rb:24,60-67`): `sub` is the client ID; `aud` (a
 *     string or an array) must contain the token endpoint URL or the platform's host, as Canvas accepts its token
 *     URL on the request host or its OIDC auth domain (canvas-platform-values.md §2, item 3); `exp` is not in the
 *     past; `iat` is at most 30 s ahead and at most 5 minutes old; `jti` is present.
 *   - Stricter than Canvas, on purpose: `iss` must be the client ID (Canvas only requires an `iss`), and a `jti` is
 *     accepted once (Canvas skips that check for client credentials, `skip_jti_check: true`). Only an assertion
 *     whose signature verified uses its `jti` up, so a forged copy cannot make the genuine one look replayed; used
 *     `jti`s are forgotten once their assertion has expired.
 *   - Every check runs even after another fails, so `problems` lists all of them; an empty list means accepted.
 * Collaborators: ./canvasTokenEndpoint.mjs, ./toolSignature.mjs, jose.
 * Tests: tools/mock-platform/test/canvasTokenEndpoint.test.mjs
 */
import { decodeJwt, decodeProtectedHeader } from 'jose';
import { toolKeySet, toolSignatureProblem } from './toolSignature.mjs';

const IAT_FUTURE_SECONDS = 30;
const MAX_ASSERTION_AGE_SECONDS = 300;

/**
 * Creates the client-assertion verifier of one mock Canvas.
 * @param {{clientId: string, toolUrl: string, tokenEndpoint: string}} platform - The mock Canvas.
 * @returns {(jwt: string) => Promise<{ok: boolean, problems: string[], header: object, claims: object}>} The
 *   verifier; problem codes are listed in `ClientAssertionProblem` (./canvasServiceTypes.d.mts).
 */
export function createAssertionVerifier(platform) {
  const keySet = toolKeySet(platform.toolUrl);
  const audiences = [platform.tokenEndpoint, new URL(platform.tokenEndpoint).host];
  const usedJtis = new Map();

  return async function verifyAssertion(jwt) {
    const problems = [];
    let header = {};
    let claims = {};
    try {
      header = decodeProtectedHeader(jwt);
      claims = decodeJwt(jwt);
    } catch {
      return { ok: false, problems: ['invalid-jwt'], header, claims };
    }
    const signatureProblem = await toolSignatureProblem(jwt, header, keySet);
    if (signatureProblem !== undefined) problems.push(signatureProblem);
    checkClaims(claims, problems);
    const now = Math.floor(Date.now() / 1000);
    for (const [jti, expiresAt] of usedJtis) if (expiresAt < now) usedJtis.delete(jti);
    if (typeof claims.jti !== 'string' || claims.jti === '') problems.push('missing-jti');
    else if (usedJtis.has(claims.jti)) problems.push('reused-jti');
    else if (signatureProblem === undefined) usedJtis.set(claims.jti, Number(claims.exp) || now);
    return { ok: problems.length === 0, problems, header, claims };
  };

  function checkClaims(claims, problems) {
    const now = Math.floor(Date.now() / 1000);
    const check = (ok, code) => void (ok || problems.push(code));
    const audience = [claims.aud].flat();
    check(claims.iss === platform.clientId, 'wrong-iss');
    check(claims.sub === platform.clientId, 'wrong-sub');
    check(
      audience.some((aud) => audiences.includes(aud)),
      'wrong-aud',
    );
    check(
      typeof claims.iat === 'number' &&
        claims.iat <= now + IAT_FUTURE_SECONDS &&
        claims.iat >= now - MAX_ASSERTION_AGE_SECONDS,
      'bad-iat',
    );
    check(typeof claims.exp === 'number' && claims.exp >= now, 'expired');
  }
}
