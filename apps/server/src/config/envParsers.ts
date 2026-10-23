/**
 * envParsers — zod transforms for the structured environment variables: lists, origins, key rings and the
 * `LTI_PLATFORMS` JSON.
 *
 * Why: `env.ts` keeps one line per variable (doc-lint reads it as `NAME: z…`), so the multi-step parsing of
 *      Session 3's variables lives here. Every parser turns bad input into a zod issue that names the problem
 *      without echoing the value, because some values are secrets.
 * Spec: DOC-008, LTI-001, LTI-003, AUTH-002, DATA-002
 * Invariants:
 *   - Lists are comma-separated; blanks around entries and empty entries are ignored.
 *   - An origin is `scheme://host[:port]` exactly as `URL.origin` prints it (no path, no trailing slash).
 *   - `LTI_PLATFORMS` is a JSON array; a platform is identified by `(issuer, clientId)` (every hosted Canvas
 *     shares one issuer), and each lists at least one deployment ID (D-051).
 *   - Messages never contain a key, and contain other values only where they are not secret.
 * Collaborators: ./env.ts, ../security/keys/keyring.ts, ../lti/platforms/syncLtiPlatforms.ts.
 * Tests: apps/server/test/config/envParsers.test.ts
 */
import { z } from 'zod';
import { parseKeyring, type Keyring } from '../security/keys/keyring.js';

/**
 * Splits a comma-separated list.
 * @param raw - e.g. `a, b,,c`.
 * @returns The non-empty, trimmed entries.
 */
export const splitList = (raw: string): string[] =>
  raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');

/** The context zod passes to a transform, used to report a problem. */
type Ctx = z.core.$RefinementCtx;

const fail = (ctx: Ctx, message: string): typeof z.NEVER => {
  ctx.addIssue({ code: 'custom', message });
  return z.NEVER;
};

/** An http(s) URL, as zod 4 checks it. */
export const httpUrl = () => z.url({ protocol: /^https?$/, error: 'must be an http:// or https:// URL' });

/**
 * Transform for a key ring variable (D-055, D-056, D-058).
 * @param raw - `id=base64,…`.
 * @param ctx - zod's transform context.
 * @returns The ring.
 */
export const toKeyring = (raw: string, ctx: Ctx): Keyring => {
  try {
    return parseKeyring(raw);
  } catch (error) {
    return fail(ctx, (error as Error).message);
  }
};

/**
 * Transform for a list of web origins, e.g. `CANVAS_ORIGINS`.
 * @param raw - Comma-separated origins.
 * @param ctx - zod's transform context.
 * @returns The origins.
 */
export const toOriginList = (raw: string, ctx: Ctx): string[] =>
  splitList(raw).map((entry, index) => {
    const parsed = URL.canParse(entry) ? new URL(entry) : undefined;
    if (!parsed || !/^https?:$/.test(parsed.protocol) || parsed.origin !== entry) {
      fail(ctx, `entry ${index + 1} is not an origin like https://host`);
    }
    return entry;
  });

/**
 * Transform for a base URL without a path, e.g. `PUBLIC_BASE_URL`.
 * @param raw - An http(s) URL.
 * @param ctx - zod's transform context.
 * @returns Its origin.
 */
export const toOrigin = (raw: string, ctx: Ctx): string => {
  const parsed = new URL(raw);
  if (parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '') {
    fail(ctx, 'must be an origin without a path, e.g. https://host');
  }
  return parsed.origin;
};

/**
 * Builds a transform for a list of lower-cased entries that must each match a pattern.
 * @param pattern - What a valid entry looks like (tested after lower-casing).
 * @param what - Words for the error message, e.g. `a Feide ID like name@hvl.no`.
 * @returns The transform.
 */
export const toMatchingList =
  (pattern: RegExp, what: string) =>
  (raw: string, ctx: Ctx): string[] =>
    splitList(raw).map((entry, index) => {
      const value = entry.toLowerCase();
      if (!pattern.test(value)) fail(ctx, `entry ${index + 1} is not ${what}`);
      return value;
    });

/** A Feide ID (`eduPersonPrincipalName`, lower-cased, D-054). */
export const FEIDE_ID_PATTERN = /^[^@\s,]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;
/** A Feide realm, e.g. `hvl.no`. */
export const FEIDE_REALM_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
/** A Feide group ID or prefix, e.g. `fc:fs:fs:emne:hvl.no:ppu` (D-059); a trailing `:` could never match. */
export const FEIDE_GROUP_PATTERN = /^fc:[a-z0-9:._-]*[a-z0-9._-]$/;

/** One LTI platform (a Canvas developer key) as configured in `LTI_PLATFORMS`. */
export const ltiPlatformSchema = z.strictObject({
  /** A readable name for logs and the admin view. */
  name: z.string().min(1).max(100),
  /** The `iss` claim, e.g. `https://canvas.instructure.com`. */
  issuer: httpUrl(),
  /** The developer key's client ID. */
  clientId: z.string().min(1).max(255),
  /** The OIDC authorisation endpoint, e.g. `https://sso.canvaslms.com/api/lti/authorize_redirect`. */
  authEndpoint: httpUrl(),
  /** The OAuth 2 token endpoint for LTI Advantage services. */
  tokenEndpoint: httpUrl(),
  /** The platform's public JWKS. */
  jwksUrl: httpUrl(),
  /** The deployment IDs launches may carry (D-051). */
  deployments: z.array(z.string().min(1).max(255)).min(1),
  /** Link Canvas and Feide identities through `custom.feide_login` (AUTH-005, D-063); set only after a test launch
   *  confirmed that this platform sends the user's Feide ID there (Q4). */
  feideLinking: z.boolean().default(false),
});

/** One configured LTI platform. */
export type LtiPlatformConfig = z.infer<typeof ltiPlatformSchema>;

/** Every configured platform; `(issuer, clientId)` is unique. */
export const ltiPlatformList = z.array(ltiPlatformSchema).superRefine((platforms, ctx) => {
  const seen = new Set<string>();
  platforms.forEach((platform, index) => {
    const id = JSON.stringify([platform.issuer, platform.clientId]);
    if (seen.has(id)) fail(ctx, `platform ${index + 1} repeats an issuer and client ID`);
    seen.add(id);
  });
});

/**
 * Transform that parses JSON, e.g. `LTI_PLATFORMS` before `ltiPlatformList` checks it.
 * @param raw - The JSON text.
 * @param ctx - zod's transform context.
 * @returns The parsed value.
 */
export const toJson = (raw: string, ctx: Ctx): unknown => {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return fail(ctx, 'is not valid JSON');
  }
};
