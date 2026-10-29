/**
 * testActors — one way for tests to make an HvlH5pActor, with harmless defaults.
 *
 * Why: many tests need an actor (an author, a learner in a course, an admin) and only care about one or two of
 *      its fields. One helper keeps the defaults consistent (Nynorsk, HVL member, Feide, no LTI launch) and gives
 *      every actor its own account ID, so tests cannot accidentally share an identity.
 * Spec: H5P-006
 * Tests: shared by apps/server/test/h5p/*.test.ts and apps/server/test/support/*Testbed.ts.
 */
import type { H5pRole, HvlH5pActor } from '../../src/h5p/HvlH5pUser.js';

let counter = 0;

/**
 * An actor with a fresh account ID and the given role.
 * @param role - Role in the permission matrix.
 * @param overrides - Any other field, e.g. `{ locale: 'en' }` or a real `learnerKey`.
 * @returns The actor.
 */
export function testActor(role: H5pRole, overrides: Partial<HvlH5pActor> = {}): HvlH5pActor {
  counter += 1;
  return {
    accountId: `0192f0c4-0000-7000-8000-${String(counter).padStart(12, '0')}`,
    role,
    learnerKey: `learner-key-${counter}`,
    contextId: '',
    locale: 'nn',
    hvlMember: true,
    feideAuthenticated: true,
    studentAuthor: false,
    ltiLaunchContentIds: [],
    ...overrides,
  };
}
