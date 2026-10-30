/**
 * canvasTypes.d.mts — the TypeScript shapes of the mock Canvas (./mockCanvas.mjs and its modules); type-only, it
 * has no JavaScript twin.
 *
 * Why: apps/server tests are strict TypeScript; ./mockPlatform.d.mts re-exports these shapes for them (D-049).
 * Spec: LTI-001, LTI-003, LTI-005, LTI-008, LTI-012
 * Invariants: the shapes match what ./mockCanvas.mjs returns and accepts; the service controls' shapes live in
 *   ./canvasServiceTypes.d.mts.
 * Collaborators: ./mockPlatform.d.mts, ./mockCanvas.mjs, ./canvasIdTokens.mjs, ./deepLinkReturn.mjs,
 *   ./canvasServiceTypes.d.mts.
 * Tests: tools/mock-platform/test/mockCanvas.test.mjs (behaviour); `npx tsc -p apps/server --noEmit` (callers).
 */
import type { JWK } from 'jose';
import type { MockCanvasAgs, MockCanvasNrps, MockCanvasTokens } from './canvasServiceTypes.mjs';

/** A Canvas user as a launch sends it; `name`/`email` only above privacy level `anonymous`. */
export interface CanvasUser {
  sub: string;
  /** LTI role URIs; read-only, so the frozen `CANVAS_USERS` lists can be passed as they are. */
  roles: readonly string[];
  name?: string;
  email?: string;
  /** Substituted for `$Canvas.user.loginId` in custom fields. */
  loginId?: string;
}

/** What the mock Canvas launches. Defaults: the demo student, course `mock-course-1`, locale `nn`. */
export interface LaunchSpec {
  messageType?: 'LtiResourceLinkRequest' | 'LtiDeepLinkingRequest';
  user?: CanvasUser;
  course?: { id: string; title?: string; label?: string };
  resourceLinkId?: string;
  custom?: Record<string, string>;
  /** Sent as `https://www.instructure.com/placement`, e.g. `assignment_selection`. */
  placement?: string;
  /** Deep Linking `accept_multiple`; default false for `assignment_selection`, else true. */
  acceptMultiple?: boolean;
  /** Deep Linking `data`; default a fresh random value. */
  deepLinkData?: string;
  locale?: string;
  /** A line item ID or URL for the AGS claim's `lineitem`. */
  lineItem?: string;
  /** Sends `lti_storage_target` and shows the Platform Storage frame. */
  platformStorage?: boolean;
  /** Default: the platform's deployment; another value simulates an unknown deployment. */
  deploymentId?: string;
  /** Default `<toolUrl>/lti/launch`. */
  targetLinkUri?: string;
}

/** The parameters of a third-party-initiated login. */
export interface LoginInitiationParams {
  iss: string;
  login_hint: string;
  target_link_uri: string;
  lti_message_hint: string;
  client_id: string;
  lti_deployment_id: string;
  lti_storage_target?: string;
}

/** An ID token for the tool, to be form-posted to `action`. */
export interface AuthorizeSuccess {
  action: string;
  idToken: string;
  state: string;
}

/** A refused authentication request (OIDC error code and Canvas's description). */
export interface AuthorizeRefusal {
  error: string;
  error_description: string;
  state?: string;
}

/** A problem code of a Deep Linking response, in the order ./deepLinkReturn.mjs checks them. */
export type DeepLinkProblem =
  | 'invalid-jwt'
  | 'wrong-alg'
  | 'unknown-kid'
  | 'bad-signature'
  | 'jwks-unavailable'
  | 'wrong-iss'
  | 'wrong-aud'
  | 'wrong-deployment'
  | 'missing-nonce'
  | 'reused-nonce'
  | 'wrong-message-type'
  | 'wrong-version'
  | 'data-mismatch'
  | 'bad-iat'
  | 'expired'
  | 'bad-content-items'
  | 'too-many-items'
  | 'unaccepted-type'
  | 'foreign-url';

/** One Deep Linking response the mock Canvas received and checked. */
export interface DeepLinkResponseRecord {
  /** True when `problems` is empty. */
  ok: boolean;
  problems: DeepLinkProblem[];
  jwt: string;
  header: Record<string, unknown>;
  /** The decoded claims, also when the signature is wrong. */
  claims: Record<string, unknown>;
  items: Array<Record<string, unknown>>;
  /** `exp - iat` in seconds. */
  lifetime: number | undefined;
  /** The Deep Linking request whose `data` the response carried. */
  request: { placement: string | undefined; acceptMultiple: boolean; data: string } | undefined;
  receivedAt: string;
}

/** The mock Canvas as an `LtiPlatformConfig` entry of `LTI_PLATFORMS`. */
export interface MockCanvasPlatformConfig {
  name: string;
  issuer: string;
  clientId: string;
  authEndpoint: string;
  tokenEndpoint: string;
  jwksUrl: string;
  deployments: string[];
  /** Always true: the mock sends the demo user's Feide ID as `feide_login` (AUTH-005, D-063). */
  feideLinking: boolean;
}

/** A running mock Canvas. */
export interface MockCanvas {
  /** `http://127.0.0.1:<port>`; also the issuer. */
  origin: string;
  issuer: string;
  clientId: string;
  deploymentId: string;
  toolUrl: string;
  authEndpoint: string;
  /** The client-credentials token endpoint of the AGS and NRPS services. */
  tokenEndpoint: string;
  jwksUrl: string;
  publicJwk: JWK & { kid: string };
  platformConfig: MockCanvasPlatformConfig;
  deepLinkResponses: DeepLinkResponseRecord[];
  /** The token endpoint: its requests, token revocation and faults. */
  tokens: MockCanvasTokens;
  /** AGS: line items, recorded scores and faults. */
  ags: MockCanvasAgs;
  /** NRPS: course rosters and faults. */
  nrps: MockCanvasNrps;
  /** Drops every queued fault of every service. */
  clearFaults(): void;
  /** Creates a single-use login (expires after 5 minutes) and returns its login-initiation parameters. */
  loginInitiation(spec?: LaunchSpec): LoginInitiationParams;
  /** Checks an authentication request (object, form fields or the full URL) like Canvas does. */
  authorize(
    params: Record<string, string | undefined> | URLSearchParams | URL | string,
  ): Promise<AuthorizeSuccess | AuthorizeRefusal>;
  /** Correct ID-token claims for a launch and nonce, for negative tests that change them. */
  idTokenClaims(spec: LaunchSpec, nonce: string): Record<string, unknown>;
  /** Signs claims with the platform key (default) or the unpublished foreign key, under the platform `kid`. */
  signIdToken(
    claims: Record<string, unknown>,
    options?: { key?: 'platform' | 'foreign'; kid?: string },
  ): Promise<string>;
  /** Stores a launch and returns its course page URL; every load of the page starts a fresh login. */
  coursePageUrl(spec?: LaunchSpec): string;
  /** Checks a Deep Linking response JWT against `<toolUrl>/lti/keys` and records it. */
  verifyDeepLinkResponse(jwt: string): Promise<DeepLinkResponseRecord>;
  close(): Promise<void>;
}
