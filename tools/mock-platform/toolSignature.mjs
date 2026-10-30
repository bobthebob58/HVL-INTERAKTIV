/**
 * toolSignature — checks the RS256 signature of a JWT the tool signed, against the tool's key set at
 * `<toolUrl>/lti/keys`, for the mock Canvas's Deep Linking return and its token endpoint.
 *
 * Why: Canvas verifies both a Deep Linking response (LTI-005) and the client assertion of a token request
 *      (LTI-008, LTI-012, D-104) with the developer key's `public_jwk_url`, the tool's `/lti/keys`
 *      (docs/reference/canvas-platform-values.md §1.1). One check keeps the two verifiers' answers the same.
 * Spec: LTI-005, LTI-008, LTI-012
 * Invariants:
 *   - Only RS256 passes; a `kid` that is absent or not in the tool's key set is `unknown-kid`.
 *   - The key set is fetched for every check (no cache, no cooldown), so a tool that restarts with new keys is
 *     never judged by stale ones; a key set that cannot be fetched is `jwks-unavailable`.
 * Collaborators: ./deepLinkReturn.mjs, ./canvasClientAssertion.mjs, jose.
 * Tests: tools/mock-platform/test/deepLinkReturn.test.mjs, tools/mock-platform/test/canvasTokenEndpoint.test.mjs
 */
import { compactVerify, createRemoteJWKSet } from 'jose';

const SIGNATURE_PROBLEM = {
  ERR_JWKS_NO_MATCHING_KEY: 'unknown-kid',
  ERR_JWS_SIGNATURE_VERIFICATION_FAILED: 'bad-signature',
  ERR_JOSE_ALG_NOT_ALLOWED: 'wrong-alg',
};

/**
 * The tool's remote key set.
 * @param {string} toolUrl - The tool's base URL; its keys are at `<toolUrl>/lti/keys`.
 * @returns {ReturnType<typeof createRemoteJWKSet>} A key set that fetches on every use.
 */
export const toolKeySet = (toolUrl) =>
  // WHY: a test may restart the tool with new keys; jose's cache would hide them for its 30-second cooldown.
  createRemoteJWKSet(new URL(`${toolUrl}/lti/keys`), { cacheMaxAge: 0, cooldownDuration: 0 });

/**
 * Checks a JWT's signature against the tool's key set.
 * @param {string} jwt - The compact JWT.
 * @param {{alg?: unknown, kid?: unknown}} header - Its decoded protected header.
 * @param {ReturnType<typeof toolKeySet>} keySet - From `toolKeySet`.
 * @returns {Promise<string | undefined>} A problem code (`wrong-alg`, `unknown-kid`, `bad-signature`,
 *   `jwks-unavailable`), or undefined when the signature verified.
 */
export async function toolSignatureProblem(jwt, header, keySet) {
  if (header.alg !== 'RS256') return 'wrong-alg';
  if (typeof header.kid !== 'string' || header.kid === '') return 'unknown-kid';
  try {
    await compactVerify(jwt, keySet, { algorithms: ['RS256'] });
    return undefined;
  } catch (error) {
    return SIGNATURE_PROBLEM[error?.code] ?? 'jwks-unavailable';
  }
}
