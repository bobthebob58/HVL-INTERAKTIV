/**
 * feideGroups — reads the logged-in user's groups from Feide's Groups API.
 *
 * Why: AUTH-002 takes affiliations and course groups from `GET <groups-api>/groups/me/groups` with the user's
 *      access token. Without that answer the roles are unknown, so the login fails closed with a 503 page rather
 *      than guessing a role (D-054).
 * Spec: AUTH-002
 * Invariants:
 *   - Any failure (network, timeout, non-200, an answer that is not a JSON array, an oversized answer) is
 *     `hvl:feide-groups-unavailable` (503); the user's access token is never logged.
 *   - The answer is returned as parsed JSON; ./FeideRoleMapper.ts reads it defensively.
 * Collaborators: ./completeFeideLogin.ts, ./FeideRoleMapper.ts, ../../http/authErrors.ts.
 * Tests: apps/server/test/auth/feide/feideGroups.test.ts
 */
import { authError } from '../../http/authErrors.js';

/** Milliseconds the Groups API has to answer. */
export const GROUPS_TIMEOUT_MS = 5000;
/** Largest Groups API answer accepted, in bytes (a user has tens of groups, not thousands). */
export const MAX_GROUPS_BYTES = 1_000_000;

/**
 * Fetches the user's groups.
 * @param groupsApiUrl - `FEIDE_GROUPS_API_URL`.
 * @param accessToken - The user's Feide access token (in memory only).
 * @param fetchImpl - The fetch to use (tests inject one).
 * @returns The parsed JSON array of group objects.
 * @throws HttpError 503 `hvl:feide-groups-unavailable` on any failure.
 */
export async function fetchFeideGroups(
  groupsApiUrl: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown[]> {
  try {
    // WHY: the base URL may carry a path (e.g. a proxy prefix), so the endpoint is appended, not resolved.
    const response = await fetchImpl(`${groupsApiUrl.replace(/\/+$/, '')}/groups/me/groups`, {
      headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
      signal: AbortSignal.timeout(GROUPS_TIMEOUT_MS),
      redirect: 'error',
    });
    if (response.status !== 200) throw new Error('unexpected status');
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_GROUPS_BYTES) throw new Error('answer too large');
    const groups: unknown = JSON.parse(text);
    if (!Array.isArray(groups)) throw new Error('not a list');
    return groups;
  } catch {
    // SECURITY: fail closed; the cause may hold the request (and its token), so it is not passed on.
    throw authError('hvl:feide-groups-unavailable');
  }
}
