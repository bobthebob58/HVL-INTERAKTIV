/**
 * Pins openid-client 6.8.8 against oauth2-mock-server 9.2.0: our planned Feide relying-party flow over plain http.
 *
 * Spec: AUTH-001
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { Events, OAuth2Server, type Header, type MutableResponse, type Payload } from 'oauth2-mock-server';
import * as client from 'openid-client';

const SCOPE = 'openid profile email userid-feide groups-org groups-edu';
const FEIDE_ID_CLAIM = 'https://n.feide.no/claims/eduPersonPrincipalName';
const REDIRECT_URI = 'http://127.0.0.1:1/auth/feide/callback';
const FOREIGN_KEY = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;

const server = new OAuth2Server();
let issuer: URL;
let kid: string;

beforeAll(async () => {
  kid = (await server.issuer.keys.generate('RS256')).kid;
  await server.start(0, '127.0.0.1');
  // WHY: the mock names its issuer http://localhost:<port> although it listens on 127.0.0.1.
  issuer = new URL(String(server.issuer.url));
});
// WHY: the mock service registers no listeners of its own, so each test starts with an unmodified provider.
afterEach(() => void server.service.removeAllListeners());
afterAll(() => server.stop());

/** Discovers the mock like our Feide client will (D-054), with plain http allowed for the test only. */
function discover(nonRepudiation = true): Promise<client.Configuration> {
  const execute = [client.allowInsecureRequests];
  if (nonRepudiation) execute.push(client.enableNonRepudiationChecks);
  return client.discovery(issuer, 'client', 'secret', undefined, { execute });
}

/** Edits the ID token before the mock signs it; the access token is signed first and has a `scope` claim. */
function onIdToken(edit: (payload: Payload, header: Header) => void): void {
  server.service.on(Events.BeforeTokenSigning, (token: { header: Header; payload: Payload }) => {
    if (!('scope' in token.payload)) edit(token.payload, token.header);
  });
}

/** Re-signs the ID token with a key outside the JWKS under the mock's own kid, so only the signature is wrong. */
function forgeIdToken(response: MutableResponse): void {
  // WHY: the mock sends the body right after this synchronous event, so the token is re-signed synchronously.
  if (response.body === '' || typeof response.body.id_token !== 'string') return;
  const header = Buffer.from(JSON.stringify({ typ: 'JWT', kid, alg: 'RS256' })).toString('base64url');
  const input = `${header}.${response.body.id_token.split('.')[1]}`;
  response.body.id_token = `${input}.${sign('sha256', Buffer.from(input), FOREIGN_KEY).toString('base64url')}`;
}

/** Runs one login: authorization URL with PKCE S256, state and nonce, the mock's redirect, the code grant. */
async function login(config: client.Configuration, checks: client.AuthorizationCodeGrantChecks = {}) {
  const pkceCodeVerifier = client.randomPKCECodeVerifier();
  const state = client.randomState();
  const nonce = client.randomNonce();
  const authorizationUrl = client.buildAuthorizationUrl(config, {
    redirect_uri: REDIRECT_URI,
    scope: SCOPE,
    state,
    nonce,
    code_challenge: await client.calculatePKCECodeChallenge(pkceCodeVerifier),
    code_challenge_method: 'S256',
  });
  const redirect = await fetch(authorizationUrl, { redirect: 'manual' });
  const callbackUrl = new URL(redirect.headers.get('location') ?? '');
  const expected = { pkceCodeVerifier, expectedState: state, expectedNonce: nonce, idTokenExpected: true };
  const tokens = await client.authorizationCodeGrant(config, callbackUrl, { ...expected, ...checks });
  return { tokens, nonce, authorizationUrl, redirectStatus: redirect.status };
}

const nowInSeconds = (): number => Math.floor(Date.now() / 1000);
const setClaim = (name: string, value: unknown) => (payload: Payload) => void (payload[name] = value);
const CLAIM = 'OAUTH_JWT_CLAIM_COMPARISON_FAILED';
const EXPIRED = 'OAUTH_JWT_TIMESTAMP_CHECK_FAILED';
const INVALID = 'OAUTH_INVALID_RESPONSE';

type Rejection = { label: string; code: string; cause: string; edit?: (payload: Payload) => void };
const REJECTIONS: Array<Rejection & { checks?: client.AuthorizationCodeGrantChecks }> = [
  { label: 'another aud', edit: setClaim('aud', 'another-client'), code: CLAIM, cause: '"aud" (audience)' },
  { label: 'another iss', edit: setClaim('iss', 'http://evil.test'), code: CLAIM, cause: '"iss" (issuer)' },
  { label: 'an exp 120 s ago', edit: setClaim('exp', nowInSeconds() - 120), code: EXPIRED, cause: 'is past' },
  {
    label: 'an unexpected nonce',
    checks: { expectedNonce: 'other' },
    code: CLAIM,
    cause: 'ID Token "nonce"',
  },
  {
    label: 'an unexpected state',
    checks: { expectedState: 'other' },
    code: INVALID,
    cause: '"state" response',
  },
];

