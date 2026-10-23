/**
 * Tests for the mock Canvas's OIDC authentication endpoint: Canvas's checks, single-use expiring logins and the
 * form_post answer.
 *
 * Spec: LTI-001
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { decodeJwt } from 'jose';
import { CANVAS_USERS, LAUNCH_GONE, LTI_CLAIM, startMockCanvas } from '../mockPlatform.mjs';

const TOOL = 'http://localhost:3999';
let canvas;

beforeAll(async () => {
  canvas = await startMockCanvas({ toolUrl: TOOL });
});
afterAll(() => canvas.close());
afterEach(() => vi.useRealTimers());

/** A login initiation followed by the authentication request ltijs 7.0.7 sends for it. */
function authRequest(spec = { user: CANVAS_USERS.student, custom: { contentId: 'c-1' } }) {
  const login = canvas.loginInitiation(spec);
  return {
    response_type: 'id_token',
    response_mode: 'form_post',
    id_token_signed_response_alg: 'RS256',
    scope: 'openid',
    client_id: login.client_id,
    redirect_uri: login.target_link_uri,
    login_hint: login.login_hint,
    nonce: 'nonce-1',
    prompt: 'none',
    state: 'state-1',
    lti_message_hint: login.lti_message_hint,
    lti_deployment_id: login.lti_deployment_id,
  };
}

const without = (name) => (params) => void delete params[name];
const set = (name, value) => (params) => void (params[name] = value);
const REFUSALS = [
  ['no nonce', without('nonce'), 'invalid_request_object', 'The following parameters are missing: nonce'],
  ['no state', without('state'), 'invalid_request_object', 'The following parameters are missing: state'],
  ['no lti_message_hint', without('lti_message_hint'), 'invalid_request_object', 'missing: lti_message_hint'],
  ['another client_id', set('client_id', '999'), 'unauthorized_client', 'Client not authorized'],
  [
    'another redirect_uri',
    set('redirect_uri', `${TOOL}/other`),
    'invalid_request_object',
    'Invalid redirect_uri',
  ],
  ['response_type code', set('response_type', 'code'), 'unsupported_response_type', 'id_token'],
  ['response_mode query', set('response_mode', 'query'), 'invalid_request_object', 'form_post'],
  ['scope openid profile', set('scope', 'openid profile'), 'invalid_scope', 'openid'],
  ['prompt login', set('prompt', 'login'), 'invalid_request_object', 'prompt must be none'],
  ['an HS256 ID token', set('id_token_signed_response_alg', 'HS256'), 'invalid_request_object', 'RS256'],
  ['an unknown lti_message_hint', set('lti_message_hint', 'nope'), 'launch_no_longer_valid', LAUNCH_GONE],
  ['another login_hint', set('login_hint', 'someone-else'), 'login_required', 'not logged in'],
  ['another deployment', set('lti_deployment_id', '2:other'), 'invalid_request_object', 'lti_deployment_id'],
];

describe('[LTI-001] mock Canvas authentication requests', () => {
  it('[LTI-001] answers a valid request with an ID token for the pending launch, posted to the redirect URI', async () => {
    // Act
    const result = await canvas.authorize(authRequest());
    // Assert
    expect(result).toEqual({ action: `${TOOL}/lti/launch`, idToken: expect.any(String), state: 'state-1' });
    expect(decodeJwt(result.idToken)).toMatchObject({
      nonce: 'nonce-1',
      sub: CANVAS_USERS.student.sub,
      [LTI_CLAIM.custom]: { contentId: 'c-1' },
    });
  });

  it('[LTI-001] accepts the full authentication URL that ltijs redirects the browser to', async () => {
    const url = new URL(canvas.authEndpoint);
    for (const [name, value] of Object.entries(authRequest())) url.searchParams.set(name, value);
    await expect(canvas.authorize(url.href)).resolves.toHaveProperty('idToken');
  });

  it.each(REFUSALS)('[LTI-001] refuses a request with %s', async (_label, edit, error, description) => {
    // Arrange
    const params = authRequest();
    edit(params);
    // Act
    const result = await canvas.authorize(params);
    // Assert
    expect(result).toMatchObject({ error, error_description: expect.stringContaining(description) });
    expect(result).not.toHaveProperty('idToken');
  });

  it('[LTI-001] keeps the launch usable after a refused request, but consumes it on success', async () => {
    // Arrange
    const params = authRequest();
    // Act
    const refused = await canvas.authorize({ ...params, login_hint: 'someone-else' });
    const first = await canvas.authorize(params);
    const replay = await canvas.authorize(params);
    // Assert
    expect(refused.error).toBe('login_required');
    expect(first).toHaveProperty('idToken');
    expect(replay).toEqual({
      error: 'launch_no_longer_valid',
      error_description: LAUNCH_GONE,
      state: 'state-1',
    });
  });

  it('[LTI-001] lets exactly one of two concurrent requests use a login', async () => {
    const params = authRequest();
    const results = await Promise.all([canvas.authorize(params), canvas.authorize(params)]);
    expect(results.filter((result) => result.idToken).length).toBe(1);
  });

  it('[LTI-001] lets a login expire after five minutes', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['Date'] });
    const params = authRequest();
    // Act
    vi.setSystemTime(Date.now() + 301_000);
    const result = await canvas.authorize(params);
    // Assert
    expect(result.error).toBe('launch_no_longer_valid');
  });
});

describe('[LTI-001] mock Canvas /api/lti/authorize_redirect over HTTP', () => {
  const autoPostFields = (html) =>
    Object.fromEntries([...html.matchAll(/name="([^"]+)" value="([^"]*)"/g)].map((m) => [m[1], m[2]]));

  it('[LTI-001] answers GET with a page that form_posts id_token and state to the redirect URI', async () => {
    // Act
    const response = await fetch(`${canvas.authEndpoint}?${new URLSearchParams(authRequest())}`);
    const html = await response.text();
    // Assert
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(html).toContain(`method="post" action="${TOOL}/lti/launch"`);
    expect(html).toContain('.submit()');
    expect(Object.keys(autoPostFields(html))).toEqual(['id_token', 'state']);
    expect(decodeJwt(autoPostFields(html).id_token).nonce).toBe('nonce-1');
  });

  it('[LTI-001] answers a POSTed form the same way', async () => {
    const body = new URLSearchParams(authRequest());
    const response = await fetch(canvas.authEndpoint, { method: 'POST', body });
    expect(response.status).toBe(200);
    expect(autoPostFields(await response.text()).state).toBe('state-1');
  });

  it('[LTI-001] answers a refused request with a 400 page naming the error and posts nothing', async () => {
    const params = { ...authRequest(), redirect_uri: 'https://evil.example/steal' };
    const response = await fetch(`${canvas.authEndpoint}?${new URLSearchParams(params)}`);
    const html = await response.text();
    expect([response.status, html.includes('invalid_request_object'), html.includes('<form')]).toEqual([
      400,
      true,
      false,
    ]);
  });
});
