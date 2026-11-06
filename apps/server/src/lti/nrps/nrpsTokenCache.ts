/**
 * nrpsTokenCache — forgets the Names and Roles access token that ltijs cached for a platform, so that a token
 * Canvas refused is fetched anew instead of being sent again until it expires.
 *
 * Why: ltijs keeps a platform's client-credentials token in `LtiAccessToken` until shortly before it expires and
 *      never drops one the platform refuses. Canvas answers 401 both for a token it no longer accepts (revoked, a
 *      rotated developer key) and for a missing scope, so the NRPS read gets one new token after a 401 and gives up
 *      on a second, as the AGS client does (D-104, S6 trap (a)).
 * Spec: LTI-008
 * Invariants:
 *   - Deletes only the row of this platform URL, client ID and exactly ltijs's NRPS scope string; other scopes and
 *     other platforms' tokens stay. (The grade worker keeps its own AGS token in memory, D-104.)
 *   - SECURITY: never reads, logs or returns a token.
 * Collaborators: ./nrpsRosterRead.ts (calls it after a 401), ./nrpsServices.ts (wires it),
 *   ../storage/PrismaLtiDatabaseManager.ts (writes the rows ltijs caches).
 * Tests: apps/server/test/lti/nrps/nrpsTokenCache.int.test.ts,
 *   apps/server/test/lti/nrps/NrpsLearnerCounterFaults.int.test.ts
 */
import type { Database } from '../../infra/prismaClient.js';

// WHY: ltijs 7.0.7 keeps this as `NRPS_CONTEXT_MEMBERSHIP_READONLY_SCOPE` in `shared/lti-scopes.constants.js`, which
// its `exports` map does not export; a test pins the value to the mock Canvas's developer-key scope.
/** The scope ltijs asks for when it reads a roster; also the `scopes` of its cached token row. */
export const NRPS_SCOPE = 'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly';

/** A launch's platform as ltijs names it in the token cache: its issuer URL and our client ID there. */
export interface NrpsTokenPlatform {
  /** The platform's issuer (`Platform.url`). */
  readonly url: string;
  /** Our client ID on that platform. */
  readonly clientId: string;
}

/** Drops a platform's cached NRPS token. */
export type ForgetNrpsToken = (platform: NrpsTokenPlatform) => Promise<void>;

/**
 * Builds the function that drops a platform's cached NRPS token.
 * @param db - The database ltijs's token cache lives in.
 * @returns A function that deletes the token row, if there is one; it resolves either way.
 * @example
 * const forget = forgetNrpsToken(db);
 * await forget(launch.platform); // the next getMembers asks Canvas for a new token
 * @spec LTI-008
 */
export function forgetNrpsToken(db: Database): ForgetNrpsToken {
  return async ({ url, clientId }) => {
    // WHY: `deleteMany`, so a row that is already gone (another node forgot it first) is no error.
    await db.ltiAccessToken.deleteMany({ where: { platformUrl: url, clientId, scopes: NRPS_SCOPE } });
  };
}
