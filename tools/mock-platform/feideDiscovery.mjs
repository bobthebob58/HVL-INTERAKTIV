/**
 * feideDiscovery — the mock Feide's endpoint paths and its OpenID Connect discovery document.
 *
 * Why: the tool discovers Feide (AUTH-001); the mock must advertise what Feide advertises
 *      (docs/reference/feide-oidc-config.example.json): Feide's paths, client_secret_basic/post, `code` with PKCE
 *      S256 only and RS256 ID tokens, instead of oauth2-mock-server's permissive defaults.
 * Spec: AUTH-001
 * Invariants: every endpoint in the document is served by ./mockFeide.mjs under the same issuer.
 * Collaborators: ./mockFeide.mjs, ./feideUsers.mjs.
 * Tests: tools/mock-platform/test/mockFeide.test.mjs
 */
import { FEIDE_ID_CLAIM, USERID_SEC_CLAIM } from './feideUsers.mjs';

/** Feide's endpoint paths (docs/reference/feide-values.md), served under the mock issuer. */
export const FEIDE_ENDPOINTS = Object.freeze({
  authorize: '/oauth/authorization',
  token: '/oauth/token',
  userinfo: '/openid/userinfo',
  jwks: '/openid/jwks',
  endSession: '/openid/endsession',
});
/**
 * Feide's discovery document for the mock issuer.
 * @param {string} issuer - e.g. `http://localhost:4200`.
 * @returns {object} The `/.well-known/openid-configuration` body.
 */
export const discoveryDocument = (issuer) => ({
  issuer,
  authorization_endpoint: `${issuer}${FEIDE_ENDPOINTS.authorize}`,
  token_endpoint: `${issuer}${FEIDE_ENDPOINTS.token}`,
  userinfo_endpoint: `${issuer}${FEIDE_ENDPOINTS.userinfo}`,
  jwks_uri: `${issuer}${FEIDE_ENDPOINTS.jwks}`,
  end_session_endpoint: `${issuer}${FEIDE_ENDPOINTS.endSession}`,
  token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
  response_types_supported: ['code'],
  subject_types_supported: ['public'],
  id_token_signing_alg_values_supported: ['RS256'],
  code_challenge_methods_supported: ['S256'],
  scopes_supported: ['openid', 'profile', 'email'],
  claims_supported: ['sub', 'name', 'email', FEIDE_ID_CLAIM, USERID_SEC_CLAIM],
});
