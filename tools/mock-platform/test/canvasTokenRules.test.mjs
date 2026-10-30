/**
 * Tests for the mock Canvas's token endpoint around the assertion: grant and request errors, the developer key's
 * scopes, injected faults, and when the services stop accepting a token (expiry, revocation, scope).
 *
 * Spec: LTI-012, LTI-008
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { LTI_CLAIM, LTI_SCOPE, MOCK_CANVAS_SCOPES, startMockCanvas } from '../mockPlatform.mjs';
import { scoreBody, startServiceBench } from './serviceBench.mjs';

const DEVELOPER_KEY = new URL('../../../docs/reference/canvas-lti13-developer-key.json', import.meta.url);
let bench;

beforeAll(async () => {
  bench = await startServiceBench();
});
afterAll(() => bench.close());
afterEach(() => {
  vi.useRealTimers();
  bench.canvas.clearFaults();
});

const oauthError = async (response) => [response.status, (await response.json()).error];

describe('[LTI-012] mock Canvas token endpoint: grant, request and scope errors', () => {
  it.each([
    ['a grant type Canvas does not support', { grant_type: 'password' }, 400, 'unsupported_grant_type'],
    ['another assertion type', { client_assertion_type: 'urn:other' }, 400, 'invalid_request'],
    ['an empty assertion', { client_assertion: '' }, 400, 'invalid_request'],
    ["another client_id (the mock's own check)", { client_id: '999' }, 401, 'invalid_client'],
    [
      'the lineitem scope, which the developer key lacks',
      { scope: LTI_SCOPE.lineItem },
      400,
      'invalid_scope',
    ],
    [
      'result.readonly next to score',
      { scope: `${LTI_SCOPE.score} ${LTI_SCOPE.resultReadonly}` },
      400,
      'invalid_scope',
    ],
    ['no scope', { scope: '' }, 400, 'invalid_scope'],
    ['an unknown scope', { scope: 'openid' }, 400, 'invalid_scope'],
  ])('[LTI-012] answers %s with %i %s', async (_name, fields, status, error) => {
    expect(await oauthError(await bench.requestToken(fields))).toEqual([status, error]);
  });

  it("[LTI-012] grants by default exactly the developer key's scopes and lists the AGS ones in launches", async () => {
    // Arrange
    const key = JSON.parse(readFileSync(DEVELOPER_KEY, 'utf8'));
    // Act
    const claim = bench.canvas.idTokenClaims({}, 'n')[LTI_CLAIM.agsEndpoint];
    // Assert
    expect([...MOCK_CANVAS_SCOPES].sort()).toEqual([...key.scopes].sort());
    expect(claim.scope).toEqual([LTI_SCOPE.lineItemReadonly, LTI_SCOPE.score]);
  });

  it('[LTI-012] grants lineitem when a test widens the scopes, and drops the NRPS claim without its scope', async () => {
    // Arrange
    const wide = await startServiceBench({ scopes: [LTI_SCOPE.lineItem, LTI_SCOPE.score] });
    try {
      // Act
      const response = await wide.requestToken({ scope: LTI_SCOPE.lineItem });
      const claims = wide.canvas.idTokenClaims({}, 'n');
      // Assert
      expect(response.status).toBe(200);
      expect(claims[LTI_CLAIM.agsEndpoint].scope).toEqual([LTI_SCOPE.lineItem, LTI_SCOPE.score]);
      expect(claims).not.toHaveProperty([LTI_CLAIM.namesRoleService]);
    } finally {
      await wide.close();
    }
  });

  it('[LTI-012] refuses to start with a scope that is no AGS or NRPS scope', async () => {
    await expect(startMockCanvas({ toolUrl: 'http://localhost:3999', scopes: ['openid'] })).rejects.toThrow(
      TypeError,
    );
  });
});

describe('[LTI-012] mock Canvas token endpoint: faults', () => {
  it('[LTI-012] answers injected 503 and 429 with Retry-After, then grants again, and records the faults', async () => {
    // Arrange
    bench.canvas.tokens.failNext({ status: 503 });
    bench.canvas.tokens.failNext({ count: 2, status: 429, retryAfter: 3 });
    // Act
    const responses = [];
    for (let i = 0; i < 4; i += 1) responses.push(await bench.requestToken());
    // Assert
    expect(responses.map((response) => response.status)).toEqual([503, 429, 429, 200]);
    expect(responses[1].headers.get('retry-after')).toBe('3');
    expect(bench.canvas.tokens.requests.slice(-4).map((record) => record.fault)).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it('[LTI-012] can answer any OAuth error code, such as invalid_grant, as a fault', async () => {
    bench.canvas.tokens.failNext({ status: 400, error: 'invalid_grant' });
    expect(await oauthError(await bench.requestToken())).toEqual([400, 'invalid_grant']);
  });
});

describe('[LTI-012] mock Canvas services: which tokens they accept', () => {
  const lineItemUrl = () => bench.canvas.ags.lineItems('mock-course-1')[0].id;
  beforeAll(() => bench.canvas.ags.addLineItem({ label: 'Quiz', scoreMaximum: 100 }));

  it("[LTI-012] answer 401 in Canvas's LTI error shape without a token or with one the mock did not issue", async () => {
    // Act
    const answers = [];
    for (const response of [await fetch(lineItemUrl()), await bench.get(lineItemUrl(), 'forged')]) {
      answers.push([response.status, await response.json()]);
    }
    // Assert
    expect(answers).toEqual([
      [401, { errors: { type: 'unauthorized', message: 'Missing access token' } }],
      [401, { errors: { type: 'unauthorized', message: 'Invalid access token' } }],
    ]);
  });

  it('[LTI-012] answer 401 once the token has expired, and after revokeAll', async () => {
    // Arrange
    const [first, second] = [await bench.token(), await bench.token()];
    // Act
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 3_600_000);
    const expired = (await bench.get(lineItemUrl(), first)).status;
    vi.useRealTimers();
    const before = (await bench.get(lineItemUrl(), second)).status;
    bench.canvas.tokens.revokeAll();
    const after = (await bench.get(lineItemUrl(), second)).status;
    // Assert
    expect([expired, before, after]).toEqual([401, 200, 401]);
  });

  it('[LTI-008] answer 401 «Insufficient permissions», as Canvas does, for a token without the scope needed', async () => {
    // Arrange
    const nrpsOnly = await bench.token(LTI_SCOPE.contextMembershipReadonly);
    // Act
    const response = await bench.get(lineItemUrl(), nrpsOnly);
    // Assert
    expect(response.status).toBe(401);
    expect((await response.json()).errors).toEqual({
      type: 'unauthorized',
      message: 'Insufficient permissions',
    });
  });

  it('[LTI-012] refuse a score post whose token lacks the score scope, and record it', async () => {
    // Arrange
    const readOnly = await bench.token(LTI_SCOPE.lineItemReadonly);
    // Act
    const response = await bench.postScore(lineItemUrl(), scoreBody(), readOnly);
    // Assert
    expect(response.status).toBe(401);
    expect(bench.canvas.ags.scorePosts.at(-1)).toMatchObject({ ok: false, status: 401, fault: false });
  });
});
