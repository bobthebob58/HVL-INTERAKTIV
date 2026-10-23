/**
 * Tests for mapping LTI 1.3 roles: the LTI-004 table read as D-059 says, including forged admin-like role sets that
 * must never produce admin, and Canvas's Student View test user.
 *
 * Spec: LTI-004
 */
import { describe, expect, it } from 'vitest';
import { LTI_TEST_USER_ROLE, mapLtiRoles } from '../../src/lti/LtiRoleMapper.js';

const LIS = 'http://purl.imsglobal.org/vocab/lis/v2/';
const INSTRUCTOR = `${LIS}membership#Instructor`;
const TA = `${LIS}membership/Instructor#TeachingAssistant`;
const DESIGNER = `${LIS}membership#ContentDeveloper`;
const LEARNER = `${LIS}membership#Learner`;
const MENTOR = `${LIS}membership#Mentor`;
const INSTITUTION_ADMIN = `${LIS}institution/person#Administrator`;
const INSTITUTION_INSTRUCTOR = `${LIS}institution/person#Instructor`;
const INSTITUTION_STUDENT = `${LIS}institution/person#Student`;
const SYSTEM_ADMIN = `${LIS}system/person#Administrator`;
const SYS_ADMIN = `${LIS}system/person#SysAdmin`;
const CONTEXT_ADMIN = `${LIS}membership#Administrator`;

describe('[LTI-004] LTI role table', () => {
  it.each([
    ['Instructor (Canvas teacher)', [INSTRUCTOR, INSTITUTION_INSTRUCTOR]],
    ['TeachingAssistant sub-role (Canvas TA)', [TA]],
    ['ContentDeveloper (Canvas designer)', [DESIGNER]],
    ['institution Administrator (Canvas account admin)', [INSTITUTION_ADMIN]],
    ['the short context role Instructor', ['Instructor']],
    ['the short context role ContentDeveloper', ['ContentDeveloper']],
    ['Learner together with Instructor', [LEARNER, INSTRUCTOR]],
  ])('[LTI-004] %s → author', (_case, roles) => {
    expect(mapLtiRoles(roles)).toEqual(['author']);
  });

  it.each([
    ['Learner only (Canvas student)', [LEARNER, INSTITUTION_STUDENT]],
    ['the short context role Learner', ['Learner']],
    ['Mentor (Canvas observer)', [MENTOR]],
    ['an institution Instructor who is a learner in this course', [LEARNER, INSTITUTION_INSTRUCTOR]],
    ['an unknown role', ['http://example.org/roles#Superuser']],
    ['context Administrator (not in the table)', [CONTEXT_ADMIN]],
    ['an Instructor sub-role other than TeachingAssistant', [`${LIS}membership/Instructor#Grader`]],
    ['the short form TeachingAssistant (not an LTI 1.3 context role)', ['TeachingAssistant']],
    ['a look-alike https URI', ['https://purl.imsglobal.org/vocab/lis/v2/membership#Instructor']],
    ['a differently cased role', [`${LIS}membership#instructor`, 'instructor']],
    ['a role with surrounding blanks', [` ${INSTRUCTOR} `]],
    ['no roles', []],
  ])('[LTI-004] %s → learner', (_case, roles) => {
    expect(mapLtiRoles(roles)).toEqual(['learner']);
  });

  it.each([
    ['Learner', [LTI_TEST_USER_ROLE, LEARNER]],
    ['Instructor', [INSTRUCTOR, LTI_TEST_USER_ROLE]],
    ['every author role', [LTI_TEST_USER_ROLE, INSTRUCTOR, TA, DESIGNER, INSTITUTION_ADMIN]],
  ])('[LTI-004] the TestUser role with %s → learner', (_case, roles) => {
    expect(mapLtiRoles(roles)).toEqual(['learner']);
  });

  it.each([
    ['system Administrator and SysAdmin', [SYSTEM_ADMIN, SYS_ADMIN], ['learner']],
    [
      'every administrator role at once',
      [INSTITUTION_ADMIN, SYSTEM_ADMIN, SYS_ADMIN, CONTEXT_ADMIN],
      ['author'],
    ],
    [
      'made-up admin values',
      ['admin', 'Administrator', 'urn:lti:sysrole:ims/lis/Administrator', 'hvl:admin'],
      ['learner'],
    ],
    ['admin values next to Instructor', [INSTRUCTOR, 'admin', SYS_ADMIN], ['author']],
  ])('[LTI-004] a forged admin-like set (%s) never yields admin', (_case, roles, expected) => {
    // WHY: the exact result, not only "no admin", so an admin-like role that wrongly gave author would fail too.
    expect(mapLtiRoles(roles)).toEqual(expected);
  });

  it.each([
    ['missing', undefined],
    ['a single string instead of a list', INSTRUCTOR],
    ['an object', { 0: INSTRUCTOR }],
    ['a list of non-strings', [{ role: INSTRUCTOR }, 1, null]],
  ])('[LTI-004] a malformed roles claim (%s) → learner', (_case, claim) => {
    expect(mapLtiRoles(claim)).toEqual(['learner']);
  });

  it('[LTI-004] returns a frozen list, so a caller cannot add admin to it', () => {
    const roles = mapLtiRoles([INSTRUCTOR]);
    expect(Object.isFrozen(roles)).toBe(true);
    expect(() => (roles as unknown as string[]).push('admin')).toThrow(TypeError);
  });
});
