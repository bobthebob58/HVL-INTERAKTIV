/**
 * ltiLaunchClaims — the claims of a Canvas LTI 1.3 launch for storage tests: everything a real launch can carry,
 * including the personal data that must never be stored, and the exact subset the storage may keep.
 *
 * Why: the claim allowlist (D-052, DATA-002) is tested on its own, through PrismaLtiDatabaseManager and through a
 *      real ltijs launch. One fixture keeps those tests about the same claims, and writing the expected stored
 *      claims out by hand (not by calling the allowlist) keeps the tests independent of the code they check.
 * Spec: LTI-002, DATA-002
 * Invariants:
 *   - `storedLaunchClaims` is `canvasLaunchClaims` minus every personal, unknown or unlisted claim and field.
 *   - None of `PERSONAL_VALUES` appears anywhere in `storedLaunchClaims`.
 * Collaborators: ../../../src/lti/storage/ltiIdTokenClaims.ts (the allowlist under test).
 * Tests: apps/server/test/lti/storage/ltiIdTokenClaims.test.ts,
 *   apps/server/test/lti/storage/PrismaLtiDatabaseManager.int.test.ts,
 *   apps/server/test/lti/storage/ltijsOnPrismaStorage.int.test.ts
 */
import { LtiMessageType, type IdTokenClaims } from 'ltijs';

const LTI = 'https://purl.imsglobal.org/spec/lti/claim/';
const AGS = 'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint';
const NRPS = 'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice';
const DEEP_LINKING = 'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings';
const CANVAS_PLACEMENT = 'https://www.instructure.com/placement';
const INSTRUCTOR = 'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor';

/** The activity ID the launch carries in `custom.contentId`. */
export const LAUNCH_CONTENT_ID = '0192f0c4-1111-7000-8000-000000000001';

/** Personal values in `canvasLaunchClaims`; none of them may reach storage. */
export const PERSONAL_VALUES: readonly string[] = [
  'Kari Nordmann',
  'kari@example.test',
  'https://canvas.example.test/images/kari.png',
  'kari.nordmann@hvl.no',
  'sis-person-12345',
  'admin@canvas.example.test',
  'legacy-user-7',
  'mentor-of-ola',
];

/** Who launches, from where, and when. */
export interface LaunchClaimsInput {
  /** The platform's issuer (`LtiPlatform.url`). */
  readonly iss: string;
  /** The tool's client ID at the platform. */
  readonly clientId: string;
  /** ltijs's platform ID (`LtiPlatform.id`). */
  readonly platformId: string;
  /** The deployment the launch names. */
  readonly deploymentId: string;
  /** The user's LTI subject; defaults to `canvas-user-1`. */
  readonly sub?: string;
  /** Issued-at time in seconds; defaults to now. */
  readonly iat?: number;
}

const common = (input: LaunchClaimsInput) => {
  const iat = input.iat ?? Math.floor(Date.now() / 1000);
  return {
    iss: input.iss,
    sub: input.sub ?? 'canvas-user-1',
    aud: input.clientId,
    azp: input.clientId,
    iat,
    exp: iat + 300,
    client_id: input.clientId,
    platform_id: input.platformId,
    [`${LTI}deployment_id`]: input.deploymentId,
    [`${LTI}message_type`]: LtiMessageType.DeepLinkingRequest,
    [`${LTI}version`]: '1.3.0',
    [`${LTI}roles`]: [INSTRUCTOR],
    [`${LTI}target_link_uri`]: 'https://tool.example.test/lti/launch',
    [CANVAS_PLACEMENT]: 'assignment_selection',
  };
};

const SERVICES = {
  [AGS]: {
    scope: ['https://purl.imsglobal.org/spec/lti-ags/scope/score'],
    lineitems: 'https://canvas.example.test/api/lti/courses/1/line_items',
    lineitem: 'https://canvas.example.test/api/lti/courses/1/line_items/7',
  },
  [NRPS]: {
    context_memberships_url: 'https://canvas.example.test/api/lti/courses/1/names_and_roles',
    service_versions: ['2.0'],
  },
};

