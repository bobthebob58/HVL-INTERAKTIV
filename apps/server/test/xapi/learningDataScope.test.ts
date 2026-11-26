/**
 * Unit tests of the rule that says whose play is recorded as learning data: an HVL learner in the portal and a
 * Canvas launch with the Learner role, and nobody else (D-102, D-138).
 *
 * Spec: LTI-011, DATA-012, INS-006
 */
import { describe, expect, it } from 'vitest';
import type { LtiLaunchFacts } from '../../src/auth/Principal.js';
import { recordsLearningData, type LearningDataFacts } from '../../src/xapi/learningDataScope.js';

const portal = (facts: Partial<LearningDataFacts> = {}): LearningDataFacts => ({
  roles: ['learner'],
  mode: 'portal',
  hvlMember: true,
  ...facts,
});
const launch = (lti: Partial<LtiLaunchFacts> = {}, roles: LearningDataFacts['roles'] = ['learner']) =>
  ({
    roles,
    mode: 'lti',
    hvlMember: false,
    lti: {
      platformId: 'p',
      deploymentId: 'd',
      contextId: 'course-1',
      messageType: 'LtiResourceLinkRequest',
      ...lti,
    },
  }) satisfies LearningDataFacts;

describe('[LTI-011] whose play is recorded as learning data', () => {
  it('[LTI-011] in the portal: an HVL learner, and not a learner from another Feide organisation', () => {
    expect([recordsLearningData(portal()), recordsLearningData(portal({ hvlMember: false }))]).toEqual([
      true,
      false,
    ]);
  });

  it('[LTI-011] in Canvas: a launch with the Learner role, and not an observer or a launch without roles', () => {
    expect([recordsLearningData(launch({ learnerRole: true })), recordsLearningData(launch())]).toEqual([
      true,
      false,
    ]);
  });

  it('[DATA-012] Canvas’s test student is recorded, flagged, also without the Learner role (D-102)', () => {
    expect(recordsLearningData(launch({ testUser: true }))).toBe(true);
  });

  it.each([
    ['an author in the portal', portal({ roles: ['author'] })],
    ['an admin who is also a learner', portal({ roles: ['learner', 'admin'] })],
    ['a Canvas teacher enrolled as a student too', launch({ learnerRole: true }, ['author'])],
  ])('[LTI-011] %s is never recorded: a preview is not learning data (D-102)', (_who, principal) => {
    expect(recordsLearningData(principal)).toBe(false);
  });

  it('[INS-006] a launch whose facts are missing is not recorded', () => {
    expect(recordsLearningData({ roles: ['learner'], mode: 'lti', hvlMember: false })).toBe(false);
  });
});
