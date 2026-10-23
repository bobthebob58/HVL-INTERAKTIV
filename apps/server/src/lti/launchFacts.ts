/**
 * launchFacts — the few facts of an LTI launch our code uses, read from ltijs's parsed ID token.
 *
 * Why: the launch handlers, the ltik resolver and the Deep Linking routes all need the platform, deployment,
 *      course, resource link, activity and line item. Reading them in one place keeps the ltijs `contextId` trap out
 *      (it is a record ID; the course is `launch.context.id`, D-050) and validates the untrusted custom field.
 * Spec: LTI-001, LTI-006, LTI-003
 * Invariants:
 *   - `contextId` is the Canvas course (`launch.context.id`), never ltijs's `LaunchContext.contextId`.
 *   - `contentId` is set only when `custom.contentId` is a UUID; anything else counts as missing.
 *   - The `sub` is returned for hashing in memory only; callers never store or log it.
 * Collaborators: ./ltikPrincipal.ts, ./launch/onResourceLink.ts, ./launch/onDeepLinking.ts.
 * Tests: apps/server/test/lti/launchFacts.test.ts
 */
import type { IdToken } from 'ltijs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The launch facts our code uses. */
export interface LaunchFacts {
  /** The platform's issuer (`iss`). */
  readonly issuer: string;
  /** The user's `sub` (in memory only). */
  readonly subject: string;
  /** `LtiPlatform.id`. */
  readonly platformId: string;
  /** The launch's deployment ID. */
  readonly deploymentId: string;
  /** `LtiResourceLinkRequest`, `LtiDeepLinkingRequest`, … */
  readonly messageType: string;
  /** The Canvas course, or '' when the launch has no context. */
  readonly contextId: string;
  /** The resource link, for resource-link launches. */
  readonly resourceLinkId?: string;
  /** The activity in `custom.contentId`, when it is a UUID. */
  readonly contentId?: string;
  /** The AGS line item, when the placement is graded. */
  readonly lineItemUrl?: string;
  /** The raw LTI role claims. */
  readonly roles: readonly string[];
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

/**
 * Reads the launch facts.
 * @param idToken - ltijs's parsed ID token (`LaunchContext.idToken`).
 * @returns The facts.
 */
export function launchFactsOf(idToken: IdToken): LaunchFacts {
  const custom = idToken.launch.custom ?? {};
  const contentId = text(custom.contentId);
  const resourceLinkId = text(idToken.launch.resource?.id);
  const lineItemUrl = text(idToken.services.assignmentAndGrades.lineItemId);
  return {
    issuer: idToken.platform.url,
    subject: idToken.user.id,
    platformId: idToken.platform.id,
    deploymentId: idToken.platform.deploymentId,
    messageType: idToken.launch.type,
    contextId: text(idToken.launch.context?.id) ?? '',
    roles: [...idToken.user.roles],
    ...(resourceLinkId ? { resourceLinkId } : {}),
    ...(contentId && UUID.test(contentId) ? { contentId: contentId.toLowerCase() } : {}),
    ...(lineItemUrl ? { lineItemUrl } : {}),
  };
}
