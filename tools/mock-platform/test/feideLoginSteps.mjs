/**
 * feideLoginSteps — the relying-party side of a login at the mock Feide, for its tests: discovery, the authorisation
 * request with PKCE S256, state and nonce, and the code grant, all with openid-client 6.8.8.
 *
 * Why: the mock Feide is only useful if a real relying-party library accepts it (AUTH-001). Both Feide test files
 *      drive it as the server's Feide client will (D-054).
 * Spec: AUTH-001
 * Invariants: discovery allows plain http (the mock only) and turns on `enableNonRepudiationChecks`, as the server does.
 * Collaborators: ./mockFeide.test.mjs, ./mockFeideServices.test.mjs, openid-client.
 * Tests: tools/mock-platform/test/mockFeide.test.mjs
 */
import * as client from 'openid-client';

/** The scopes of AUTH-001. */
export const FEIDE_SCOPE = 'openid profile email userid-feide groups-org groups-edu';
/** A callback URL; the mock does not check redirect URIs. */
export const REDIRECT_URI = 'http://localhost:3999/auth/feide/callback';

/**
 * Discovers a mock Feide and returns the login steps against it.
 * @param {{issuer: string, clientId: string, clientSecret: string}} feide - A running mock Feide.
 * @returns {Promise<{config: object, authorize: Function, redeem: Function, login: Function}>} `authorize(scope?)`
 *   returns `{callback, checks}`; `redeem(step)` runs the code grant; `login(scope?)` does both.
 */
export async function feideRelyingParty(feide) {
  const execute = [client.allowInsecureRequests, client.enableNonRepudiationChecks];
  const config = await client.discovery(
    new URL(feide.issuer),
    feide.clientId,
    feide.clientSecret,
    undefined,
    {
      execute,
    },
  );
  const authorize = async (scope = FEIDE_SCOPE) => {
    const checks = { pkceCodeVerifier: client.randomPKCECodeVerifier(), state: client.randomState() };
    Object.assign(checks, { nonce: client.randomNonce() });
    const url = client.buildAuthorizationUrl(config, {
      redirect_uri: REDIRECT_URI,
      scope,
      state: checks.state,
      nonce: checks.nonce,
      code_challenge: await client.calculatePKCECodeChallenge(checks.pkceCodeVerifier),
      code_challenge_method: 'S256',
    });
    const response = await fetch(url, { redirect: 'manual' });
    return { callback: new URL(response.headers.get('location') ?? ''), checks };
  };
  const redeem = ({ callback, checks }) =>
    client.authorizationCodeGrant(config, callback, {
      pkceCodeVerifier: checks.pkceCodeVerifier,
      expectedState: checks.state,
      expectedNonce: checks.nonce,
      idTokenExpected: true,
    });
  return { config, authorize, redeem, login: async (scope) => redeem(await authorize(scope)) };
}
