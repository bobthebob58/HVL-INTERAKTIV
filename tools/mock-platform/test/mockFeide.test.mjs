/**
 * Tests for the mock Feide's OpenID Connect provider: discovery, logins with openid-client 6.8.8 (PKCE, signature
 * checks), Feide's claims narrowed by scope, and the test controls.
 *
 * Spec: AUTH-001, AUTH-004
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as client from 'openid-client';
import { FEIDE_ID_CLAIM, USERID_SEC_CLAIM, startMockFeide } from '../mockPlatform.mjs';
import { FEIDE_SCOPE as SCOPE, REDIRECT_URI, feideRelyingParty } from './feideLoginSteps.mjs';

let feide;
let config;
let authorize;
let redeem;
let login;

beforeAll(async () => {
  feide = await startMockFeide();
  ({ config, authorize, redeem, login } = await feideRelyingParty(feide));
});
afterAll(() => feide.close());

/** Sends a hand-made authorisation request (no PKCE unless given) and returns where it redirects. */
async function authorizeRaw(params = {}) {
  const url = client.buildAuthorizationUrl(config, { redirect_uri: REDIRECT_URI, scope: SCOPE, ...params });
  return new URL((await fetch(url, { redirect: 'manual' })).headers.get('location') ?? '');
}

/** Sends a code grant without a PKCE verifier. */
const redeemRaw = (code) =>
  fetch(config.serverMetadata().token_endpoint, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: feide.clientId,
    }),
  });

