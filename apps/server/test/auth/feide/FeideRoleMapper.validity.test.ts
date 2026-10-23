/**
 * Tests that a course group makes a student an author only while Feide says the membership is valid.
 *
 * Spec: AUTH-002
 */
import { describe, expect, it } from 'vitest';
import { mapFeideRoles, type FeideRolePolicy } from '../../../src/auth/feide/FeideRoleMapper.js';

const POLICY: FeideRolePolicy = {
  allowedOrgs: ['hvl.no'],
  adminFeideIds: [],
  authorCourseGroups: ['fc:fs:fs:emne:hvl.no:ppu101'],
};
const NOW = new Date('2026-10-23T10:00:00Z');
const ORG = {
  id: 'fc:org:hvl.no',
  type: 'fc:org',
  membership: { basic: 'member', affiliation: ['student'] },
};
const course = (membership: Record<string, unknown>) => ({
  id: 'fc:fs:fs:emne:hvl.no:ppu101:1',
  type: 'fc:fs:emne',
  membership: { basic: 'member', ...membership },
});
const studentAuthor = (membership: Record<string, unknown>) =>
  mapFeideRoles({ feideId: 'kari@hvl.no', groups: [ORG, course(membership)] }, POLICY, NOW).studentAuthor;

describe('[AUTH-002] course membership validity', () => {
  it.each([
    ['no validity dates', {}, true],
    [
      'inside notBefore and notAfter',
      { notBefore: '2026-08-01T00:00:00Z', notAfter: '2027-01-01T00:00:00Z' },
      true,
    ],
    ['ended (notAfter in the past)', { notAfter: '2026-06-30T22:00:00Z' }, false],
    ['ends exactly now', { notAfter: NOW.toISOString() }, false],
    ['not started yet', { notBefore: '2027-01-01T00:00:00Z' }, false],
    ['an unreadable date', { notAfter: 'next summer' }, false],
    ['a date that is not text', { notAfter: 1767225600 }, false],
  ])('[AUTH-002] %s → student author: %s', (_name, membership, expected) => {
    expect(studentAuthor(membership)).toBe(expected);
  });

  it('[AUTH-002] an expired course leaves an employee an author (validity matters only for course groups)', () => {
    const employee = { ...ORG, membership: { basic: 'member', affiliation: ['employee'] } };
    const roles = mapFeideRoles(
      { feideId: 'ola@hvl.no', groups: [employee, course({ notAfter: '2020-01-01T00:00:00Z' })] },
      POLICY,
      NOW,
    );
    expect(roles.roles).toEqual(['author']);
  });
});
