/**
 * Tests for the H5P actor and its account and state views.
 *
 * Spec: H5P-006, H5P-005, H5P-007, DATA-002
 */
import { describe, it, expect } from 'vitest';
import { asAccountUser, asStateUser, isHvlH5pUser, type HvlH5pActor } from '../../src/h5p/HvlH5pUser.js';

const ACTOR: HvlH5pActor = {
  accountId: '0192f0c4-0000-7000-8000-000000000001',
  role: 'learner',
  learnerKey: 'fVM1n87kyTwxPqqVDl8B3LabYsblWepkkhGCUE-d9Mo',
  contextId: 'course-1',
  locale: 'nn',
  hvlMember: true,
  feideAuthenticated: true,
  studentAuthor: false,
  ltiLaunchContentIds: ['c1'],
};

describe('[H5P-006] H5P users', () => {
  it('[H5P-005] the account view presents the account ID and the state view the learnerKey', () => {
    expect(asAccountUser(ACTOR)).toMatchObject({ id: ACTOR.accountId, view: 'account', type: 'local' });
    expect(asStateUser(ACTOR)).toMatchObject({ id: ACTOR.learnerKey, view: 'state' });
  });

  it('[DATA-002] no view carries a name or an e-mail address', () => {
    for (const user of [asAccountUser(ACTOR), asStateUser(ACTOR)]) {
      expect(user.name).toBe('');
      expect(user.email).toBe('');
    }
  });

  it('[H5P-006] only users issued by this module are recognised', () => {
    const real = asStateUser(ACTOR);
    expect(isHvlH5pUser(real)).toBe(true);
    expect(isHvlH5pUser({ ...real })).toBe(false);
    expect(isHvlH5pUser({ id: 'x', name: '', email: '', type: 'local', actor: ACTOR, view: 'state' })).toBe(
      false,
    );
    expect(isHvlH5pUser(undefined)).toBe(false);
  });

  it('[H5P-006] users and their actors cannot be changed after they are issued', () => {
    const launched = [...ACTOR.ltiLaunchContentIds];
    const user = asAccountUser({ ...ACTOR, ltiLaunchContentIds: launched });
    launched.push('c2');
    expect(user.actor.ltiLaunchContentIds).toEqual(['c1']);
    expect(Object.isFrozen(user) && Object.isFrozen(user.actor)).toBe(true);
    expect(() => {
      (user.actor as { role: string }).role = 'admin';
    }).toThrow(TypeError);
  });

  it('[H5P-007] the URL token is copied and frozen with the actor, and absent when the request has none', () => {
    // Arrange
    const token = { name: 'ltik' as const, value: 'eyJ.a.b' };
    // Act
    const user = asStateUser({ ...ACTOR, urlToken: token });
    token.value = 'changed';
    // Assert
    expect(user.actor.urlToken).toEqual({ name: 'ltik', value: 'eyJ.a.b' });
    expect(Object.isFrozen(user.actor.urlToken)).toBe(true);
    expect(asAccountUser(ACTOR).actor.urlToken).toBeUndefined();
  });
});
