/**
 * Tests for the studio overview request (`GET /api/studio`), the one call every page makes for the phase labels
 * (PED-001): the public pages send the browser's cookie and no token, a portal page's credential sends no CSRF token
 * on the GET, and an LTI page's sends its ltik as a Bearer token and no cookie.
 *
 * Spec: PED-001, AUTH-003, LTI-003
 */
import { describe, expect, it } from 'vitest';
import { getStudioOverview, STUDIO_OVERVIEW_PATH } from '../../src/api/studioApi';
import { fakeFetch } from '../support/fakeFetch';
import { OVERVIEW } from '../support/studioFixtures';

/** What every request of the web client carries (../../src/api/apiRequest.ts). */
const BASE = { Accept: 'application/json', 'x-hvli-request': 'fetch' };

describe('[PED-001] the studio overview request', () => {
  it.each([
    ['a public page (no credential given)', undefined, BASE, 'same-origin'],
    [
      'a portal page with its CSRF token',
      { kind: 'portal', csrfToken: 'csrf-1' } as const,
      BASE,
      'same-origin',
    ],
    [
      'an LTI page',
      { kind: 'lti', ltik: 'ltik-1' } as const,
      { ...BASE, Authorization: 'Bearer ltik-1' },
      'omit',
    ],
  ])(
    '[PED-001] %s asks GET /api/studio once with its own credential',
    async (_, auth, headers, credentials) => {
      // Arrange
      const requests = fakeFetch({ 'GET /api/studio': { status: 200, body: OVERVIEW } });
      // Act
      const result = await getStudioOverview(auth);
      // Assert
      expect(result).toEqual({ ok: true, status: 200, data: OVERVIEW });
      expect(requests.map((r) => [r.method, r.path, r.headers, r.credentials])).toEqual([
        ['GET', STUDIO_OVERVIEW_PATH, headers, credentials],
      ]);
    },
  );
});
