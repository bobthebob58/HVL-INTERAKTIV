/**
 * canvasIdTokens — the launch specs, claims and RS256 signatures of the mock Canvas's LTI 1.3 launches
 * (resource link and Deep Linking 2.0).
 *
 * Why: the tool's launch checks (LTI-001), role mapping (LTI-004), placement handling (LTI-005, LTI-006, D-061),
 *      account linking (AUTH-005) and claim allowlist (D-052) must meet the claims Canvas really sends, including
 *      its placement claim and custom-variable substitution (docs/reference/canvas-platform-values.md).
 * Spec: LTI-001, LTI-004, LTI-005, LTI-006, LTI-008, LTI-012, AUTH-005
 * Invariants:
 *   - Claims follow LTI 1.3, Deep Linking 2.0 and Canvas: `iss` is the platform origin, `aud`/`azp` the client ID,
 *     the ID token lives one hour, and Canvas's placement claim is sent only when the spec names a placement.
 *   - The AGS claim lists the developer key's AGS scopes and comes only with at least one; the NRPS claim only with
 *     the NRPS scope, as in Canvas. Their URLs are the ones ./canvasServices.mjs serves.
 *   - `name` and `email` appear only when the spec's user has them (Canvas privacy levels above `anonymous`).
 *   - A custom value `$Canvas.user.loginId` becomes the user's `loginId`, or stays the literal when the user has
 *     none, as Canvas does when a substitution's guard fails.
 *   - Deep Linking requests carry a `data` value; Canvas expects it back unchanged in the response.
 * Collaborators: ./ltiVocabulary.mjs, ./mockCanvas.mjs, ./canvasPages.mjs, jose.
 * Tests: tools/mock-platform/test/mockCanvas.test.mjs
 */
import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { CANVAS_USERS, LTI_CLAIM, MESSAGE_TYPE, acceptedItemTypes } from './ltiVocabulary.mjs';

const LIS = 'http://purl.imsglobal.org/vocab/lis/v2/';

/**
 * Fills in a launch spec's defaults.
 * @param {object} [spec] - A launch spec (see `LaunchSpec` in ./mockPlatform.d.mts); may already be normalised.
 * @param {{toolUrl: string, deploymentId: string}} platform - Where the tool is and the default deployment.
 * @returns {object} The complete spec; a Deep Linking spec gets a fresh random `deepLinkData` unless it has one.
 * @throws {TypeError} For a message type the mock does not launch.
 */
export function normaliseLaunch(spec = {}, platform) {
  const messageType = spec.messageType ?? MESSAGE_TYPE.resourceLink;
  if (!Object.values(MESSAGE_TYPE).includes(messageType)) throw new TypeError(`unsupported ${messageType}`);
  const deepLinking = messageType === MESSAGE_TYPE.deepLinking;
  return {
    messageType,
    user: { ...(spec.user ?? CANVAS_USERS.student) },
    course: { id: 'mock-course-1', title: 'Mock course', ...spec.course },
    resourceLinkId: deepLinking ? undefined : (spec.resourceLinkId ?? 'mock-resource-link-1'),
    custom: { ...spec.custom },
    placement: spec.placement,
    acceptMultiple: spec.acceptMultiple ?? spec.placement !== 'assignment_selection',
    deepLinkData: deepLinking ? (spec.deepLinkData ?? randomUUID()) : undefined,
    locale: spec.locale ?? 'nn',
    lineItem: spec.lineItem,
    platformStorage: spec.platformStorage === true,
    deploymentId: spec.deploymentId ?? platform.deploymentId,
    targetLinkUri: spec.targetLinkUri ?? `${platform.toolUrl}/lti/launch`,
  };
}

/** Canvas's substitution of `$Canvas.user.loginId`; other values pass through as strings. */
const substituted = (custom, user) =>
  Object.fromEntries(
    Object.entries(custom).map(([name, value]) => [
      name,
      value === '$Canvas.user.loginId' && user.loginId !== undefined ? user.loginId : String(value),
    ]),
  );

/**
 * The `deep_linking_settings` claim Canvas sends for a placement (canvas-platform-values.md §5).
 * @param {{origin: string}} platform - The mock Canvas.
 * @param {object} launch - A normalised Deep Linking spec.
 * @returns {object} The settings.
 */
