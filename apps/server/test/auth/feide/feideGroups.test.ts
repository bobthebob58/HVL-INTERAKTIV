/**
 * Tests that the Groups API call sends the user's token and fails closed on any odd answer.
 *
 * Spec: AUTH-002
 */
import { describe, expect, it } from 'vitest';
import { fetchFeideGroups, MAX_GROUPS_BYTES } from '../../../src/auth/feide/feideGroups.js';
import { isAuthError } from '../../../src/http/authErrors.js';

const answering = (body: string, status = 200) => {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(body, { status });
  }) as typeof fetch;
  return { fetchImpl, calls };
};

describe('[AUTH-002] Feide Groups API', () => {
  it("[AUTH-002] asks for the user's groups with their token and returns the list", async () => {
    // Arrange
    const { fetchImpl, calls } = answering('[{"id":"fc:org:hvl.no"}]');
    // Act
    const groups = await fetchFeideGroups('https://groups-api.example/prefix/', 'tok', fetchImpl);
    // Assert
    expect(groups).toEqual([{ id: 'fc:org:hvl.no' }]);
    expect(calls[0]?.url).toBe('https://groups-api.example/prefix/groups/me/groups');
    expect(calls[0]?.init?.headers).toMatchObject({ authorization: 'Bearer tok' });
    expect(calls[0]?.init?.redirect).toBe('error');
  });

  it.each([
    ['a non-200 status', answering('[]', 401).fetchImpl],
    ['a body that is not JSON', answering('<html>').fetchImpl],
    ['JSON that is not a list', answering('{"groups":[]}').fetchImpl],
    ['an oversized answer', answering(`[${'"x",'.repeat(MAX_GROUPS_BYTES / 4)}"x"]`).fetchImpl],
    ['a network failure', (async () => Promise.reject(new TypeError('fetch failed'))) as typeof fetch],
  ])('[AUTH-002] fails closed (503) on %s, without passing the cause on', async (_name, fetchImpl) => {
    const error: unknown = await fetchFeideGroups(
      'https://groups-api.example',
      'secret-token',
      fetchImpl,
    ).catch((e: unknown) => e);
    expect(isAuthError(error, 'hvl:feide-groups-unavailable')).toBe(true);
    expect(JSON.stringify(error)).not.toContain('secret-token');
  });
});
