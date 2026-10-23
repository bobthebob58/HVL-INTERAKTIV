/**
 * linkingPlatforms — which LTI platforms may link Canvas and Feide identities through `custom.feide_login`.
 *
 * Why: AUTH-005 trusts `feide_login` only from a platform where a test launch confirmed it is the Feide ID (Q4).
 *      That is configured per developer key as `"feideLinking": true` in `LTI_PLATFORMS` (D-063); this function is
 *      the one place that reads it, so it can be tested without a launch.
 * Spec: AUTH-005
 * Invariants:
 *   - A platform counts only when both its issuer and its client ID equal a configured entry exactly, and that entry
 *     has `feideLinking: true`; an unknown platform, another client of the same issuer, or a case variant never
 *     links.
 * Collaborators: ../config/envParsers.ts (`feideLinking`), ./ltiRoutes.ts, ../auth/identity/accountLinking.ts.
 * Tests: apps/server/test/lti/linkingPlatforms.test.ts
 */
import type { LtiPlatformConfig } from '../config/envParsers.js';

/**
 * Builds the platform check for account linking.
 * @param platforms - `LTI_PLATFORMS`.
 * @returns A check of a launch's issuer and client ID.
 * @spec AUTH-005
 */
export function platformLinksFeide(
  platforms: readonly LtiPlatformConfig[],
): (issuer: string, clientId: string) => boolean {
  const linking = platforms.filter((platform) => platform.feideLinking);
  return (issuer, clientId) =>
    linking.some((platform) => platform.issuer === issuer && platform.clientId === clientId);
}
