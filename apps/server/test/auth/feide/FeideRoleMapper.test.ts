/**
 * Tests for mapping Feide affiliations and groups to roles: every row of the AUTH-002 table, the D-059 readings
 * (course-group matching, admins only for HVL members) and the fail-closed handling of odd Groups API answers.
 *
 * Spec: AUTH-002
 */
import { describe, expect, it } from 'vitest';
import {
  mapFeideRoles,
  matchesCourseGroup,
  type FeideRolePolicy,
} from '../../../src/auth/feide/FeideRoleMapper.js';

const POLICY: FeideRolePolicy = {
  allowedOrgs: ['hvl.no'],
  adminFeideIds: ['admin@hvl.no', 'admin-student@hvl.no', 'guest@uib.no'],
  authorCourseGroups: ['fc:fs:fs:emne:hvl.no:ppu101', 'fc:fs:fs:prg:hvl.no:brettspel'],
};

/** An organisation group as the Groups API returns it for the logged-in user. */
const org = (realm: string, affiliation: unknown) => ({
  id: `fc:org:${realm}`,
  type: 'fc:org',
  displayName: 'Organisation',
  membership: { basic: 'member', affiliation, primaryAffiliation: 'member' },
});
/** An FS group (course or programme) the user is a member of. */
const fs = (id: string) => ({ id, type: 'fc:fs:emne', displayName: 'Emne', membership: { basic: 'member' } });

const COURSE = fs('fc:fs:fs:emne:hvl.no:ppu101:1');
const LEARNER = { roles: ['learner'], hvlMember: true, studentAuthor: false, realm: 'hvl.no' };
const AUTHOR = { ...LEARNER, roles: ['author'] };

