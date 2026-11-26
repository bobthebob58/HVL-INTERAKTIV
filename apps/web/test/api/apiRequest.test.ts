/**
 * Tests for the web app's API requests: the portal sends the cookie and, on unsafe methods, the CSRF token; Canvas
 * pages send the ltik as a Bearer token and no cookie; every request carries the own-page header; answers and errors
 * come back typed and nothing throws.
 *
 * Spec: AUTH-003, LTI-003, DOC-012, DATA-007
 */
import { CSRF_HEADER_NAME, OWN_PAGE_HEADER_NAME, OWN_PAGE_HEADER_VALUE } from '@hvl-interaktiv/api-contract';
import { describe, expect, it, vi } from 'vitest';
import { apiHeaders, apiRequest, CSRF_HEADER, OWN_PAGE_HEADER } from '../../src/api/apiRequest';
import { getContent, listContent, publishContent, unpublishContent } from '../../src/api/contentApi';
import { errorBody, fakeFetch } from '../support/fakeFetch';

const ID = '7d3c1a8e-5b2f-4c1d-9e8f-0a1b2c3d4e5f';
/** What every request carries: JSON asked for, and the own-page header. */
const BASE = { Accept: 'application/json', [OWN_PAGE_HEADER_NAME]: OWN_PAGE_HEADER_VALUE };

describe('[AUTH-003] credentials on API requests', () => {
  it('[AUTH-003] uses the contract’s CSRF header name', () => {
    expect(CSRF_HEADER).toBe(CSRF_HEADER_NAME);
  });

  it('[DATA-007] every request carries the contract’s own-page header, a GET and an LTI request too', () => {
    expect(OWN_PAGE_HEADER).toEqual({ name: OWN_PAGE_HEADER_NAME, value: OWN_PAGE_HEADER_VALUE });
    for (const method of ['GET', 'POST', 'DELETE'] as const) {
      expect(apiHeaders({ kind: 'portal' }, method, false)).toMatchObject({ 'x-hvli-request': 'fetch' });
      expect(apiHeaders({ kind: 'lti', ltik: 'l' }, method, true, '*/*')).toMatchObject({
        'x-hvli-request': 'fetch',
      });
    }
  });

  it.each([
    ['GET', {}],
    ['PUT', { [CSRF_HEADER]: 'tok' }],
    ['POST', { [CSRF_HEADER]: 'tok' }],
    ['PATCH', { [CSRF_HEADER]: 'tok' }],
    ['DELETE', { [CSRF_HEADER]: 'tok' }],
  ] as const)('[AUTH-003] a portal %s carries the CSRF token only on unsafe methods', (method, extra) => {
    expect(apiHeaders({ kind: 'portal', csrfToken: 'tok' }, method, false)).toEqual({ ...BASE, ...extra });
  });

  it('[LTI-003] an LTI request carries the ltik as Bearer, no CSRF token and no cookie', async () => {
    // Arrange
    const requests = fakeFetch({ 'GET /api/content': { status: 200, body: { items: [] } } });
    // Act
    const result = await listContent({ kind: 'lti', ltik: 'ltik-1' });
    // Assert
    expect(result).toEqual({ ok: true, status: 200, data: { items: [] } });
    expect(requests[0]?.headers).toEqual({ ...BASE, Authorization: 'Bearer ltik-1' });
    expect(requests[0]?.credentials).toBe('omit');
  });
});

describe('[DOC-012] typed API calls', () => {
  it('[DOC-012] builds the activity paths and sends JSON bodies', async () => {
    // Arrange
    const requests = fakeFetch({
      [`GET /api/content/${ID}`]: { status: 200, body: { id: ID } },
      [`POST /api/content/${ID}/publish`]: { status: 200, body: { status: 'published' } },
      [`POST /api/content/${ID}/unpublish`]: { status: 200, body: { status: 'draft' } },
    });
    const auth = { kind: 'portal', csrfToken: 'tok' } as const;
    // Act
    await getContent(ID, auth);
    await publishContent(ID, { updatedAt: '2026-10-23T12:00:00.000Z', acknowledgements: [] }, auth);
    await unpublishContent(ID, { updatedAt: '2026-10-23T12:00:00.000Z' }, auth);
    // Assert
    expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      `GET /api/content/${ID}`,
      `POST /api/content/${ID}/publish`,
      `POST /api/content/${ID}/unpublish`,
    ]);
    expect(requests[1]?.headers['Content-Type']).toBe('application/json');
    expect(requests[2]?.body).toEqual({ updatedAt: '2026-10-23T12:00:00.000Z' });
  });

  it('[DOC-012] a DELETE carries the CSRF token and no body, and an empty answer is ok (D-099)', async () => {
    // Arrange
    const requests = fakeFetch({ [`DELETE /api/content/${ID}/bank-listing`]: { status: 204 } });
    // Act
    const result = await apiRequest(
      `/api/content/${ID}/bank-listing`,
      { kind: 'portal', csrfToken: 'tok' },
      {
        method: 'DELETE',
      },
    );
    // Assert
    expect(result).toEqual({ ok: true, status: 204, data: undefined });
    expect(requests[0]).toMatchObject({ method: 'DELETE', body: undefined, credentials: 'same-origin' });
    expect(requests[0]?.headers).toEqual({ ...BASE, [CSRF_HEADER]: 'tok' });
  });

  it('[DOC-012] returns the status and the server’s error body on a refusal', async () => {
    fakeFetch({ 'GET /api/me': { status: 401, body: errorBody(401, 'hvl:unauthenticated', 'Logg inn.') } });
    const result = await apiRequest('/api/me', { kind: 'portal' });
    expect(result).toMatchObject({ ok: false, status: 401, error: { errorCode: 'hvl:unauthenticated' } });
  });

  it('[DOC-012] a network failure is status 0, never an exception', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline')));
    expect(await apiRequest('/api/me', { kind: 'portal' })).toEqual({ ok: false, status: 0 });
  });
});
