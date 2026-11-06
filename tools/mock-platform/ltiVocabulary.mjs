/**
 * ltiVocabulary — the names the mock Canvas and its tests share: LTI 1.3 claim names, role URIs, message types,
 * Canvas demo users, the item types each Deep Linking placement accepts, and the scopes and media types of the AGS
 * and NRPS services.
 *
 * Why: tests of the tool (LTI-001, LTI-004, LTI-005, LTI-008, LTI-012) should build and read launches and service
 *      calls with the same constants the mock uses, so a typo in a claim, scope or media type cannot make a test
 *      pass against a value nobody sends.
 * Spec: LTI-001, LTI-004, LTI-005, LTI-008, LTI-012
 * Invariants:
 *   - Values are copied from the LTI 1.3 / Deep Linking 2.0 / AGS 2.0 / NRPS 2.0 specifications and Canvas
 *     (docs/reference/canvas-platform-values.md §4); the objects, and the demo users' role lists, are frozen.
 *   - Canvas sends institution and system roles next to the membership role; the demo users do too.
 * Collaborators: ./canvasIdTokens.mjs, ./deepLinkReturn.mjs, ./canvasPages.mjs, ./canvasServices.mjs and the
 *   service modules it wires, ./mockPlatform.mjs.
 * Tests: tools/mock-platform/test/mockCanvas.test.mjs, tools/mock-platform/test/canvasTokenEndpoint.test.mjs
 */
const LTI = 'https://purl.imsglobal.org/spec/lti/claim/';
/** Claim names of LTI 1.3 launches and Deep Linking messages, plus Canvas's placement claim. */
export const LTI_CLAIM = Object.freeze({
  messageType: `${LTI}message_type`,
  version: `${LTI}version`,
  deploymentId: `${LTI}deployment_id`,
  targetLinkUri: `${LTI}target_link_uri`,
  roles: `${LTI}roles`,
  context: `${LTI}context`,
  resourceLink: `${LTI}resource_link`,
  custom: `${LTI}custom`,
  launchPresentation: `${LTI}launch_presentation`,
  toolPlatform: `${LTI}tool_platform`,
  deepLinkingSettings: 'https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings',
  contentItems: 'https://purl.imsglobal.org/spec/lti-dl/claim/content_items',
  data: 'https://purl.imsglobal.org/spec/lti-dl/claim/data',
  agsEndpoint: 'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint',
  namesRoleService: 'https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice',
  placement: 'https://www.instructure.com/placement',
});

const LIS = 'http://purl.imsglobal.org/vocab/lis/v2/';
/** LTI role URIs used in tests, including the ones Canvas adds to every launch. */
export const LTI_ROLE = Object.freeze({
  learner: `${LIS}membership#Learner`,
  instructor: `${LIS}membership#Instructor`,
  administrator: `${LIS}institution/person#Administrator`,
  institutionStudent: `${LIS}institution/person#Student`,
  institutionInstructor: `${LIS}institution/person#Instructor`,
  systemUser: `${LIS}system/person#User`,
});

/** Canvas users with the role sets Canvas sends; the teacher's login ID equals the Feide demo author's Feide ID. */
export const CANVAS_USERS = Object.freeze({
  teacher: Object.freeze({
    sub: 'b8e2c4d6-1f3a-4e5b-9c7d-2a4f6e8b0c11',
    roles: Object.freeze([LTI_ROLE.institutionInstructor, LTI_ROLE.instructor, LTI_ROLE.systemUser]),
    loginId: 'author@hvl.no',
  }),
  student: Object.freeze({
    sub: 'd4f6a8c0-3b5e-4d7f-8a1c-6e8b0d2f4a22',
    roles: Object.freeze([LTI_ROLE.institutionStudent, LTI_ROLE.learner, LTI_ROLE.systemUser]),
  }),
});

/** The two message types the mock Canvas launches. */
export const MESSAGE_TYPE = Object.freeze({
  resourceLink: 'LtiResourceLinkRequest',
  deepLinking: 'LtiDeepLinkingRequest',
});

/**
 * The content-item types Canvas accepts back from a Deep Linking placement (canvas-platform-values.md §5).
 * @param {string | undefined} placement - e.g. `editor_button` or `assignment_selection`.
 * @returns {string[]} The `accept_types` of the request.
 */
export const acceptedItemTypes = (placement) =>
  placement === 'editor_button' ? ['link', 'file', 'html', 'ltiResourceLink', 'image'] : ['ltiResourceLink'];

const AGS = 'https://purl.imsglobal.org/spec/lti-ags/scope/';
/** OAuth scopes of the LTI Advantage services, as Canvas developer keys list them (canvas-platform-values.md §4). */
export const LTI_SCOPE = Object.freeze({
  lineItem: `${AGS}lineitem`,
  lineItemReadonly: `${AGS}lineitem.readonly`,
  score: `${AGS}score`,
  resultReadonly: `${AGS}result.readonly`,
  contextMembershipReadonly: 'https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly',
});

/** Media types of AGS 2.0 and NRPS 2.0 messages. */
export const LTI_MEDIA_TYPE = Object.freeze({
  lineItem: 'application/vnd.ims.lis.v2.lineitem+json',
  lineItemContainer: 'application/vnd.ims.lis.v2.lineitemcontainer+json',
  score: 'application/vnd.ims.lis.v1.score+json',
  membershipContainer: 'application/vnd.ims.lti-nrps.v2.membershipcontainer+json',
});
