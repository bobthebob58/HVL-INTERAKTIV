/**
 * LtiRoleMapper — turns the roles claim of an LTI 1.3 launch into the role the person holds in that context.
 *
 * Why: LTI-004 lets teachers, teaching assistants and course designers author from Canvas, and nobody else. The
 *      roles claim is asserted by the platform, so the mapping must be an allowlist that can only ever yield
 *      `learner` or `author`: H5P library administration needs a Feide login and the admin list (AUTH-002).
 * Spec: LTI-004
 * Invariants:
 *   - The result is exactly `['learner']` or `['author']`; an LTI launch never yields `admin` (LTI-004, D-059).
 *   - `author` only for an exact role in LTI_AUTHOR_ROLES: context `Instructor`, the `Instructor#TeachingAssistant`
 *     sub-role, context `ContentDeveloper` (full URIs, or the short context-role names LTI 1.3 allows), and
 *     `institution/person#Administrator` (D-059).
 *   - `learner` for `Learner`, `Mentor`, any other or unknown role, and a malformed claim.
 *   - The LTI `TestUser` role (Canvas's Student View) yields `learner` whatever else the claim holds (D-059).
 * Collaborators: ./launch/onResourceLink.ts, ./launch/onDeepLinking.ts, ./ltikPrincipal.ts, ../auth/Principal.ts.
 * Tests: apps/server/test/lti/LtiRoleMapper.test.ts
 */
import type { Role } from '../auth/Principal.js';

const LIS = 'http://purl.imsglobal.org/vocab/lis/v2/';

/** The roles an LTI launch can give: never `admin`. */
export type LtiRole = Exclude<Role, 'admin'>;

/** The result of mapping: one role, as a frozen list (the shape `Principal.roles` takes). */
export type LtiRoles = readonly ['learner'] | readonly ['author'];

/** The LTI system role Canvas sends for its Student View test student. */
export const LTI_TEST_USER_ROLE = 'http://purl.imsglobal.org/vocab/lti/system/person#TestUser';

/** Exact role values that make a launch an author in its context (spec 02 `LTI-004`, D-059). */
export const LTI_AUTHOR_ROLES: ReadonlySet<string> = new Set([
  `${LIS}membership#Instructor`,
  `${LIS}membership/Instructor#TeachingAssistant`,
  `${LIS}membership#ContentDeveloper`,
  `${LIS}institution/person#Administrator`,
  // WHY: LTI 1.3 lets platforms send context roles by their simple names (deprecated, but allowed).
  'Instructor',
  'ContentDeveloper',
]);

const LEARNER: LtiRoles = Object.freeze(['learner'] as const);
const AUTHOR: LtiRoles = Object.freeze(['author'] as const);

/**
 * Maps the `https://purl.imsglobal.org/spec/lti/claim/roles` claim to a role (spec 02 `LTI-004`).
 * @param roleClaims - The claim's value: a list of role URIs. Anything else counts as no roles.
 * @returns `['author']` or `['learner']`, frozen.
 * @spec LTI-004
 */
export function mapLtiRoles(roleClaims: unknown): LtiRoles {
  const roles = Array.isArray(roleClaims)
    ? roleClaims.filter((role): role is string => typeof role === 'string')
    : [];
  // SECURITY: a test user acts as a student; whatever teacher roles come with it must not let it author (D-059).
  if (roles.includes(LTI_TEST_USER_ROLE)) return LEARNER;
  // SECURITY: an allowlist of exact values, so a forged or unfamiliar role (system administrator, `Admin`, a
  // look-alike URI) gives at most what a learner has, and nothing here can produce admin (LTI-004).
  return roles.some((role) => LTI_AUTHOR_ROLES.has(role)) ? AUTHOR : LEARNER;
}
