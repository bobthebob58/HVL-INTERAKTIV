/**
 * mockPlatform.d.mts — types for TypeScript callers of ./mockPlatform.mjs, e.g. apps/server tests that import
 * '../../../tools/mock-platform/mockPlatform.mjs'.
 *
 * Why: the server's integration and end-to-end tests are strict TypeScript; the mock is plain ESM JavaScript like
 *      the other tools (D-049). These declarations describe exactly what ./mockPlatform.mjs exports.
 * Spec: LTI-001, LTI-003, LTI-005, AUTH-001, AUTH-002
 * Invariants: every value export of ./mockPlatform.mjs is declared here with the same name; the object shapes live
 *   in ./feideTypes.d.mts and ./canvasTypes.d.mts and are re-exported.
 * Collaborators: ./mockPlatform.mjs, ./feideTypes.d.mts, ./canvasTypes.d.mts.
 * Tests: tools/mock-platform/test/ (behaviour); `npx tsc -p apps/server --noEmit` checks callers against these types.
 */
import type { CanvasUser, MockCanvas } from './canvasTypes.mjs';
import type { FeideUserSpec, MockFeide } from './feideTypes.mjs';

export type * from './canvasTypes.mjs';
export type * from './feideTypes.mjs';

/** The six tool environment variables that point at the running mocks. */
export interface MockPlatformEnv {
  FEIDE_ISSUER: string;
  FEIDE_GROUPS_API_URL: string;
  FEIDE_CLIENT_ID: string;
  FEIDE_CLIENT_SECRET: string;
  CANVAS_ORIGINS: string;
  /** JSON: an array with one `LtiPlatformConfig` (apps/server/src/config/envParsers.ts). */
  LTI_PLATFORMS: string;
}

/** Options of {@link startMockPlatform}. */
export interface MockPlatformOptions {
  /** The tool's base URL, e.g. `http://localhost:3000`. */
  toolUrl: string;
  canvasPort?: number;
  feidePort?: number;
}

/** Both running mocks and the environment that points at them. */
export interface MockPlatform {
  canvas: MockCanvas;
  feide: MockFeide;
  env: MockPlatformEnv;
  close(): Promise<void>;
}

/** Starts the mock Feide and the mock Canvas. Rejects with a TypeError for a tool URL that is not http(s). */
export function startMockPlatform(options: MockPlatformOptions): Promise<MockPlatform>;
/** Starts a mock Feide alone. */
export function startMockFeide(options?: {
  port?: number;
  host?: string;
  clientId?: string;
  clientSecret?: string;
}): Promise<MockFeide>;
/** Starts a mock Canvas alone. */
export function startMockCanvas(options: {
  toolUrl: string;
  port?: number;
  host?: string;
  clientId?: string;
  deploymentId?: string;
  launchTtlSeconds?: number;
}): Promise<MockCanvas>;

/** The preloaded demo users. */
export const FEIDE_DEMO_USERS: readonly FeideUserSpec[];
/** `https://n.feide.no/claims/eduPersonPrincipalName`. */
export const FEIDE_ID_CLAIM: 'https://n.feide.no/claims/eduPersonPrincipalName';
/** `https://n.feide.no/claims/userid_sec`. */
export const USERID_SEC_CLAIM: 'https://n.feide.no/claims/userid_sec';
/** LTI 1.3 / Deep Linking claim names, plus Canvas's placement claim. */
export const LTI_CLAIM: Readonly<
  Record<
    | 'messageType'
    | 'version'
    | 'deploymentId'
    | 'targetLinkUri'
    | 'roles'
    | 'context'
    | 'resourceLink'
    | 'custom'
    | 'launchPresentation'
    | 'toolPlatform'
    | 'deepLinkingSettings'
    | 'contentItems'
    | 'data'
    | 'agsEndpoint'
    | 'namesRoleService'
    | 'placement',
    string
  >
>;
/** LTI role URIs. */
export const LTI_ROLE: Readonly<
  Record<
    | 'learner'
    | 'instructor'
    | 'administrator'
    | 'institutionStudent'
    | 'institutionInstructor'
    | 'systemUser',
    string
  >
>;
/** Canvas demo users; the teacher's `loginId` is the Feide demo author's Feide ID. */
export const CANVAS_USERS: Readonly<{ teacher: Readonly<CanvasUser>; student: Readonly<CanvasUser> }>;
/** The two message types the mock Canvas launches. */
export const MESSAGE_TYPE: Readonly<{
  resourceLink: 'LtiResourceLinkRequest';
  deepLinking: 'LtiDeepLinkingRequest';
}>;
/** Canvas's description of an expired or used login. */
export const LAUNCH_GONE: string;
/** The frame name sent as `lti_storage_target` (`post_message_forwarding`). */
export const STORAGE_TARGET: 'post_message_forwarding';