describe('[AUTH-002] Feide role table', () => {
  it.each([
    ['employee', 'ola@hvl.no', [org('hvl.no', ['member', 'employee'])], AUTHOR],
    ['faculty', 'ola@hvl.no', [org('hvl.no', ['member', 'employee', 'faculty'])], AUTHOR],
    ['staff', 'ola@hvl.no', [org('hvl.no', ['member', 'staff'])], AUTHOR],
    [
      'student and employee → author, not a student author',
      'ola@hvl.no',
      [org('hvl.no', ['student', 'employee']), COURSE],
      AUTHOR,
    ],
    [
      'student in an allow-listed course (prefix + ":")',
      'kari@hvl.no',
      [org('hvl.no', ['member', 'student']), COURSE],
      { ...AUTHOR, studentAuthor: true },
    ],
    [
      'student in an allow-listed group (exact ID)',
      'kari@hvl.no',
      [org('hvl.no', ['student']), fs('fc:fs:fs:prg:hvl.no:brettspel')],
      { ...AUTHOR, studentAuthor: true },
    ],
    [
      'student in a course group written in upper case',
      'kari@hvl.no',
      [org('hvl.no', ['student']), fs('FC:FS:FS:EMNE:HVL.NO:PPU101:2')],
      { ...AUTHOR, studentAuthor: true },
    ],
    [
      'student in a course that only shares a text prefix',
      'kari@hvl.no',
      [org('hvl.no', ['student']), fs('fc:fs:fs:emne:hvl.no:ppu1012:1')],
      LEARNER,
    ],
    [
      'student without an allow-listed course',
      'kari@hvl.no',
      [org('hvl.no', ['member', 'student'])],
      LEARNER,
    ],
    [
      'member in an allow-listed course (not a student)',
      'kari@hvl.no',
      [org('hvl.no', ['member']), COURSE],
      LEARNER,
    ],
    ['member', 'kari@hvl.no', [org('hvl.no', ['member'])], LEARNER],
    ['affiliate', 'kari@hvl.no', [org('hvl.no', ['affiliate'])], LEARNER],
    ['alum', 'kari@hvl.no', [org('hvl.no', ['alum'])], LEARNER],
    ['library-walk-in', 'kari@hvl.no', [org('hvl.no', ['library-walk-in'])], LEARNER],
    ['an unknown affiliation', 'kari@hvl.no', [org('hvl.no', ['teacher'])], LEARNER],
    [
      'listed admin who is staff',
      'admin@hvl.no',
      [org('hvl.no', ['employee'])],
      { ...AUTHOR, roles: ['author', 'admin'] },
    ],
    [
      'listed admin who is a student',
      'admin-student@hvl.no',
      [org('hvl.no', ['student'])],
      { ...LEARNER, roles: ['learner', 'admin'] },
    ],
  ])('[AUTH-002] %s', (_case, feideId, groups, expected) => {
    expect(mapFeideRoles({ feideId, groups }, POLICY)).toEqual(expected);
  });

  it.each([
    ['an employee of another organisation', 'ola@uib.no', [org('uib.no', ['employee'])], 'uib.no'],
    ['a listed admin ID of another organisation', 'guest@uib.no', [org('uib.no', ['employee'])], 'uib.no'],
    ['an HVL Feide ID whose organisation group is missing', 'ola@hvl.no', [COURSE], 'hvl.no'],
    [
      'an HVL Feide ID with only another organisation group',
      'ola@hvl.no',
      [org('uib.no', ['employee'])],
      'hvl.no',
    ],
    [
      'an organisation group of the wrong type',
      'ola@hvl.no',
      [{ ...org('hvl.no', ['employee']), type: 'fc:orgunit' }],
      'hvl.no',
    ],
    [
      'a Groups API answer that is not a list',
      'ola@hvl.no',
      { groups: [org('hvl.no', ['employee'])] },
      'hvl.no',
    ],
  ])('[AUTH-002] %s is a learner and not an HVL member', (_case, feideId, groups, realm) => {
    expect(mapFeideRoles({ feideId, groups }, POLICY)).toEqual({
      roles: ['learner'],
      hvlMember: false,
      studentAuthor: false,
      realm,
    });
  });

  it.each([
    ['a bare string, not a list', 'employee'],
    ['a list without strings', [{ value: 'employee' }, 7, null]],
    ['missing', undefined],
  ])('[AUTH-002] an affiliation that is %s grants nothing', (_case, affiliation) => {
    const result = mapFeideRoles({ feideId: 'ola@hvl.no', groups: [org('hvl.no', affiliation)] }, POLICY);
    expect(result).toEqual(LEARNER);
  });

  it('[AUTH-002] skips malformed groups and still matches the well-formed ones', () => {
    // Arrange
    const groups = [null, 'fc:org:hvl.no', { id: 42 }, org('hvl.no', ['student']), COURSE];
    // Act
    const result = mapFeideRoles({ feideId: 'kari@hvl.no', groups }, POLICY);
    // Assert
    expect(result).toEqual({ ...AUTHOR, studentAuthor: true });
  });

  it('[AUTH-002] accepts more allowed organisations from ALLOWED_FEIDE_ORGS', () => {
    const policy = { ...POLICY, allowedOrgs: ['hvl.no', 'uib.no'] };
    const result = mapFeideRoles({ feideId: 'ola@uib.no', groups: [org('uib.no', ['faculty'])] }, policy);
    expect(result).toEqual({ ...AUTHOR, realm: 'uib.no' });
  });

  it('[AUTH-002] returns frozen roles, so a caller cannot add admin afterwards', () => {
    const result = mapFeideRoles({ feideId: 'ola@hvl.no', groups: [org('hvl.no', ['employee'])] }, POLICY);
    expect(Object.isFrozen(result) && Object.isFrozen(result.roles)).toBe(true);
  });

  it('[AUTH-002] refuses a Feide ID that is not normalised, without echoing it', () => {
    for (const feideId of ['Ola@hvl.no', ' ola@hvl.no', 'ola', 'ola@hvl']) {
      expect(() => mapFeideRoles({ feideId, groups: [] }, POLICY)).toThrow(
        /^mapFeideRoles needs a normalised Feide ID$/,
      );
    }
  });
});

describe('[AUTH-002] course-group matching (D-059)', () => {
  it.each([
    ['fc:fs:fs:emne:hvl.no:ppu101', 'fc:fs:fs:emne:hvl.no:ppu101', true],
    ['fc:fs:fs:emne:hvl.no:ppu101:1', 'fc:fs:fs:emne:hvl.no:ppu101', true],
    ['FC:FS:FS:EMNE:HVL.NO:PPU101:1', 'fc:fs:fs:emne:hvl.no:ppu101', true],
    ['fc:fs:fs:emne:hvl.no:ppu101:1', 'FC:FS:FS:EMNE:HVL.NO:PPU101', true],
    ['fc:fs:fs:emne:hvl.no:ppu1012:1', 'fc:fs:fs:emne:hvl.no:ppu101', false],
    ['fc:fs:fs:emne:hvl.no', 'fc:fs:fs:emne:hvl.no:ppu101', false],
    ['fc:fs:fs:emne:uib.no:ppu101:1', 'fc:fs:fs:emne:hvl.no:ppu101', false],
  ])('[AUTH-002] group %s against entry %s → %s', (groupId, entry, expected) => {
    expect(matchesCourseGroup(groupId, entry)).toBe(expected);
  });
});