const DEEP_LINKING_SETTINGS = {
  deep_link_return_url: 'https://canvas.example.test/courses/1/deep_linking_response',
  accept_types: ['ltiResourceLink'],
  accept_presentation_document_targets: ['iframe', 'window'],
  accept_multiple: false,
  accept_lineitem: true,
  auto_create: true,
  title: 'Velg aktivitet',
  text: 'Vel ein aktivitet',
  data: 'opaque-platform-data',
};

/**
 * The claims Canvas sends in a Deep Linking launch, with names, e-mail, `lis`, custom personal fields and
 * unknown claims, after ltijs added `client_id` and `platform_id`.
 * @param input - Issuer, client, platform, deployment and optionally subject and time.
 * @returns A fresh claims object.
 */
export function canvasLaunchClaims(input: LaunchClaimsInput): IdTokenClaims {
  return {
    ...common(input),
    nonce: 'nonce-of-the-launch',
    name: 'Kari Nordmann',
    given_name: 'Kari',
    family_name: 'Nordmann',
    middle_name: 'Marie',
    picture: 'https://canvas.example.test/images/kari.png',
    email: 'kari@example.test',
    locale: 'nb',
    [`${LTI}role_scope_mentor`]: ['mentor-of-ola'],
    [`${LTI}context`]: {
      id: 'course-1',
      label: 'MAT101',
      title: 'Matematikk 1',
      type: ['CourseOffering'],
      x: 1,
    },
    [`${LTI}resource_link`]: { id: 'link-1', title: 'Quiz', description: 'Veke 1', hidden_note: 'x' },
    [`${LTI}launch_presentation`]: {
      document_target: 'iframe',
      width: 800,
      height: 600,
      return_url: 'https://canvas.example.test/courses/1/external_content/success',
      locale: 'nn',
      user_hint: 'Kari Nordmann',
    },
    [`${LTI}tool_platform`]: {
      guid: 'canvas-guid',
      name: 'Canvas',
      version: 'cloud',
      product_family_code: 'canvas',
      contact_email: 'admin@canvas.example.test',
    },
    [`${LTI}custom`]: {
      contentId: LAUNCH_CONTENT_ID,
      hvl_placement: 'assignment_selection',
      feide_login: 'kari.nordmann@hvl.no',
      canvas_user_login_id: 'kari.nordmann@hvl.no',
    },
    [`${LTI}lis`]: { person_sourcedid: 'sis-person-12345', course_offering_sourcedid: 'MAT101-2026' },
    [`${LTI}lti11_legacy_user_id`]: 'legacy-user-7',
    'https://purl.imsglobal.org/spec/lti/claim/lti1p1': { user_id: 'legacy-user-7' },
    'https://canvas.instructure.com/lti/unknown_future_claim': { email: 'kari@example.test' },
    ...SERVICES,
    [DEEP_LINKING]: { ...DEEP_LINKING_SETTINGS, accept_media_types: ['image/*'], vendor_extra: 'x' },
  };
}

/**
 * Exactly what may be stored of `canvasLaunchClaims(input)` (D-052): written out by hand.
 * @param input - The same input given to `canvasLaunchClaims`.
 * @returns A fresh claims object.
 */
export function storedLaunchClaims(input: LaunchClaimsInput): IdTokenClaims {
  return {
    ...common(input),
    locale: 'nb',
    [`${LTI}context`]: { id: 'course-1', label: 'MAT101', title: 'Matematikk 1', type: ['CourseOffering'] },
    [`${LTI}resource_link`]: { id: 'link-1', title: 'Quiz', description: 'Veke 1' },
    [`${LTI}launch_presentation`]: {
      document_target: 'iframe',
      width: 800,
      height: 600,
      return_url: 'https://canvas.example.test/courses/1/external_content/success',
      locale: 'nn',
    },
    [`${LTI}tool_platform`]: {
      guid: 'canvas-guid',
      name: 'Canvas',
      version: 'cloud',
      product_family_code: 'canvas',
    },
    [`${LTI}custom`]: { contentId: LAUNCH_CONTENT_ID, hvl_placement: 'assignment_selection' },
    ...SERVICES,
    [DEEP_LINKING]: { ...DEEP_LINKING_SETTINGS, accept_media_types: ['image/*'] },
  };
}
