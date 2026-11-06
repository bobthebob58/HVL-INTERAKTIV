/**
 * lineItemUrlPolicy — decides whether a placement's AGS line item URL may receive a learner's score: its origin must
 * be one of Canvas's configured origins or one of the platform's own, over https where https is required.
 *
 * Why: the grade worker sends the learner's `sub` and a bearer token to the `lineItemUrl` that the launch's AGS claim
 *      names (LTI-012). Canvas serves AGS on the institution's own domain, the domain `CANVAS_ORIGINS` already lists
 *      for framing (docs/reference/canvas-platform-values.md §1). D-104's amendment of 2026-11-04 (the step-3
 *      security review, finding 2) allows only those origins and the platform's own configured ones, so a launch can
 *      never point the worker, its token or a learner's ID at another host.
 * Spec: LTI-012, DATA-002
 * Invariants:
 *   - SECURITY: a URL is allowed only when it parses, uses http or https, holds no user name or password, uses https
 *     when the rules require it (production), and its origin equals an allowed origin exactly (scheme, host, port).
 *   - The platform's own origins are those of its issuer (`LtiPlatform.url`; a self-hosted Canvas serves AGS on its
 *     issuer's host) and of its authorisation and token endpoints; a value that is not an http(s) URL adds none.
 *   - Pure: the callers read the platform's row; nothing here does I/O or logs.
 * Collaborators: ../lti/placements/LtiPlacementRecorder.ts (at each launch), ./gradeJobSend.ts (before each send).
 * Tests: apps/server/test/grades/lineItemUrlPolicy.test.ts
 */

/** Which line item URLs are allowed beyond the platform's own origins; the server passes its configuration. */
export interface LineItemUrlRules {
  /** `CANVAS_ORIGINS`: the Canvas origins, which serve AGS (canvas-platform-values.md §1). */
  readonly origins?: readonly string[];
  /** True in production (`NODE_ENV=production`): an http line item is refused, whatever its origin. */
  readonly requireHttps?: boolean;
}

/** A platform's configured URLs, as `LtiPlatform` stores them. */
export interface PlatformUrls {
  /** The issuer. */
  readonly url: string;
  readonly authenticationEndpoint: string;
  readonly accessTokenEndpoint: string;
}

/** Why a line item URL is refused: not a URL, credentials in it, its scheme, or its origin. */
export type LineItemUrlRefusal = 'invalid' | 'credentials' | 'scheme' | 'origin';

const WEB_SCHEMES: readonly string[] = ['http:', 'https:'];

/**
 * The origin of an http(s) URL.
 * @param value - Any text.
 * @returns `scheme://host[:port]`, or undefined when the text is not an http(s) URL.
 */
export function webOriginOf(value: string): string | undefined {
  if (!URL.canParse(value)) return undefined;
  const url = new URL(value);
  return WEB_SCHEMES.includes(url.protocol) ? url.origin : undefined;
}

/**
 * The origins of a platform's own configured URLs.
 * @param platform - The platform's issuer and endpoints.
 * @returns Their distinct origins.
 */
export function platformOrigins(platform: PlatformUrls): string[] {
  const urls = [platform.url, platform.authenticationEndpoint, platform.accessTokenEndpoint];
  return [...new Set(urls.map(webOriginOf).filter((origin): origin is string => origin !== undefined))];
}

/**
 * Says why a line item URL may not receive scores, if it may not.
 * @param lineItemUrl - The URL from the launch's AGS claim, or as stored on the placement.
 * @param platform - The placement's platform.
 * @param rules - `CANVAS_ORIGINS` and the https rule; none allows only the platform's own origins, over any scheme.
 * @returns The refusal, or undefined when the URL is allowed.
 * @spec LTI-012
 */
export function lineItemUrlRefusal(
  lineItemUrl: string,
  platform: PlatformUrls,
  rules: LineItemUrlRules = {},
): LineItemUrlRefusal | undefined {
  if (!URL.canParse(lineItemUrl)) return 'invalid';
  const url = new URL(lineItemUrl);
  if (!WEB_SCHEMES.includes(url.protocol)) return 'invalid';
  // SECURITY: `https://canvas@evil.example/` names evil.example; credentials have no place in an AGS URL at all.
  if (url.username !== '' || url.password !== '') return 'credentials';
  if (rules.requireHttps && url.protocol !== 'https:') return 'scheme';
  const allowed = new Set([...(rules.origins ?? []), ...platformOrigins(platform)]);
  return allowed.has(url.origin) ? undefined : 'origin';
}
