/**
 * Tests for the principal: role order and the invariants that keep an LTI launch from becoming an admin.
 *
 * Spec: LTI-004, AUTH-002
 */
import { describe, expect, it } from 'vitest';
import { canAuthor, highestRole, sealPrincipal, type Principal } from '../../src/auth/Principal.js';

const LTI: Principal = {
  userId: 'u1',
  learnerKey: 'lk',
  roles: ['learner'],
  mode: 'lti',
  locale: 'nn',
  hvlMember: false,
  feideAuthenticated: false,
  studentAuthor: false,
  lti: { platformId: 'p1', deploymentId: 'd1', contextId: 'c1', messageType: 'LtiResourceLinkRequest' },
};
const PORTAL: Principal = {
  ...LTI,
  mode: 'portal',
  hvlMember: true,
  feideAuthenticated: true,
  lti: undefined,
};

describe('[LTI-004] principal', () => {
  it('[AUTH-002] the H5P role is the highest role held', () => {
    expect(highestRole([])).toBe('learner');
    expect(highestRole(['author', 'learner'])).toBe('author');
    expect(highestRole(['admin', 'learner', 'author'])).toBe('admin');
    expect(canAuthor({ roles: ['learner'] })).toBe(false);
    expect(canAuthor({ roles: ['learner', 'author'] })).toBe(true);
  });

  it('[LTI-004] refuses to build an LTI principal with admin or Feide facts', () => {
    expect(() => sealPrincipal({ ...LTI, roles: ['author', 'admin'] })).toThrow('cannot be admin');
    expect(() => sealPrincipal({ ...LTI, hvlMember: true })).toThrow('no Feide facts');
    expect(() => sealPrincipal({ ...LTI, feideAuthenticated: true })).toThrow('no Feide facts');
    expect(() => sealPrincipal({ ...LTI, lti: undefined })).toThrow('launch facts');
    expect(() => sealPrincipal({ ...PORTAL, lti: LTI.lti })).toThrow('no launch facts');
  });

  it('[LTI-004] freezes the principal, its roles and its launch facts, without duplicate roles', () => {
    // Act
    const sealed = sealPrincipal({ ...LTI, roles: ['learner', 'author', 'learner'] });
    // Assert
    expect(sealed.roles).toEqual(['learner', 'author']);
    expect(Object.isFrozen(sealed) && Object.isFrozen(sealed.roles) && Object.isFrozen(sealed.lti)).toBe(
      true,
    );
    expect(sealPrincipal({ ...PORTAL, roles: ['admin'] }).roles).toEqual(['admin']);
  });
});
