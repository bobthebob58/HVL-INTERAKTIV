/**
 * Live-contract checks of Feide's OpenID Connect discovery document and key set, as the login (AUTH-001,
 * `src/auth/feide/FeideClient.ts`) relies on them: Feide's endpoint paths, `client_secret_post`, RS256 ID tokens, the
 * code flow with PKCE S256, and RSA signing keys with key IDs. What the mock assumes is in
 * tools/mock-platform/feideDiscovery.mjs and docs/reference/feide-values.md. A real login, its claims and the Groups
 * API need a person's Feide account, so they are steps of docs/handoff/canvas-acceptance.md instead. Runs only when
 * asked (apps/server/live/README.md); skipped otherwise.
 *
 * Spec: AUTH-001
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startMockFeide } from '../../../tools/mock-platform/mockPlatform.mjs';
import { REQUEST_TIMEOUT_MS } from './canvasRequests.js';
import { livePlanOf, runsFeide } from './liveConfig.js';

const plan = livePlanOf(process.env);
const MOCK = 'the mock assumes this (tools/mock-platform/feideDiscovery.mjs)';
/** Feide's endpoint paths under its issuer (docs/reference/feide-values.md, the mock's FEIDE_ENDPOINTS). */
const FEIDE_PATHS = Object.freeze({
  authorization_endpoint: '/oauth/authorization',
  token_endpoint: '/oauth/token',
  userinfo_endpoint: '/openid/userinfo',
  jwks_uri: '/openid/jwks',
  end_session_endpoint: '/openid/endsession',
});

const getJson = async (url: string): Promise<{ status: number; json: Record<string, unknown> }> => {
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  return {
    status: response.status,
    json: (await response.json().catch(() => ({}))) as Record<string, unknown>,
  };
};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

describe.runIf(runsFeide(plan))('AUTH-001 Feide discovery, as the mock Feide assumes it', () => {
  let issuer: string;
  let stop = async (): Promise<void> => {};
  beforeAll(async () => {
    if (plan.kind === 'live' && plan.feideIssuer) issuer = plan.feideIssuer;
    else {
      const feide = await startMockFeide();
      [issuer, stop] = [feide.issuer, () => feide.close()];
    }
  });
  afterAll(() => stop());

  it('[AUTH-001] names Feide’s endpoints, client_secret_post, RS256 and the code flow', async () => {
    // Act
    const { status, json } = await getJson(`${issuer}/.well-known/openid-configuration`);
    // Assert: what FeideClient discovers and then uses
    expect(status).toBe(200);
    expect(json.issuer, 'the ID token issuer the server checks').toBe(issuer);
    for (const [field, path] of Object.entries(FEIDE_PATHS))
      expect(json[field], MOCK).toBe(`${issuer}${path}`);
    expect(list(json.token_endpoint_auth_methods_supported), MOCK).toContain('client_secret_post');
    expect(list(json.id_token_signing_alg_values_supported), MOCK).toContain('RS256');
    expect(list(json.response_types_supported), MOCK).toContain('code');
    // WHY: the login sends PKCE S256 either way; a document that lists methods must list S256.
    if (json.code_challenge_methods_supported !== undefined) {
      expect(list(json.code_challenge_methods_supported), MOCK).toContain('S256');
    }
  });

  it('[AUTH-001] publishes RSA signing keys, each with a key ID', async () => {
    // Arrange
    const { json: discovery } = await getJson(`${issuer}/.well-known/openid-configuration`);
    // Act
    const { status, json } = await getJson(String(discovery.jwks_uri));
    // Assert
    expect(status).toBe(200);
    const rsa = list(json.keys).filter((key) => (key as { kty?: unknown }).kty === 'RSA') as {
      kid?: unknown;
    }[];
    expect(rsa.length, MOCK).toBeGreaterThan(0);
    for (const key of rsa) expect(typeof key.kid, 'openid-client picks the key by kid').toBe('string');
  });
});