describe('[AUTH-001] mock Feide OpenID Connect provider', () => {
  it("[AUTH-001] advertises Feide's endpoints, client authentication, PKCE S256 and RS256", async () => {
    // Act
    const metadata = config.serverMetadata();
    // Assert
    expect(metadata).toMatchObject({
      issuer: feide.issuer,
      authorization_endpoint: `${feide.issuer}/oauth/authorization`,
      token_endpoint: `${feide.issuer}/oauth/token`,
      jwks_uri: `${feide.issuer}/openid/jwks`,
      end_session_endpoint: feide.endSessionUrl,
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
      code_challenge_methods_supported: ['S256'],
      id_token_signing_alg_values_supported: ['RS256'],
    });
    expect(feide.issuer).toMatch(/^http:\/\/localhost:\d+$/);
  });

  it('[AUTH-001] logs in the chosen user with a signed ID token carrying the Feide claims', async () => {
    // Arrange
    feide.nextLogin('student');
    // Act
    const tokens = await login();
    // Assert
    expect(tokens.claims()).toMatchObject({
      iss: feide.issuer,
      aud: feide.clientId,
      sub: feide.users.get('student').sub,
      name: 'Siri Student',
      email: 'student@stud.hvl.no',
      [FEIDE_ID_CLAIM]: 'student@hvl.no',
      [USERID_SEC_CLAIM]: ['feide:student@hvl.no'],
    });
    expect(tokens.claims().sub).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[\da-f]{4}-[\da-f]{12}$/);
    expect(tokens.scope).toBe(SCOPE);
  });

  it('[AUTH-001] logs in the author when nobody was chosen', async () => {
    expect((await login()).claims()[FEIDE_ID_CLAIM]).toBe('author@hvl.no');
  });

  it('[AUTH-001] keeps two concurrent logins apart: each code belongs to the user chosen for its /authorize', async () => {
    // Arrange
    feide.nextLogin('uib-employee');
    const first = await authorize();
    feide.nextLogin('ppu-student');
    const second = await authorize();
    // Act
    const [late, early] = await Promise.all([redeem(second), redeem(first)]);
    // Assert
    expect(early.claims()[FEIDE_ID_CLAIM]).toBe('gjest@uib.no');
    expect(late.claims()[FEIDE_ID_CLAIM]).toBe('ppu.student@hvl.no');
  });

  it('[AUTH-001] redeems a code once, and a code issued for a PKCE challenge only with its verifier', async () => {
    // Arrange
    const [used, fresh] = [await authorize(), await authorize()];
    const exchange = (step, verifier) =>
      fetch(config.serverMetadata().token_endpoint, {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: step.callback.searchParams.get('code'),
          redirect_uri: REDIRECT_URI,
          client_id: feide.clientId,
          ...(verifier && { code_verifier: step.checks.pkceCodeVerifier }),
        }),
      });
    // Act
    const [first, replay, noVerifier] = [
      await exchange(used, true),
      await exchange(used, true),
      await exchange(fresh),
    ];
    // Assert
    expect([first.status, replay.status, noVerifier.status]).toEqual([200, 400, 400]);
    expect(await noVerifier.json()).toMatchObject({ error: 'invalid_grant' });
  });

  it('[AUTH-001] gives a user without a Feide ID no Feide ID claims', async () => {
    feide.nextLogin('no-feide-id');
    const claims = (await login()).claims();
    expect(claims).not.toHaveProperty([FEIDE_ID_CLAIM]);
    expect(claims).not.toHaveProperty([USERID_SEC_CLAIM]);
  });

  it('[AUTH-001] redeems a code issued without PKCE once, and refuses a code it never issued', async () => {
    // Arrange
    const code = (await authorizeRaw()).searchParams.get('code');
    // Act
    const [first, replay, unknown] = [await redeemRaw(code), await redeemRaw(code), await redeemRaw('nope')];
    // Assert
    expect([first.status, replay.status, unknown.status]).toEqual([200, 400, 400]);
    expect(await replay.json()).toMatchObject({ error: 'invalid_grant' });
    expect(await unknown.json()).toMatchObject({ error: 'invalid_grant' });
  });

  it('[AUTH-001] refuses another client ID, and a PKCE challenge that is not S256, at /authorize', async () => {
    // Act
    const results = [
      await authorizeRaw({ client_id: 'other' }),
      await authorizeRaw({ code_challenge: 'a'.repeat(43), code_challenge_method: 'plain' }),
      await authorizeRaw({ code_challenge: 'a'.repeat(43) }),
    ].map((location) => [location.searchParams.get('error'), location.searchParams.has('code')]);
    // Assert
    expect(results).toEqual([
      ['unauthorized_client', false],
      ['invalid_request', false],
      ['invalid_request', false],
    ]);
  });

  it('[AUTH-001] lets a test tamper with, or forge the signature of, the next ID token', async () => {
    // Arrange
    feide.tamperNextIdToken((payload) => (payload.aud = 'another-client'));
    // Act and assert: openid-client rejects the audience, then the signature
    await expect(login()).rejects.toMatchObject({ code: 'OAUTH_JWT_CLAIM_COMPARISON_FAILED' });
    feide.forgeNextIdTokenSignature();
    await expect(login()).rejects.toMatchObject({ cause: { message: 'JWT signature verification failed' } });
    await expect(login()).resolves.toHaveProperty('id_token');
  });

  it('[AUTH-001] selects the next user through the control endpoint, by GET or POST', async () => {
    // Act
    const byGet = await fetch(`${feide.issuer}/__mock/next-login?user=uib-employee`);
    const first = (await login()).claims()[FEIDE_ID_CLAIM];
    const body = new URLSearchParams({ user: 'student' });
    const byPost = await fetch(`${feide.issuer}/__mock/next-login`, { method: 'POST', body });
    const second = (await login()).claims()[FEIDE_ID_CLAIM];
    const unknown = await fetch(`${feide.issuer}/__mock/next-login?user=nobody`);
    // Assert
    expect([byGet.status, byPost.status, unknown.status]).toEqual([200, 200, 404]);
    expect([first, second]).toEqual(['gjest@uib.no', 'student@hvl.no']);
    expect(() => feide.nextLogin('nobody')).toThrow(RangeError);
  });
});

describe('[AUTH-004] mock Feide releases only what the scopes ask for', () => {
  it.each([
    ['openid userid-feide', { name: false, email: false, feideId: true }],
    ['openid profile email', { name: true, email: true, feideId: false }],
    ['openid', { name: true, email: true, feideId: true }],
  ])('[AUTH-004] for scope "%s"', async (scope, released) => {
    const claims = (await login(scope)).claims();
    expect({ name: 'name' in claims, email: 'email' in claims, feideId: FEIDE_ID_CLAIM in claims }).toEqual(
      released,
    );
    expect(Object.keys(claims).some((name) => /nin/.test(name))).toBe(false);
  });
});
