/**
 * Unit tests for counting active learners among NRPS members: the full Learner role URI, its sub-roles, status,
 * members listed twice, and members whose fields a platform sent malformed.
 *
 * Spec: LTI-008
 */
import { describe, expect, it } from 'vitest';
import { activeLearnerCount, LEARNER_ROLE_URI } from '../../../src/lti/nrps/activeLearners.js';

const MEMBERSHIP = 'http://purl.imsglobal.org/vocab/lis/v2/membership#';
const learner = (userId: string, status?: string) => ({
  userId,
  roles: [LEARNER_ROLE_URI],
  ...(status ? { status } : {}),
});

describe('[LTI-008] the active-learner count', () => {
  it('[LTI-008] asks NRPS for the full Learner role URI, never the short name', () => {
    expect(LEARNER_ROLE_URI).toBe('http://purl.imsglobal.org/vocab/lis/v2/membership#Learner');
  });

  it('[LTI-008] counts active learners only: not instructors, teaching assistants, inactive or deleted members', () => {
    // Arrange
    const members = [
      learner('a', 'Active'),
      learner('b'),
      learner('c', 'Inactive'),
      learner('d', 'Deleted'),
      { userId: 'e', status: 'Active', roles: [`${MEMBERSHIP}Instructor`] },
      { userId: 'f', status: 'Active', roles: [`${MEMBERSHIP}Instructor`, `${MEMBERSHIP}Learner`] },
      {
        userId: 'g',
        roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership/Instructor#TeachingAssistant'],
      },
    ];
    // Act / Assert: a, b (status missing means Active) and f, who is also a learner
    expect(activeLearnerCount(members)).toBe(3);
  });

  it('[LTI-008] counts a Learner sub-role and the deprecated short name, once per member', () => {
    const members = [
      { userId: 'a', roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership/Learner#Learner'] },
      { userId: 'b', roles: ['Learner'] },
      learner('b'),
      learner('c'),
      learner('c'),
    ];
    expect(activeLearnerCount(members)).toBe(3);
  });

  it('[LTI-008] a member with malformed roles or status is not counted, and nothing throws', () => {
    const members = [
      { userId: 'a', roles: 'Learner' },
      { userId: 'b' },
      { userId: 'c', roles: [42, null] },
      { userId: 'd', status: 1, roles: [LEARNER_ROLE_URI] },
    ];
    expect(activeLearnerCount(members)).toBe(0);
    expect(activeLearnerCount([])).toBe(0);
  });
});
