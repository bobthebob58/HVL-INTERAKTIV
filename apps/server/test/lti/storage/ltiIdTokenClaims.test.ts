/**
 * Tests for the ID-token claim allowlist: what is kept, what is dropped, and that the input is never touched.
 *
 * Spec: LTI-002, DATA-002
 */
import type { IdTokenClaims } from 'ltijs';
import { describe, expect, it } from 'vitest';
import { minimiseIdTokenClaims } from '../../../src/lti/storage/ltiIdTokenClaims.js';
import { canvasLaunchClaims, PERSONAL_VALUES, storedLaunchClaims } from './ltiLaunchClaims.js';

const INPUT = {
  iss: 'https://canvas.example.test',
  clientId: 'client-1',
  platformId: 'p-1',
  deploymentId: 'd-1',
};
const LTI = 'https://purl.imsglobal.org/spec/lti/claim/';

/** Freezes an object and everything inside it, as ltijs's own deepFreeze does. */
const deepFreeze = <T>(value: T): T => {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

/** Every object inside a value, the value itself included. */
const objectsIn = (value: unknown): object[] =>
  typeof value === 'object' && value !== null ? [value, ...Object.values(value).flatMap(objectsIn)] : [];

describe('[LTI-002] ID-token claim allowlist (D-052)', () => {
  it('[LTI-002] keeps exactly the claims and fields that later ltik requests read', () => {
    expect(minimiseIdTokenClaims(canvasLaunchClaims(INPUT))).toEqual(storedLaunchClaims(INPUT));
  });

  it('[DATA-002] drops names, e-mail, picture, lis, mentor roles, feide_login and unknown claims', () => {
    // Act
    const stored = minimiseIdTokenClaims(canvasLaunchClaims(INPUT));
    // Assert
    for (const claim of ['name', 'given_name', 'family_name', 'middle_name', 'picture', 'email']) {
      expect(stored).not.toHaveProperty([claim]);
    }
    for (const claim of ['lis', 'role_scope_mentor', 'lti11_legacy_user_id', 'lti1p1', 'for_user']) {
      expect(stored).not.toHaveProperty([`${LTI}${claim}`]);
    }
    expect(stored[`${LTI}custom`]).toEqual({
      contentId: expect.any(String),
      hvl_placement: 'assignment_selection',
    });
    expect(stored[`${LTI}tool_platform`]).not.toHaveProperty('contact_email');
    const text = JSON.stringify(stored);
    expect(PERSONAL_VALUES.filter((value) => text.includes(value))).toEqual([]);
  });

  it('[LTI-002] never changes its argument and accepts a deeply frozen one', () => {
    // Arrange
    const claims = deepFreeze(canvasLaunchClaims(INPUT));
    // Act
    const stored = minimiseIdTokenClaims(claims);
    // Assert
    expect(claims).toEqual(canvasLaunchClaims(INPUT));
    expect(Object.isFrozen(stored)).toBe(false);
  });

  it('[LTI-002] returns a deep copy that shares no object with its argument', () => {
    // Arrange
    const claims = canvasLaunchClaims(INPUT);
    const inputObjects = new Set(objectsIn(claims));
    // Act
    const stored = minimiseIdTokenClaims(claims);
    (stored[`${LTI}context`] as { id: string }).id = 'changed';
    (stored[`${LTI}roles`] as string[]).push('changed');
    // Assert
    expect(objectsIn(stored).filter((object) => inputObjects.has(object))).toEqual([]);
    expect(claims).toEqual(canvasLaunchClaims(INPUT));
  });

  it('[DATA-002] drops custom values that are not strings and object claims that are not objects', () => {
    // Arrange
    const claims = {
      ...storedLaunchClaims(INPUT),
      [`${LTI}custom`]: { contentId: { nested: 'Kari Nordmann' }, hvl_placement: 7 },
      [`${LTI}context`]: 'course-1',
      [`${LTI}resource_link`]: ['link-1'],
    } as unknown as IdTokenClaims;
    // Act
    const stored = minimiseIdTokenClaims(claims);
    // Assert
    expect(stored).not.toHaveProperty([`${LTI}custom`]);
    expect(stored).not.toHaveProperty([`${LTI}context`]);
    expect(stored).not.toHaveProperty([`${LTI}resource_link`]);
    expect(stored.iss).toBe(INPUT.iss);
  });

  it('[LTI-002] keeps a launch without optional claims as it is, adding nothing', () => {
    // Arrange
    const { iss, sub, client_id, platform_id } = storedLaunchClaims(INPUT);
    const minimal = { iss, sub, client_id, platform_id } as IdTokenClaims;
    // Act and assert
    expect(minimiseIdTokenClaims(minimal)).toEqual(minimal);
  });
});
