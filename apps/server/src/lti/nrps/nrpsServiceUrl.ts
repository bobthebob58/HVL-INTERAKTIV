/**
 * nrpsServiceUrl — reads the Names and Roles service URL a launch names (`context_memberships_url`) and decides
 * whether the course count may be read from it: the rule D-104 sets for a line item's URL, applied to the roster's.
 *
 * Why: ltijs asks Canvas's token endpoint for an NRPS token and sends it, as a bearer, to the URL the launch's NRPS
 *      claim names (LTI-008). Nothing checked that URL, as D-104's amendment of 2026-11-04 found for the AGS line
 *      item. D-106's amendment of the same day (the step-4 privacy review) applies the same rule here, so a launch can
 *      never point the count, its token or the roster's request at another host.
 * Spec: LTI-008, INS-001
 * Invariants:
 *   - SECURITY: the URL must be a string that `lineItemUrlRefusal` allows: it parses, uses http or https, holds no
 *     user name or password, uses https where the rules require it (production), and has an origin in the rules'
 *     origins (`CANVAS_ORIGINS`) or one of the platform's own (its issuer and its two endpoints).
 *   - A launch without the claim's URL is refused as `invalid`; the caller checks availability first.
 *   - Pure: nothing here does I/O or logs.
 * Collaborators: ../../grades/lineItemUrlPolicy.ts (the rule), ./NrpsLearnerCounter.ts (the caller), ltijs
 *   `LaunchContext.rawIdToken` and `LaunchContext.platform`.
 * Tests: apps/server/test/lti/nrps/NrpsLearnerCounter.test.ts, apps/server/test/lti/launch/onResourceLinkNrps.test.ts
 */
import {
  lineItemUrlRefusal,
  webOriginOf,
  type LineItemUrlRefusal,
  type LineItemUrlRules,
  type PlatformUrls,
} from '../../grades/lineItemUrlPolicy.js';

/** The NRPS claim of an LTI 1.3 ID token. */
export const NRPS_CLAIM = 'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice';

/** What the check reads of a launch (ltijs's `LaunchContext` fits it). */
export interface NrpsServiceLaunch {
  /** The launch's platform: its issuer and endpoints, as `LtiPlatform` stores them. */
  readonly platform: PlatformUrls;
  /** The ID token's claims as ltijs stored them. */
  readonly rawIdToken: { readonly [NRPS_CLAIM]?: { readonly context_memberships_url?: unknown } };
}

/** Why the roster URL is refused, with its origin when it has one, for the log. */
export interface NrpsUrlRefusal {
  readonly reason: LineItemUrlRefusal;
  /** `scheme://host[:port]` of the refused URL, or undefined when it is not an http(s) URL. */
  readonly origin: string | undefined;
}

/**
 * Says why the course's roster may not be read from the URL the launch names, if it may not.
 * @param launch - The launch's platform and ID token.
 * @param rules - `CANVAS_ORIGINS` and the https rule; none allows only the platform's own origins.
 * @returns The refusal and the URL's origin, or undefined when the roster may be read.
 * @spec LTI-008
 */
export function nrpsUrlRefusal(
  launch: NrpsServiceLaunch,
  rules: LineItemUrlRules = {},
): NrpsUrlRefusal | undefined {
  const url = launch.rawIdToken[NRPS_CLAIM]?.context_memberships_url;
  if (typeof url !== 'string') return { reason: 'invalid', origin: undefined };
  // SECURITY: D-104's line-item rule, for the roster's URL too (D-106's amendment of 2026-11-04).
  const reason = lineItemUrlRefusal(url, launch.platform, rules);
  return reason === undefined ? undefined : { reason, origin: webOriginOf(url) };
}
