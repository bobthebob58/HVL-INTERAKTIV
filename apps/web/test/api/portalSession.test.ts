/**
 * Tests for reading the portal session in the browser: 401 is signed out, a well-formed answer is a session with
 * only the fields a page needs, and anything else is an error.
 *
 * Spec: AUTH-003, DATA-002
 */
import { describe, expect, it } from 'vitest';
import { fetchPortalSession, isAuthor, SESSION_PATH } from '../../src/api/portalSession';
import { errorBody, fakeFetch } from '../support/fakeFetch';

describe('[AUTH-003] the portal session', () => {
  it('[AUTH-003] 401 means signed out', async () => {
    fakeFetch({ [`GET ${SESSION_PATH}`]: { status: 401, body: errorBody(401, 'hvl:unauthenticated') } });
    expect(await fetchPortalSession()).toEqual({ status: 'signedOut' });
  });

  it('[DATA-002] keeps only roles, locale and the CSRF token', async () => {
    // Arrange
    const answer = {
      roles: ['author'],
      locale: 'nb',
      hvlMember: true,
      studentAuthor: false,
      csrfToken: 'tok',
    };
    const requests = fakeFetch({ [`GET ${SESSION_PATH}`]: { status: 200, body: answer } });
    // Act
    const result = await fetchPortalSession();
    // Assert
    expect(result).toEqual({
      status: 'signedIn',
      session: { roles: ['author'], locale: 'nb', csrfToken: 'tok' },
    });
    expect(requests[0]?.credentials).toBe('same-origin');
  });

  it.each([
    [{ status: 500, body: errorBody(500, 'error.internal') }],
    [{ status: 200, body: { roles: 'author' } }],
    [{ status: 404 }],
  ])('[AUTH-003] any other answer is an error, never a session (%#)', async (answer) => {
    fakeFetch({ [`GET ${SESSION_PATH}`]: answer });
    expect(await fetchPortalSession()).toEqual({ status: 'error' });
  });

  it.each([
    [['author'], true],
    [['admin'], true],
    [['learner'], false],
    [[], false],
  ] as const)('[AUTH-003] roles %j may create activities: %s', (roles, expected) => {
    expect(isAuthor({ roles, locale: 'nn', csrfToken: 't' })).toBe(expected);
  });
});
