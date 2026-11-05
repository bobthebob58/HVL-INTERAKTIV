/**
 * Live-contract checks of Canvas's client-credentials token endpoint, as the grade worker (D-104) and the NRPS count
 * (LTI-008) use it: the audience it accepts, its answer, how it refuses another audience, and that it refuses rather
 * than narrows a scope the developer key lacks. What the mock assumes is in tools/mock-platform/canvasTokenEndpoint.mjs
 * and canvasClientAssertion.mjs. Runs only when asked (apps/server/live/README.md); skipped otherwise.
 *
 * Spec: LTI-012, LTI-008
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LTI_SCOPE } from '../../../tools/mock-platform/mockPlatform.mjs';
import { AgsAccessTokens } from '../src/grades/AgsAccessTokens.js';
import { outcomeOfStatus } from '../src/grades/agsSendOutcome.js';
import { AGS_TOKEN_SCOPE } from '../src/grades/agsVocabulary.js';
import { openCanvasTarget, type CanvasTarget } from './canvasTarget.js';
import { requestToken } from './canvasRequests.js';
import { livePlanOf, runsCanvas } from './liveConfig.js';

const plan = livePlanOf(process.env);
const MOCK = 'the mock assumes this (tools/mock-platform/canvasTokenEndpoint.mjs)';

describe.runIf(runsCanvas(plan))('LTI-012 the token endpoint, as the mock Canvas assumes it', () => {
  let target: CanvasTarget;
  beforeAll(async () => {
    target = await openCanvasTarget(plan);
  }, 120_000);
  afterAll(() => target?.close());

  it('[LTI-012] grants a bearer token to an assertion whose audience is the token endpoint', async () => {
    // Act
    const answer = await requestToken(target, { scope: AGS_TOKEN_SCOPE });
    // Assert: 200 with a bearer token, its lifetime and the scopes asked for (never printed)
    expect(answer.status, MOCK).toBe(200);
    const granted = answer.json as Record<string, unknown>;
    expect(typeof granted.access_token, MOCK).toBe('string');
    expect(String(granted.token_type), MOCK).toMatch(/^bearer$/i);
    expect(granted.expires_in, `${MOCK}; AgsAccessTokens assumes 3600 when absent`).toBe(3600);
    expect(String(granted.scope).split(' ').sort(), MOCK).toEqual(AGS_TOKEN_SCOPE.split(' ').sort());
  });

  it('[LTI-012] gives the grade worker’s own token source a token, from the stored tool key', async () => {
    // Arrange
    const tokens = new AgsAccessTokens({ platforms: target.directory });
    // Act
    const outcome = await tokens.token(target.platform.id, new Date());
    // Assert
    expect(outcome.kind, 'src/grades/AgsAccessTokens.ts against the platform').toBe('token');
  });

  it('[LTI-012] refuses another audience with a 400 that the worker fails at once', async () => {
    // Act
    const answer = await requestToken(target, {
      scope: AGS_TOKEN_SCOPE,
      audience: 'https://audience.invalid/login/oauth2/token',
    });
    // Assert: Canvas reports every assertion problem as invalid_request; a 4xx other than 429 is never retried
    expect(answer.status, MOCK).toBe(400);
    expect(answer.json, MOCK).toMatchObject({ error: 'invalid_request' });
    expect(outcomeOfStatus(answer.status, null, new Date(), 'token-').kind).toBe('failed');
  });

  it('[LTI-012] refuses, rather than narrows, a request for a scope the developer key lacks', async () => {
    // Act: the AGS write scope is not on HVL's developer key (docs/reference/canvas-lti13-developer-key.json)
    const answer = await requestToken(target, { scope: `${AGS_TOKEN_SCOPE} ${LTI_SCOPE.lineItem}` });
    // Assert: so a key missing `lineitem.readonly` would refuse every token the worker asks for
    expect(answer.status, MOCK).toBe(400);
    expect(answer.json, MOCK).toMatchObject({ error: 'invalid_scope' });
  });

  it('[LTI-008] grants the Names and Roles scope the developer key holds', async () => {
    // Act
    const answer = await requestToken(target, { scope: LTI_SCOPE.contextMembershipReadonly });
    // Assert
    expect(answer.status, `${MOCK}; the key needs contextmembership.readonly`).toBe(200);
  });
});
