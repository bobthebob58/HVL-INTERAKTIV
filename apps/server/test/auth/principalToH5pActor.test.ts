/**
 * Tests for the mapping from a principal to the H5P actor.
 *
 * Spec: H5P-006, H5P-007, LTI-007
 */
import { describe, expect, it } from 'vitest';
import type { Principal } from '../../src/auth/Principal.js';
import { principalToH5pActor } from '../../src/auth/principalToH5pActor.js';

const PORTAL: Principal = {
  userId: 'u1',
  learnerKey: 'lk1',
  roles: ['author', 'admin'],
  mode: 'portal',
  locale: 'nb',
  hvlMember: true,
  feideAuthenticated: true,
  studentAuthor: false,
};
const LTI: Principal = {
  ...PORTAL,
  roles: ['learner'],
  mode: 'lti',
  hvlMember: false,
  feideAuthenticated: false,
  lti: {
    platformId: 'p',
    deploymentId: 'd',
    contextId: 'course-7',
    contentId: 'c1',
    messageType: 'LtiResourceLinkRequest',
  },
};

describe('[H5P-006] principal to H5P actor', () => {
  it('[H5P-006] a portal admin is an admin actor without a course, with the CSRF token for H5P URLs', () => {
    // Act and assert
    expect(principalToH5pActor(PORTAL, { name: 'csrf', value: 't' })).toEqual({
      accountId: 'u1',
      role: 'admin',
      learnerKey: 'lk1',
      contextId: '',
      locale: 'nb',
      hvlMember: true,
      feideAuthenticated: true,
      ltiLaunchContentIds: [],
      urlToken: { name: 'csrf', value: 't' },
    });
  });

  it('[LTI-007] an LTI learner keeps state per course and may view the launched activity only', () => {
    const actor = principalToH5pActor(LTI, { name: 'ltik', value: 'eyJ' });
    expect(actor).toMatchObject({
      role: 'learner',
      contextId: 'course-7',
      ltiLaunchContentIds: ['c1'],
      hvlMember: false,
    });
    expect(actor.urlToken).toEqual({ name: 'ltik', value: 'eyJ' });
  });

  it('[H5P-007] puts no token into URLs when the request has none', () => {
    expect(principalToH5pActor(PORTAL)).not.toHaveProperty('urlToken');
    expect(principalToH5pActor(PORTAL, { name: 'csrf', value: '' })).not.toHaveProperty('urlToken');
  });
});
