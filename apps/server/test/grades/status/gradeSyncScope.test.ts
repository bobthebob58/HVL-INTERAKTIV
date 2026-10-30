/**
 * Table tests for who sees which placements' grade sync: owners and co-authors every placement in the portal, a
 * Canvas author the launch's course only (also an owner), and learners, admins and colleagues nothing.
 *
 * Spec: LTI-012, LTI-007
 */
import { describe, expect, it } from 'vitest';
import type { Principal, Role } from '../../../src/auth/Principal.js';
import { gradeSyncScope, placementWhere } from '../../../src/grades/status/gradeSyncScope.js';

const OWNER = 'owner';
const FACTS = { ownerUserId: OWNER, coAuthorIds: ['coauthor'] };
const LAUNCH = {
  platformId: 'platform-a',
  deploymentId: 'd',
  contextId: 'SYK110',
  messageType: 'LtiResourceLinkRequest',
};

const portal = (userId: string, roles: Role[]): Pick<Principal, 'userId' | 'roles' | 'mode' | 'lti'> => ({
  userId,
  roles,
  mode: 'portal',
});
const canvas = (userId: string, roles: Role[]): Pick<Principal, 'userId' | 'roles' | 'mode' | 'lti'> => ({
  userId,
  roles,
  mode: 'lti',
  lti: LAUNCH,
});
const COURSE = { kind: 'course', platformId: 'platform-a', contextId: 'SYK110' } as const;

describe('[LTI-012] the grade-sync scope', () => {
  it.each([
    ['the owner in the portal', portal(OWNER, ['author']), { kind: 'all' }],
    ['a co-author in the portal', portal('coauthor', ['author']), { kind: 'all' }],
    ['the owner who is also an admin', portal(OWNER, ['author', 'admin']), { kind: 'all' }],
    ['a colleague who may view it', portal('colleague', ['author']), undefined],
    ['an admin who does not author it', portal('admin', ['author', 'admin']), undefined],
    ['an admin without the author role', portal(OWNER, ['learner', 'admin']), undefined],
    ['a learner who owns it (a former author)', portal(OWNER, ['learner']), undefined],
    ['a Canvas author who does not own it', canvas('teacher', ['author']), COURSE],
    ['a Canvas author who owns it', canvas(OWNER, ['author']), COURSE],
    ['a Canvas learner', canvas('student', ['learner']), undefined],
  ])('[LTI-012] %s', (_who, principal, expected) => {
    // Act and assert
    expect(gradeSyncScope(principal, FACTS)).toEqual(expected);
  });

  it('[LTI-012] a Canvas principal without launch facts gets nothing', () => {
    expect(gradeSyncScope({ userId: 'teacher', roles: ['author'], mode: 'lti' }, FACTS)).toBeUndefined();
  });

  it('[LTI-007] the Canvas scope filters by the launch’s platform and course, never only the course', () => {
    // Act and assert
    expect(placementWhere('c', COURSE)).toEqual({
      contentId: 'c',
      platformId: 'platform-a',
      contextId: 'SYK110',
    });
    expect(placementWhere('c', { kind: 'all' })).toEqual({ contentId: 'c' });
  });
});
