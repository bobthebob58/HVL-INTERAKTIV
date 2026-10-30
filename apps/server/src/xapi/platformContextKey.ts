/**
 * platformContextKey — builds and parses the platform-scoped course context `<LtiPlatform.id>:<context ID>` that
 * statements, snapshots, the NRPS count and insight store and compare.
 *
 * Why: a Canvas context ID is unique within one Canvas only, and HVL's test and beta instances copy production's
 *      course IDs, so a bare ID could merge two courses in insight. D-103 scopes every stored context by its platform
 *      and has one module build and parse the string, so nothing else joins or splits it.
 * Spec: DATA-012, LTI-008, INS-007
 * Invariants:
 *   - The platform ID is a lower-case UUID (`LtiPlatform.id`); the first `:` splits the key, whatever the context ID
 *     holds, so a context ID with colons survives a round trip.
 *   - A key always matches the contract's `PLATFORM_CONTEXT` and the database's CHECK on `XapiStatement.contextId`;
 *     building one from anything else throws (a programming error), so no malformed context is ever stored.
 *   - The context ID is the launch's context claim (`idToken.launch.context.id`, `LtiLaunchFacts.contextId`), never
 *     ltijs's `LaunchContext.contextId` (CLAUDE.md §5). A portal play has no context: null.
 * Collaborators: @hvl-interaktiv/api-contract (`PLATFORM_CONTEXT`), ../auth/Principal.ts, ./xapiTarget.ts;
 *   the NRPS counter and the insight scope (S6 steps 3–4) build and read their keys here.
 * Tests: apps/server/test/xapi/xapiStatementRow.test.ts, apps/server/test/xapi/xapiRouteAuth.int.test.ts
 */
import { PLATFORM_CONTEXT } from '@hvl-interaktiv/api-contract';
import type { Principal } from '../auth/Principal.js';

/** A platform-scoped context key, split into its parts. */
export interface PlatformContext {
  /** `LtiPlatform.id`, a lower-case UUID. */
  readonly platformId: string;
  /** The launch's context claim, as the platform sent it. */
  readonly contextId: string;
}

/**
 * Builds the stored form of a Canvas course.
 * @param platformId - `LtiPlatform.id` of the launching platform.
 * @param contextId - The launch's context claim (`LtiLaunchFacts.contextId`).
 * @returns `<platformId>:<contextId>`.
 * @throws Error when the platform ID is not a lower-case UUID or the context ID is empty or over 255 characters.
 * @spec DATA-012
 */
export function platformContextKey(platformId: string, contextId: string): string {
  const key = `${platformId}:${contextId}`;
  // SECURITY: one malformed key would fail its whole batch at the database's CHECK; refusing it here names the cause.
  // WHY: the pattern starts with a UUID and a colon, so the first colon must also end the platform ID given here.
  if (!PLATFORM_CONTEXT.test(key) || key.indexOf(':') !== platformId.length) {
    throw new Error(
      'a platform context needs a lower-case platform UUID and a context ID of 1–255 characters',
    );
  }
  return key;
}

/**
 * Splits a stored context key.
 * @param key - A value built by `platformContextKey`.
 * @returns The platform and context IDs, or undefined for anything that is not a platform context key.
 */
export function parsePlatformContextKey(key: string): PlatformContext | undefined {
  if (!PLATFORM_CONTEXT.test(key)) return undefined;
  const colon = key.indexOf(':');
  return { platformId: key.slice(0, colon), contextId: key.slice(colon + 1) };
}

/**
 * The stored context of a request: the Canvas course of an LTI principal's launch, or none in the portal.
 * @param principal - Who made the request.
 * @returns `<platformId>:<contextId>` for an LTI principal; null for a portal principal.
 * @throws Error when the launch's facts cannot form a key (see `platformContextKey`).
 * @spec DATA-012
 */
export function principalContextKey(principal: Pick<Principal, 'lti'>): string | null {
  return principal.lti ? platformContextKey(principal.lti.platformId, principal.lti.contextId) : null;
}
