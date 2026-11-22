/**
 * learningDataScope — whose play of an activity is recorded as learning data: the one rule the xAPI ingestion and
 * the player pages share.
 *
 * Why: insight hides every number about fewer than k learners (INS-006), which protects a learner only if the
 *      person who reads insight cannot fill a group with people of their own choosing. D-102 records a play only
 *      for a learner principal; D-138 narrows who that is. In the portal, Feide lets anyone with a login from any
 *      organisation open an activity shared with «anyone with Feide» (D-059), so only an HVL member is recorded.
 *      In Canvas, an observer, an unknown role and a launch without roles are learners to the permission system
 *      (LTI-004) but not students of the course, so only a launch with the Learner role is recorded.
 * Spec: LTI-011, DATA-012, INS-006
 * Invariants:
 *   - Recorded: the highest role is `learner`, and (portal) the person is an HVL member, or (Canvas) the launch
 *     holds the Learner role or is Canvas's test student, whose rows are stored flagged and never read by insight
 *     (D-102's amendment of 2026-11-04).
 *   - Anyone else plays as before; nothing they answer is stored as a statement, so they are in no insight view,
 *     no k count, no mappe result and no score sent to Canvas. Their saved state ("where was I?") is not decided
 *     here: it is kept for everyone (D-138).
 *   - Pure; reads only facts the login or the launch fixed, never the request.
 * Collaborators: ../auth/Principal.ts, ./XapiIngest.ts (the server's check), ../auth/principalToH5pActor.ts (the
 *   player page's, through ../h5p/render/xapiBridgeConfig.ts), ../lti/LtiRoleMapper.ts (`isLtiLearner`).
 * Tests: apps/server/test/xapi/learningDataScope.test.ts
 */
import { highestRole, type Principal } from '../auth/Principal.js';

/** What the rule reads of a principal. */
export type LearningDataFacts = Pick<Principal, 'roles' | 'mode' | 'hvlMember' | 'lti'>;

/**
 * Tells whether a person's play is recorded as learning data.
 * @param principal - Who plays, as the login or the launch made them.
 * @returns True for an HVL learner in the portal and for a Canvas launch with the Learner role (or the test
 *   student); false for authors and admins, for a learner from another Feide organisation, and for a Canvas launch
 *   without the Learner role.
 * @example
 * if (!recordsLearningData(principal)) return { kind: 'accepted', stored: 0 };
 * @spec LTI-011
 */
export function recordsLearningData(principal: LearningDataFacts): boolean {
  // PRIVACY: an author's preview and a teacher's play are never learning data (D-102).
  if (highestRole(principal.roles) !== 'learner') return false;
  // PRIVACY: the portal records HVL's own learners only; a guest from another organisation is in no count (D-138).
  if (principal.mode === 'portal') return principal.hvlMember;
  return principal.lti?.learnerRole === true || principal.lti?.testUser === true;
}
