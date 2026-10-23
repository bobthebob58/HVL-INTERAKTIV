/**
 * Tests for the Feide relying party against oauth2-mock-server: the authorisation request, the code exchange with
 * its checks, client authentication, logout and recovery from a discovery failure.
 *
 * Spec: AUTH-001, AUTH-003, AUTH-004
 */
import { createHash } from 'node:crypto';
import { Events, OAuth2Server } from 'oauth2-mock-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  FEIDE_SCOPE,
  FeideClient,
  type FeideSettings,
  type LoginChecks,
} from '../../../src/auth/feide/FeideClient.js';

const server = new OAuth2Server();
let settings: FeideSettings;
const checks = (): LoginChecks => ({
  state: `state-${Math.random()}`,
  nonce: `nonce-${Math.random()}`,
  codeVerifier: 'v'.repeat(43) + Math.random().toString(36).slice(2),
});

beforeAll(async () => {
  await server.issuer.keys.generate('RS256');
  await server.start(0, '127.0.0.1');
  settings = {
    issuer: String(server.issuer.url),
    clientId: 'hvli-test',
    clientSecret: 'test-only-secret',
    redirectUri: 'http://localhost:3000/auth/feide/callback',
    postLogoutRedirectUri: 'http://localhost:3000/auth/logged-out',
  };
});
afterAll(() => server.stop());

/** Follows the mock's authorisation redirect and returns the callback URL with the code. */
const callbackFor = async (url: URL): Promise<URL> =>
  new URL((await fetch(url, { redirect: 'manual' })).headers.get('location') ?? '');

describe('[AUTH-001] Feide relying party', () => {
  it('[AUTH-004] asks for exactly the agreed scopes with PKCE S256, state and nonce', async () => {
    // Arrange
    const login = checks();
    // Act
    const url = await new FeideClient(settings).authorizationUrl(login);
    // Assert
    const params = url.searchParams;
    expect(params.get('scope')).toBe(FEIDE_SCOPE);
    expect(FEIDE_SCOPE).not.toMatch(/nin/);
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('code_challenge')).toBe(
      createHash('sha256').update(login.codeVerifier).digest('base64url'),
    );
    expect(Object.fromEntries(params)).toMatchObject({
      state: login.state,
      nonce: login.nonce,
      redirect_uri: settings.redirectUri,
      client_id: 'hvli-test',
      response_type: 'code',
    });
  });

  it('[AUTH-001] completes a login, sending the client secret in the form body (client_secret_post)', async () => {
    // Arrange
    const client = new FeideClient(settings);
    const login = checks();
    const seen: { authorization?: string; body?: Record<string, unknown> }[] = [];
    server.service.once(
      Events.BeforeTokenSigning,
      (_token, req: { headers: Record<string, string>; body: Record<string, unknown> }) =>
        seen.push({ authorization: req.headers.authorization, body: req.body }),
    );
    // Act
    const tokens = await client.completeLogin(await callbackFor(await client.authorizationUrl(login)), login);
    // Assert
    expect(tokens.claims).toMatchObject({ nonce: login.nonce, aud: 'hvli-test' });
    expect(tokens.idToken.split('.')).toHaveLength(3);
    expect(tokens.accessToken).toBeTruthy();
    expect(seen[0]?.authorization).toBeUndefined();
    expect(seen[0]?.body).toMatchObject({ client_id: 'hvli-test', client_secret: 'test-only-secret' });
  });

  it('[AUTH-001] refuses a callback whose state or nonce belongs to another login', async () => {
    // Arrange
    const client = new FeideClient(settings);
    const login = checks();
    // Act and assert
    const callback = await callbackFor(await client.authorizationUrl(login));
    await expect(client.completeLogin(callback, { ...login, state: 'other' })).rejects.toThrow();
    const second = checks();
    const callback2 = await callbackFor(await client.authorizationUrl(second));
    await expect(client.completeLogin(callback2, { ...second, nonce: 'other' })).rejects.toThrow();
  });

  it('[AUTH-003] builds the end-session URL with id_token_hint and the registered logout redirect', async () => {
    const url = await new FeideClient(settings).endSessionUrl('id.token.value');
    expect(url.searchParams.get('id_token_hint')).toBe('id.token.value');
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe('http://localhost:3000/auth/logged-out');
  });

  it('[AUTH-001] retries discovery after Feide was unreachable', async () => {
    // Arrange: a second mock that is stopped while the client first tries it.
    const late = new OAuth2Server();
    await late.issuer.keys.generate('RS256');
    await late.start(0, '127.0.0.1');
    const port = new URL(String(late.issuer.url)).port;
    await late.stop();
    const client = new FeideClient({ ...settings, issuer: `http://localhost:${port}` });
    // Act and assert
    await expect(client.authorizationUrl(checks())).rejects.toThrow();
    await late.start(Number(port), '127.0.0.1');
    await expect(client.authorizationUrl(checks())).resolves.toBeInstanceOf(URL);
    await late.stop();
  });
});
