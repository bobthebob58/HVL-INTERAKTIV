/**
 * canvasMemberships — the mock Canvas's course rosters and its Names and Role Provisioning Service
 * (`GET /api/lti/courses/:course/names_and_roles`, NRPS 2.0).
 *
 * Why: LTI-008 counts a course's active learners through NRPS (with ltijs's `context.namesAndRoles`, D-104), and
 *      the score service accepts scores only for the course's learners. Tests need rosters of any size, a role
 *      filter and paging, without TeCopp's Canvas.
 * Spec: LTI-008, LTI-012
 * Invariants:
 *   - A course's roster starts with the demo teacher and student (./ltiVocabulary.mjs); every user the mock
 *     launches into a course joins it with the launch's membership roles; `setMembers` replaces a roster.
 *   - Members carry only `status`, `user_id` and membership `roles`: the developer key's `privacy_level` is
 *     `anonymous`, so Canvas sends no name, e-mail or picture (canvas-platform-values.md §6, §8).
 *   - The service needs the `contextmembership.readonly` scope (401 otherwise). `role` must be a full role URI: as
 *     in Canvas, any other value (a short name such as `Learner`, an institution role) matches nobody
 *     (C:`app/controllers/lti/ims/providers/memberships_provider.rb:141-149`,
 *     C:`…/providers/course_memberships_provider.rb:85-90`, C:`lib/lti/substitutions_helper.rb:69-108`).
 *   - Pages hold 50 members by default and at most 50 (`limit`, else `per_page`), and their links leave `limit`
 *     out, as Canvas's NRPS does (C:`…/providers/memberships_provider.rb:24,234-249`); the links are built by
 *     ./canvasServiceHttp.mjs. A `Deleted` member is never listed.
 *   - `rlid` (resource-link memberships) is not served: the mock lists the whole course.
 * Collaborators: ./canvasServices.mjs, ./canvasScores.mjs, ./canvasTokenEndpoint.mjs, ./canvasFaults.mjs,
 *   ./canvasServiceHttp.mjs, ./ltiVocabulary.mjs.
 * Tests: tools/mock-platform/test/canvasNrps.test.mjs
 */
import { applyFault } from './canvasFaults.mjs';
import { pageOf, sendMedia } from './canvasServiceHttp.mjs';
import { CANVAS_USERS, LTI_MEDIA_TYPE, LTI_SCOPE } from './ltiVocabulary.mjs';

const MEMBERSHIP_ROLE = 'http://purl.imsglobal.org/vocab/lis/v2/membership#';
const STATUSES = ['Active', 'Inactive', 'Deleted'];
const membershipRoles = (roles) => roles.filter((role) => role.startsWith(MEMBERSHIP_ROLE));

/**
 * Checks and copies one NRPS member.
 * @param {{user_id: unknown, roles: unknown, status?: unknown}} member - A member as NRPS sends it.
 * @returns {{status: string, user_id: string, roles: string[]}} The member; `status` defaults to `Active`.
 * @throws {TypeError} For a missing `user_id`, roles that are not strings, or an unknown status.
 */
export function normaliseMember(member) {
  const { user_id: userId, roles, status = 'Active' } = member ?? {};
  if (typeof userId !== 'string' || userId === '') throw new TypeError('a member needs a user_id');
  if (!Array.isArray(roles) || !roles.every((role) => typeof role === 'string')) {
    throw new TypeError('a member needs roles as strings');
  }
  if (!STATUSES.includes(status)) throw new TypeError(`member status must be one of ${STATUSES.join(', ')}`);
  return { status, user_id: userId, roles: [...roles] };
}

/**
 * Creates the rosters of one mock Canvas.
 * @returns {object} `enrol(launch)`, `setMembers(courseId, members)`, `members(courseId)`, `contextOf(courseId)`
 *   and `isActiveLearner(courseId, userId)`.
 */
export function createMemberships() {
  const rosters = new Map();
  const contexts = new Map();
  const demoRoster = () =>
    new Map(
      [CANVAS_USERS.teacher, CANVAS_USERS.student].map((user) => [
        user.sub,
        { status: 'Active', user_id: user.sub, roles: membershipRoles(user.roles) },
      ]),
    );
  const rosterOf = (courseId) => {
    if (!rosters.has(courseId)) rosters.set(courseId, demoRoster());
    return rosters.get(courseId);
  };
  return {
    enrol({ course, user }) {
      contexts.set(course.id, { id: course.id, label: course.label ?? course.id, title: course.title });
      const member = { status: 'Active', user_id: user.sub, roles: membershipRoles(user.roles ?? []) };
      rosterOf(course.id).set(user.sub, member);
    },
    setMembers(courseId, members) {
      const checked = members.map(normaliseMember);
      rosters.set(courseId, new Map(checked.map((member) => [member.user_id, member])));
    },
    members: (courseId) => [...rosterOf(courseId).values()].map((member) => structuredClone(member)),
    contextOf: (courseId) =>
      contexts.get(courseId) ?? { id: courseId, label: courseId, title: 'Mock course' },
    isActiveLearner(courseId, userId) {
      const member = rosterOf(courseId).get(userId);
      return member?.status === 'Active' && member.roles.includes(`${MEMBERSHIP_ROLE}Learner`);
    },
  };
}

/**
 * Serves NRPS.
 * @param {{add: Function}} router - The mock Canvas router.
 * @param {{memberships: object, tokens: {authorize: Function}, faults: {take: Function}, origin: string}} services -
 *   The rosters, the token service, the fault queues (target `memberships`) and the mock Canvas's origin.
 */
export function registerMembershipRoute(router, { memberships, tokens, faults, origin }) {
  router.add('GET', '/api/lti/courses/:course/names_and_roles', async (req, res, { url, params }) => {
    if (await applyFault(res, faults.take('memberships'))) return;
    if (!tokens.authorize(req, res, [LTI_SCOPE.contextMembershipReadonly])) return;
    const wanted = url.searchParams.get('role');
    const listed = memberships
      .members(params.course)
      .filter((member) => member.status !== 'Deleted' && (!wanted || member.roles.includes(wanted)));
    const requestUrl = new URL(url.pathname + url.search, origin);
    const page = pageOf(listed, requestUrl, { defaultLimit: 50, maxLimit: 50, dropLimit: true });
    const container = {
      id: requestUrl.href,
      context: memberships.contextOf(params.course),
      members: page.items,
    };
    sendMedia(res, 200, LTI_MEDIA_TYPE.membershipContainer, container, page.headers);
  });
}