export const deepLinkingSettings = (platform, launch) => ({
  deep_link_return_url: `${platform.origin}/deep_linking_response`,
  accept_types: acceptedItemTypes(launch.placement),
  accept_presentation_document_targets: ['iframe', 'window'],
  accept_media_types: 'application/vnd.ims.lti.v1.ltilink',
  accept_multiple: launch.acceptMultiple,
  auto_create: false,
  data: launch.deepLinkData,
});

/**
 * The ID-token claims of a launch.
 * @param {{origin: string, clientId: string, scopes: readonly string[]}} platform - The mock Canvas and the scopes
 *   its developer key grants.
 * @param {object} launch - A normalised spec (`normaliseLaunch`).
 * @param {string} nonce - The nonce of the tool's authentication request.
 * @returns {Record<string, unknown>} The claims, issued now and valid for one hour.
 */
export function buildIdTokenClaims(platform, launch, nonce) {
  const { origin, clientId } = platform;
  const now = Math.floor(Date.now() / 1000);
  const course = encodeURIComponent(launch.course.id);
  const lineItems = `${origin}/api/lti/courses/${course}/line_items`;
  const claims = {
    iss: origin,
    aud: clientId,
    azp: clientId,
    sub: launch.user.sub,
    iat: now,
    exp: now + 3600,
    nonce,
    locale: launch.locale,
    [LTI_CLAIM.messageType]: launch.messageType,
    [LTI_CLAIM.version]: '1.3.0',
    [LTI_CLAIM.deploymentId]: launch.deploymentId,
    [LTI_CLAIM.targetLinkUri]: launch.targetLinkUri,
    [LTI_CLAIM.roles]: [...(launch.user.roles ?? [])],
    [LTI_CLAIM.context]: {
      id: launch.course.id,
      label: launch.course.label ?? launch.course.id,
      title: launch.course.title,
      type: [`${LIS}course#CourseOffering`],
    },
    [LTI_CLAIM.toolPlatform]: {
      guid: `mock-canvas-${clientId}`,
      name: 'Mock Canvas',
      product_family_code: 'canvas',
    },
    [LTI_CLAIM.launchPresentation]: { document_target: 'iframe', locale: launch.locale },
  };
  // WHY: Canvas sends each service claim only when the developer key has a scope for it (canvas-platform-values.md §4).
  const agsScopes = platform.scopes.filter((scope) => scope.includes('/lti-ags/'));
  if (agsScopes.length > 0) {
    claims[LTI_CLAIM.agsEndpoint] = {
      scope: agsScopes,
      lineitems: lineItems,
      ...(launch.lineItem && {
        lineitem: /^https?:/.test(launch.lineItem) ? launch.lineItem : `${lineItems}/${launch.lineItem}`,
      }),
    };
  }
  if (platform.scopes.some((scope) => scope.includes('/lti-nrps/'))) {
    claims[LTI_CLAIM.namesRoleService] = {
      context_memberships_url: `${origin}/api/lti/courses/${course}/names_and_roles`,
      service_versions: ['2.0'],
    };
  }
  if (launch.user.name) claims.name = launch.user.name;
  if (launch.user.email) claims.email = launch.user.email;
  if (Object.keys(launch.custom).length > 0)
    claims[LTI_CLAIM.custom] = substituted(launch.custom, launch.user);
  if (launch.placement) claims[LTI_CLAIM.placement] = launch.placement;
  if (launch.messageType === MESSAGE_TYPE.deepLinking) {
    claims[LTI_CLAIM.deepLinkingSettings] = deepLinkingSettings(platform, launch);
  } else claims[LTI_CLAIM.resourceLink] = { id: launch.resourceLinkId, title: 'Mock activity' };
  return claims;
}

/**
 * Signs claims as an RS256 JWT.
 * @param {Record<string, unknown>} claims - The payload, used as given.
 * @param {CryptoKey} privateKey - The signing key.
 * @param {string} kid - The `kid` header.
 * @returns {Promise<string>} The compact JWT.
 */
export const signJwt = (claims, privateKey, kid) =>
  new SignJWT(claims).setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid }).sign(privateKey);
