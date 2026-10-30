/**
 * activeLearners — counts the active learners in the members Canvas's Names and Roles service lists, and names the
 * role the server asks NRPS for.
 *
 * Why: LTI-008 uses the number of active learners in a course as insight's denominator (INS-001). The request asks
 *      NRPS for learners only, but the count checks each member again, so a platform that ignores the role filter
 *      never counts a teacher. Nothing but the number leaves this function.
 * Spec: LTI-008
 * Invariants:
 *   - The role filter is the full URI `http://purl.imsglobal.org/vocab/lis/v2/membership#Learner`: Canvas matches a
 *     short name such as `Learner` to nobody (tools/mock-platform/canvasMemberships.mjs, S6 trap (b)).
 *   - A member counts when its `status` is `Active` or missing (NRPS 2.0's default) and its roles hold the Learner
 *     role (the full URI, a sub-role of it, or the deprecated short name); each `user_id` counts once, even if a
 *     roster that changed while it was paged lists it twice.
 *   - PRIVACY: the members and their IDs live only in memory while they are counted; only the number is returned.
 * Collaborators: ./NrpsLearnerCounter.ts.
 * Tests: apps/server/test/lti/nrps/activeLearners.test.ts
 */

/** The NRPS role filter for learners: always the full role URI, never the short name (LTI-008). */
export const LEARNER_ROLE_URI = 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner';

/** The prefix of the Learner role's sub-roles, e.g. `…/membership/Learner#Learner`. */
const LEARNER_SUB_ROLE = 'http://purl.imsglobal.org/vocab/lis/v2/membership/Learner#';

/**
 * What the count reads of an NRPS member. ltijs validates `status` and `roles` but its `Member` type loses them
 * (an `Omit` over a loose zod object), so they are typed `unknown` and checked here.
 */
export interface NrpsMemberFacts {
  /** The platform's ID for the member (Canvas: the LTI `sub`); used only to count each member once. */
  readonly userId: string;
  readonly status?: unknown;
  readonly roles?: unknown;
}

const isLearnerRole = (role: unknown): boolean =>
  typeof role === 'string' &&
  (role === LEARNER_ROLE_URI || role.startsWith(LEARNER_SUB_ROLE) || role === 'Learner');

/**
 * Counts the active learners among NRPS members.
 * @param members - The members of every page, as ltijs returns them.
 * @returns How many distinct active learners there are.
 * @example
 * activeLearnerCount([{ userId: 'a', status: 'Active', roles: [LEARNER_ROLE_URI] }]); // 1
 * @spec LTI-008
 */
export function activeLearnerCount(members: readonly NrpsMemberFacts[]): number {
  // PRIVACY: the set exists only for the duration of this call; the IDs are never stored or logged.
  const seen = new Set<string>();
  for (const member of members) {
    const active = member.status === undefined || member.status === 'Active';
    const learner = Array.isArray(member.roles) && member.roles.some(isLearnerRole);
    if (active && learner) seen.add(member.userId);
  }
  return seen.size;
}
