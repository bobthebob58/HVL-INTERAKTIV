/**
 * Unit tests for the grade worker's token source (D-104): the client-credentials request it sends, the cache until
 * 60 seconds before expiry, `forget` after a 401, and the outcomes of an unknown platform, a refused or failed
 * request, a redirect and an answer that is not a token.
 *
 * Spec: LTI-012
 */
import { describe, expect, it } from 'vitest';
import { AgsAccessTokens } from '../../src/grades/AgsAccessTokens.js';
import {
  FAKE_TOKEN_URL,
  fakeDirectory,
  fakePlatform,
  scriptedFetch,
  tokenAnswer,
  type FakeAnswer,
} from './support/fakeAgsFetch.js';

const PLATFORM = fakePlatform().id;
const now = new Date('2026-10-30T10:00:00.000Z');

/** A token source over a script, with a wall clock the test moves. */
function tokensWith(answers: FakeAnswer[], platform = fakePlatform()) {
  const clock = { ms: Date.UTC(2026, 9, 30, 10) };
  const { fetch, requests } = scriptedFetch(answers);
  const tokens = new AgsAccessTokens({
    platforms: fakeDirectory(platform),
    fetch,
    wallClock: () => clock.ms,
  });
  return { tokens, requests, clock };
}

describe('[LTI-012] AGS access tokens', () => {
  it('[LTI-012] asks for both AGS scopes with a signed client assertion, and never follows a redirect', async () => {
    // Arrange
    const { tokens, requests } = tokensWith([tokenAnswer('t1')]);
    // Act
    const outcome = await tokens.token(PLATFORM, now);
    // Assert
    expect(outcome).toEqual({ kind: 'token', accessToken: 't1' });
    const [request] = requests;
    expect(request).toMatchObject({ url: FAKE_TOKEN_URL, method: 'POST', redirect: 'manual' });
    const form = new URLSearchParams(request?.body);
    expect(form.get('grant_type')).toBe('client_credentials');
    expect(form.get('client_assertion_type')).toBe('urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    expect(form.get('client_assertion')?.split('.')).toHaveLength(3);
    expect(form.get('scope')).toBe(
      'https://purl.imsglobal.org/spec/lti-ags/scope/score ' +
        'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem.readonly',
    );
  });

  it('[LTI-012] reuses a token until 60 seconds before it expires, and fetches anew after forget', async () => {
    // Arrange
    const { tokens, requests, clock } = tokensWith([
      tokenAnswer('t1', 3600),
      tokenAnswer('t2'),
      tokenAnswer('t3'),
    ]);
    // Act
    const first = await tokens.token(PLATFORM, now);
    clock.ms += 3539_000;
    const cached = await tokens.token(PLATFORM, now);
    clock.ms += 2_000;
    const renewed = await tokens.token(PLATFORM, now);
    tokens.forget(PLATFORM);
    const afterForget = await tokens.token(PLATFORM, now);
    // Assert
    expect(
      [first, cached, renewed, afterForget].map((o) => (o.kind === 'token' ? o.accessToken : o.kind)),
    ).toEqual(['t1', 't1', 't2', 't3']);
    expect(requests).toHaveLength(3);
  });

  it.each([
    ['an unknown platform', null, { kind: 'failed', reason: 'platform-unavailable' }],
    ['a deactivated platform', fakePlatform(false), { kind: 'failed', reason: 'platform-unavailable' }],
  ])('[LTI-012] fails at once for %s, without a request', async (_name, platform, expected) => {
    // Arrange
    const { fetch, requests } = scriptedFetch([]);
    const tokens = new AgsAccessTokens({ platforms: fakeDirectory(platform), fetch });
    // Act and assert
    expect(await tokens.token(PLATFORM, now)).toEqual(expected);
    expect(requests).toHaveLength(0);
  });

  it.each<[string, FakeAnswer, object]>([
    [
      'a 503 with Retry-After',
      { status: 503, headers: { 'retry-after': '7' } },
      { kind: 'retry', reason: 'token-http-503', retryAfterMs: 7000 },
    ],
    ['a 429', { status: 429 }, { kind: 'retry', reason: 'token-http-429' }],
    [
      'a 400 invalid_scope',
      { status: 400, json: { error: 'invalid_scope' } },
      { kind: 'failed', reason: 'token-http-400' },
    ],
    [
      'a 401 invalid_client',
      { status: 401, json: { error: 'invalid_client' } },
      { kind: 'failed', reason: 'token-http-401' },
    ],
    [
      'a redirect',
      { status: 302, headers: { location: 'https://elsewhere.example/' } },
      { kind: 'failed', reason: 'token-http-302' },
    ],
    ['no answer', 'network', { kind: 'retry', reason: 'token-network' }],
    [
      'a 200 that is not a token',
      { status: 200, json: { hello: 'proxy' } },
      { kind: 'retry', reason: 'token-answer' },
    ],
  ])('[LTI-012] turns %s into its outcome and caches nothing', async (_name, answer, expected) => {
    // Arrange
    const { tokens, requests } = tokensWith([answer, tokenAnswer('after')]);
    // Act
    const outcome = await tokens.token(PLATFORM, now);
    const next = await tokens.token(PLATFORM, now);
    // Assert
    expect(outcome).toEqual(expected);
    expect(next).toEqual({ kind: 'token', accessToken: 'after' });
    expect(requests).toHaveLength(2);
  });
});
