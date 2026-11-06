/**
 * Unit tests for the mapping between H5P user data and stored learner-state rows.
 *
 * Spec: H5P-005, PROD-008
 */
import { describe, expect, it } from 'vitest';
import type { IContentUserData } from '@lumieducation/h5p-server';
import type { H5PUserData } from '../../src/generated/prisma/client.js';
import {
  isContentUuid,
  isDeleteSignal,
  isLearnerKey,
  mainStateFirst,
  stateKey,
  stateKeyOf,
  toUserData,
} from '../../src/h5p/storage/learnerStateRows.js';

const CONTENT = '0199f2a4-1111-7000-8000-000000000001';
const LEARNER = 'q1Zr8n6yJb0kD3xV9mWc2tLs7pQe4uHa5gFiOo1KjN0';

const state = (overrides: Partial<IContentUserData>): IContentUserData => ({
  contentId: CONTENT,
  dataType: 'state',
  subContentId: '0',
  userState: '{"answers":[1]}',
  userId: LEARNER,
  preload: true,
  invalidate: true,
  ...overrides,
});

const row = (overrides: Partial<H5PUserData>): H5PUserData => ({
  id: '0199f2a4-2222-7000-8000-000000000002',
  contentId: CONTENT,
  subContentId: '0',
  dataType: 'state',
  learnerKey: LEARNER,
  contextId: '',
  data: '{"page":3}',
  preload: true,
  invalidate: false,
  updatedAt: new Date('2026-10-22T10:00:00Z'),
  academicYear: 2026,
  ...overrides,
});

describe('[H5P-005] learner state rows', () => {
  it('[H5P-005] keys a state by content, sub-content, data type, learnerKey and context', () => {
    // Act and assert: from an H5P state, and from separate parts with the defaults filled in.
    expect(stateKeyOf(state({ contextId: 'course-1' }), CONTENT)).toEqual({
      contentId: CONTENT,
      subContentId: '0',
      dataType: 'state',
      learnerKey: LEARNER,
      contextId: 'course-1',
    });
    expect(stateKey(CONTENT, 'state', '', LEARNER, undefined)).toEqual({
      contentId: CONTENT,
      subContentId: '0',
      dataType: 'state',
      learnerKey: LEARNER,
      contextId: '',
    });
  });

  it('[H5P-005] refuses a state without a learnerKey or a data type', () => {
    for (const userId of ['', undefined, CONTENT, 'amina@stud.hvl.no', '01019912345', `${LEARNER}=`]) {
      expect(() => stateKeyOf(state({ userId }), CONTENT)).toThrow(TypeError);
    }
    expect(() => stateKeyOf(state({ dataType: '' }), CONTENT)).toThrow(TypeError);
  });

  it('[H5P-005] accepts only pseudonym-shaped learner IDs and UUID content IDs', () => {
    expect(isLearnerKey(LEARNER)).toBe(true);
    expect(isLearnerKey(LEARNER.slice(1))).toBe(false);
    expect(isLearnerKey(`${LEARNER.slice(1)}+`)).toBe(false);
    expect(isLearnerKey(undefined)).toBe(false);
    expect(isContentUuid(CONTENT)).toBe(true);
    expect(isContentUuid(CONTENT.toUpperCase())).toBe(true);
    for (const id of ['', '1', `${CONTENT}x`, CONTENT.replaceAll('-', ''), "1' OR '1'='1", undefined]) {
      expect(isContentUuid(id)).toBe(false);
    }
  });

  it('[H5P-005] recognises the h5p.js delete signal and nothing else', () => {
    expect(isDeleteSignal('0')).toBe(true);
    expect(isDeleteSignal(0)).toBe(true);
    for (const value of ['', '00', '"0"', '{}', 'null', null, undefined, false]) {
      expect(isDeleteSignal(value)).toBe(false);
    }
  });

  it('[H5P-005][PROD-008] maps an empty context back to "no context" and keeps other contexts', () => {
    // Act
    const withoutContext = toUserData(row({}));
    // Assert
    expect(withoutContext).toEqual({
      contentId: CONTENT,
      subContentId: '0',
      dataType: 'state',
      userId: LEARNER,
      userState: '{"page":3}',
      preload: true,
      invalidate: false,
    });
    expect('contextId' in withoutContext).toBe(false);
    // Act and assert: another context is kept, and object data comes back as a JSON string.
    expect(toUserData(row({ contextId: 'course-2' })).contextId).toBe('course-2');
    expect(toUserData(row({ data: { page: 4 } })).userState).toBe('{"page":4}');
  });

  it('[H5P-005] puts the main state first, then sub-content and data types in a stable order', () => {
    // Arrange: rows in no particular order.
    const rows = [
      { subContentId: 'f3b1c2d4-0000-4000-8000-000000000000', dataType: 'state' },
      { subContentId: '0', dataType: 'state' },
      { subContentId: '0a1b2c3d-0000-4000-8000-000000000000', dataType: 'state' },
      { subContentId: '0', dataType: 'answers' },
      { subContentId: '0a1b2c3d-0000-4000-8000-000000000000', dataType: 'extra' },
    ];
    // Act and assert
    expect([...rows].sort(mainStateFirst)).toEqual([
      { subContentId: '0', dataType: 'answers' },
      { subContentId: '0', dataType: 'state' },
      { subContentId: '0a1b2c3d-0000-4000-8000-000000000000', dataType: 'extra' },
      { subContentId: '0a1b2c3d-0000-4000-8000-000000000000', dataType: 'state' },
      { subContentId: 'f3b1c2d4-0000-4000-8000-000000000000', dataType: 'state' },
    ]);
  });
});