describe('[AUTH-001] upstream: openid-client 6.8.8 with oauth2-mock-server 9.2.0', () => {
  it('[AUTH-001] completes code + PKCE S256 login with state, nonce and a signature-checked ID token', async () => {
    // Arrange
    const config = await discover();
    const tokenRequests: Record<string, unknown>[] = [];
    server.service.on(Events.BeforeTokenSigning, (_token, request: { body: Record<string, unknown> }) =>
      tokenRequests.push(request.body),
    );
    // Act
    const { tokens, nonce, authorizationUrl, redirectStatus } = await login(config);
    // Assert
    expect(redirectStatus).toBe(302);
    expect(Object.fromEntries(authorizationUrl.searchParams)).toMatchObject({
      response_type: 'code',
      client_id: 'client',
      scope: SCOPE,
      code_challenge_method: 'S256',
    });
    expect(tokens.claims()).toMatchObject({ iss: issuer.origin, aud: 'client', nonce });
    // WHY: with a secret and no ClientAuth, openid-client uses client_secret_post (the mock ignores the secret).
    expect(tokenRequests[0]).toMatchObject({ client_id: 'client', client_secret: 'secret' });
    expect(tokenRequests[0]?.code_verifier).toMatch(/^[\w-]{43}$/);
  });

  it('[AUTH-001] passes the Feide ID claim and the Feide sub through to claims()', async () => {
    // Arrange
    const sub = '76a7a061-3c55-430d-8ee0-6f82ec42501f';
    onIdToken((payload) => Object.assign(payload, { sub, [FEIDE_ID_CLAIM]: 'kari.test@hvl.no' }));
    // Act
    const { tokens } = await login(await discover());
    // Assert
    expect(tokens.claims()).toMatchObject({ sub, [FEIDE_ID_CLAIM]: 'kari.test@hvl.no' });
  });

  it.each(REJECTIONS)('[AUTH-001] rejects a login with $label', async ({ edit, checks, code, cause }) => {
    if (edit) onIdToken(edit);
    await expect(login(await discover(), checks)).rejects.toMatchObject({
      name: 'ClientError',
      code,
      cause: { name: 'OperationProcessingError', code, message: expect.stringContaining(cause) },
    });
  });

  it('[AUTH-001] tolerates an exp up to 30 s in the past (default clockTolerance)', async () => {
    onIdToken((payload) => (payload.exp = nowInSeconds() - 20));
    await expect(login(await discover())).resolves.toHaveProperty('tokens.id_token');
  });

  it('upstream pin: accepts an ID token signed with a key outside the JWKS when non-repudiation is off', async () => {
    // UPSTREAM: https://github.com/panva/openid-client/blob/v6.8.8/src/index.ts relies on TLS for the token
    // response and checks no ID-token signature by default. D-054 turns on enableNonRepudiationChecks. When this
    // fails after an upgrade, openid-client verifies signatures by default and our explicit call stays harmless.
    server.service.on(Events.BeforeResponse, forgeIdToken);
    await expect(login(await discover(false))).resolves.toHaveProperty('tokens.id_token');
  });

  it('[AUTH-001] rejects a forged signature or an unknown kid once enableNonRepudiationChecks is on', async () => {
    // Arrange
    const config = await discover();
    server.service.on(Events.BeforeResponse, forgeIdToken);
    // Act and assert: the mock's kid with a foreign signature
    await expect(login(config)).rejects.toMatchObject({
      code: 'OAUTH_INVALID_RESPONSE',
      cause: { message: 'JWT signature verification failed' },
    });
    // Act and assert: a kid the mock JWKS does not hold
    server.service.removeAllListeners();
    onIdToken((_payload, header) => (header.kid = 'not-in-the-jwks'));
    await expect(login(config)).rejects.toMatchObject({ code: 'OAUTH_KEY_SELECTION_FAILED' });
  });

  it('[AUTH-001] builds an end-session URL with id_token_hint that the mock redirects back from', async () => {
    // Arrange
    const config = await discover();
    const { tokens } = await login(config);
    const postLogout = 'http://127.0.0.1:1/auth/logged-out';
    // Act
    const url = client.buildEndSessionUrl(config, {
      id_token_hint: tokens.id_token ?? '',
      post_logout_redirect_uri: postLogout,
    });
    const response = await fetch(url, { redirect: 'manual' });
    // Assert
    expect(`${url.origin}${url.pathname}`).toBe(`${issuer.origin}/endsession`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      id_token_hint: tokens.id_token,
      post_logout_redirect_uri: postLogout,
      client_id: 'client',
    });
    expect([response.status, response.headers.get('location')]).toEqual([302, postLogout]);
  });
});
