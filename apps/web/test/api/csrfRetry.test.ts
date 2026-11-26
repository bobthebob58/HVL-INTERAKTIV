/**
 * Tests that a portal request refused for its CSRF token is sent once more with the session's current token
 * (D-131): the fresh token is fetched once and remembered, a token that is no newer ends the attempt, and a
 * Canvas page never asks.
 *
 * Spec: AUTH-003, LTI-003
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { apiRequest, CSRF_HEADER } from '../../src/api/apiRequest';
import { resetCsrfRetryForTests } from '../../src/api/csrfRetry';
import { errorBody, fakeFetch } from '../support/fakeFetch';

const SAVE = 'PUT /api/me/notices/formative-use';
const stale = errorBody(401, 'hvl:csrf-invalid', 'Økta di kunne ikkje stadfestast.');
/** Answers the save only when it carries `token`, and the session with `sessionToken` (401 when undefined). */
const server = (token: string, sessionToken: string | undefined) =>
  fakeFetch({
    [SAVE]: (request) =>
      request.headers[CSRF_HEADER] === token ? { status: 204 } : { status: 401, body: stale },
    'GET /auth/session': sessionToken
      ? { status: 200, body: { roles: ['author'], locale: 'nn', csrfToken: sessionToken } }
      : { status: 401, body: errorBody(401, 'hvl:unauthenticated', 'Logg inn.') },
  });
const save = (auth: Parameters<typeof apiRequest>[1]) =>
  apiRequest('/api/me/notices/formative-use', auth, { method: 'PUT', body: { version: 1 } });

describe('[AUTH-003] a request refused for an out-of-date CSRF token', () => {
  beforeEach(() => resetCsrfRetryForTests());

  it('[AUTH-003] is sent once more with the session’s current token, and later requests carry it at once', async () => {
    // Arrange
    const requests = server('new-token', 'new-token');
    // Act
    const first = await save({ kind: 'portal', csrfToken: 'old-token' });
    const later = await save({ kind: 'portal', csrfToken: 'old-token' });
    // Assert
    expect([first.ok, later.ok]).toEqual([true, true]);
    expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      SAVE,
      'GET /auth/session',
      SAVE,
      SAVE,
    ]);
    expect(requests.map((request) => request.headers[CSRF_HEADER])).toEqual([
      'old-token',
      undefined,
      'new-token',
      'new-token',
    ]);
  });

  it.each([
    ['the session still has the refused token', 'old-token'],
    ['nobody is signed in any more', undefined],
  ])('[AUTH-003] is shown as refused when %s, after one question', async (_case, sessionToken) => {
    // Arrange
    const requests = server('another-token', sessionToken);
    // Act
    const result = await save({ kind: 'portal', csrfToken: 'old-token' });
    // Assert
    expect(result).toMatchObject({ ok: false, status: 401, error: { errorCode: 'hvl:csrf-invalid' } });
    expect(requests).toHaveLength(2);
  });

  it('[AUTH-003] a second refusal after the retry is shown, with no third attempt', async () => {
    // Arrange: the session hands out a token the save still refuses
    const requests = server('never-accepted', 'new-token');
    // Act
    const result = await save({ kind: 'portal', csrfToken: 'old-token' });
    // Assert
    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(requests).toHaveLength(3);
  });

  it('[LTI-003] a Canvas page, which has no session, never asks for one', async () => {
    // Arrange
    const requests = server('new-token', 'new-token');
    // Act
    const result = await save({ kind: 'lti', ltik: 'ltik-1' });
    // Assert
    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(requests).toHaveLength(1);
  });
});
