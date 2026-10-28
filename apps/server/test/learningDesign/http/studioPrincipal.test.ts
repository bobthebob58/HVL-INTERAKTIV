/**
 * Unit tests for the sign-in check of the studio's portal-only areas: a portal author passes, and a signed-out
 * request, an LTI principal (even an instructor) and a portal learner are refused with the documented codes.
 *
 * Spec: AUTH-003, PROD-007
 */
import type { Response } from 'express';
import { describe, expect, it } from 'vitest';
import type { Principal } from '../../../src/auth/Principal.js';
import { HttpError } from '../../../src/http/HttpError.js';
import { requirePortalAuthor } from '../../../src/learningDesign/http/studioPrincipal.js';

const PORTAL_AUTHOR: Principal = {
  userId: 'u-1',
  learnerKey: 'k-1',
  roles: ['author'],
  mode: 'portal',
  locale: 'nn',
  hvlMember: true,
  feideAuthenticated: true,
  studentAuthor: false,
};

const responseOf = (principal?: Principal): Response => ({ locals: { principal } }) as unknown as Response;

/** The status and machine code of what the check throws, or `passed`. */
const outcome = (principal?: Principal): readonly [number, string] | 'passed' => {
  try {
    requirePortalAuthor(responseOf(principal));
    return 'passed';
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    return [(error as HttpError).status, (error as HttpError).errorCode];
  }
};

describe('[AUTH-003] requirePortalAuthor', () => {
  it('[AUTH-003] returns the principal of a portal author, a student author and an admin', () => {
    // Arrange
    const student = { ...PORTAL_AUTHOR, studentAuthor: true };
    const admin = { ...PORTAL_AUTHOR, roles: ['admin'] as const };
    // Act
    const passed = [PORTAL_AUTHOR, student, admin].map((principal) =>
      requirePortalAuthor(responseOf(principal)),
    );
    // Assert
    expect(passed).toEqual([PORTAL_AUTHOR, student, admin]);
  });

  it('[AUTH-003] refuses a signed-out request with 401 hvl:unauthenticated', () => {
    expect(outcome()).toEqual([401, 'hvl:unauthenticated']);
  });

  it('[PROD-007] refuses an LTI principal, even an instructor, as not signed in to the portal (D-098)', () => {
    // Arrange
    const instructor: Principal = {
      ...PORTAL_AUTHOR,
      mode: 'lti',
      hvlMember: false,
      feideAuthenticated: false,
    };
    // Act and assert
    expect(outcome(instructor)).toEqual([401, 'hvl:unauthenticated']);
  });

  it('[AUTH-003] refuses a portal learner with 403 error.forbidden', () => {
    expect(outcome({ ...PORTAL_AUTHOR, roles: ['learner'] })).toEqual([403, 'error.forbidden']);
  });
});
