/**
 * Tests for the mock Canvas's client-credentials token endpoint: the bearer token it grants, and every check of the
 * JWT client assertion (signature against the tool's /lti/keys, iss, sub, aud, iat, exp, jti and its replay).
 *
 * Spec: LTI-012, LTI-008
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LTI_SCOPE } from '../mockPlatform.mjs';
import { GRADE_SCOPES, startServiceBench } from './serviceBench.mjs';

let bench;

beforeAll(async () => {
  bench = await startServiceBench();
});
afterAll(() => bench.close());

const now = () => Math.floor(Date.now() / 1000);
const HS256_SECRET = new TextEncoder().encode('a-shared-secret-that-canvas-never-accepts');

describe('[LTI-012] mock Canvas token endpoint: granting', () => {
  it('[LTI-012] grants an opaque bearer token for the asked scopes, living 3600 s, and records no token', async () => {
    // Act
    const response = await bench.requestToken();
    const body = await response.json();
    // Assert
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toEqual({
      access_token: expect.stringMatching(/^[\w-]{43}$/),
      token_type: 'Bearer',
      expires_in: 3600,
      scope: GRADE_SCOPES,
    });
    expect(bench.canvas.tokens.requests.at(-1)).toMatchObject({
      ok: true,
      status: 200,
      problems: [],
      scopes: [LTI_SCOPE.score, LTI_SCOPE.lineItemReadonly],
      fault: false,
    });
    expect(JSON.stringify(bench.canvas.tokens.requests)).not.toContain(body.access_token);
  });

  it('[LTI-012] accepts an aud array that contains the token URL, or the bare host, as Canvas intersects audiences', async () => {
    // Arrange
    const host = new URL(bench.canvas.tokenEndpoint).host;
    const assertions = [
      await bench.sign(bench.claims({ aud: [bench.canvas.origin, bench.canvas.tokenEndpoint] })),
      await bench.sign(bench.claims({ aud: host })),
    ];
    // Act
    const statuses = [];
    for (const assertion of assertions) {
      statuses.push((await bench.requestToken({ client_assertion: assertion })).status);
    }
    // Assert
    expect(statuses).toEqual([200, 200]);
  });

  it('[LTI-008] grants the NRPS scope alone, as ltijs asks for it', async () => {
    const response = await bench.requestToken({ scope: LTI_SCOPE.contextMembershipReadonly });
    expect([response.status, (await response.json()).scope]).toEqual([
      200,
      LTI_SCOPE.contextMembershipReadonly,
    ]);
  });
});

describe('[LTI-012] mock Canvas token endpoint: client assertion checks', () => {
  const t = now();
  it.each([
    ['an HS256 signature', 'wrong-alg', (b) => b.sign(b.claims(), { alg: 'HS256', key: HS256_SECRET })],
    ['a kid the tool does not publish', 'unknown-kid', (b) => b.sign(b.claims(), { kid: 'other-kid' })],
    ['a key outside the key set', 'bad-signature', (b) => b.sign(b.claims(), { key: b.otherKey.privateKey })],
    ['another issuer', 'wrong-iss', (b) => b.sign(b.claims({ iss: 'someone-else' }))],
    ['another subject', 'wrong-sub', (b) => b.sign(b.claims({ sub: 'someone-else' }))],
    ['the issuer as audience', 'wrong-aud', (b) => b.sign(b.claims({ aud: b.canvas.issuer }))],
    ['an expired assertion', 'expired', (b) => b.sign(b.claims({ iat: t - 120, exp: t - 60 }))],
    ['an iat two minutes ahead', 'bad-iat', (b) => b.sign(b.claims({ iat: t + 120, exp: t + 180 }))],
    [
      'an iat 45 s ahead (Canvas allows 30 s)',
      'bad-iat',
      (b) => b.sign(b.claims({ iat: t + 45, exp: t + 105 })),
    ],
    ['an iat ten minutes old', 'bad-iat', (b) => b.sign(b.claims({ iat: t - 600, exp: t + 60 }))],
    ['no jti', 'missing-jti', (b) => b.sign(b.claims({ jti: undefined }))],
    ['a value that is no JWT', 'invalid-jwt', async () => 'not.a.jwt'],
  ])(
    "[LTI-012] refuses %s with Canvas's 400 invalid_request and the problem %s",
    async (_name, problem, assertionOf) => {
      // Act
      const response = await bench.requestToken({ client_assertion: await assertionOf(bench) });
      const body = await response.json();
      // Assert
      expect(response.status).toBe(400);
      expect(body.error).toBe('invalid_request');
      expect(body.error_description.split(' ')).toContain(problem);
      expect(bench.canvas.tokens.requests.at(-1)).toMatchObject({ ok: false, error: 'invalid_request' });
      expect(bench.canvas.tokens.requests.at(-1).problems).toContain(problem);
    },
  );

  it('[LTI-012] refuses with jwks-unavailable while the tool key set cannot be fetched', async () => {
    // Arrange
    bench.setKeysAvailable(false);
    // Act
    const response = await bench.requestToken().finally(() => bench.setKeysAvailable(true));
    // Assert
    expect(response.status).toBe(400);
    expect((await response.json()).error_description).toContain('jwks-unavailable');
  });

  it('[LTI-012] refuses a replayed jti, while a forged copy does not use the jti up', async () => {
    // Arrange
    const claims = bench.claims();
    const forged = await bench.sign(claims, { key: bench.otherKey.privateKey });
    const genuine = await bench.sign(claims);
    // Act
    const statuses = [];
    for (const assertion of [forged, genuine, genuine]) {
      statuses.push((await bench.requestToken({ client_assertion: assertion })).status);
    }
    // Assert
    expect(statuses).toEqual([400, 200, 400]);
    expect(bench.canvas.tokens.requests.at(-1).problems).toEqual(['reused-jti']);
  });
});
