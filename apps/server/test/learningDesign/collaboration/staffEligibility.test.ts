/**
 * Unit tests of the collaboration eligibility rule (D-090, D-091 as amended): who is an HVL staff author, who reads
 * the bank, and how long a Feide login keeps a person findable.
 *
 * Spec: PROD-007
 */
import { describe, expect, it } from 'vitest';
import type { Principal } from '../../../src/auth/Principal.js';
import {
  coAuthorSearchableAtFor,
  findableStaffWhere,
  isBankReader,
  isBankReaderActor,
  isEligibleStaffAuthor,
  isFindableStaff,
  isSearchable,
  searchableCutoff,
} from '../../../src/learningDesign/collaboration/staffEligibility.js';
import { testActor } from '../../support/testActors.js';

const staff = { roles: ['author'], hvlMember: true, studentAuthor: false } as const;

describe('[PROD-007] eligible HVL staff author', () => {
  it.each([
    ['an HVL staff author', staff, true],
    ['an HVL staff author who is also admin', { ...staff, roles: ['author', 'admin'] }, true],
    ['a student author', { ...staff, studentAuthor: true }, false],
    ['an admin-only member', { ...staff, roles: ['learner', 'admin'] }, false],
    ['a learner', { ...staff, roles: ['learner'] }, false],
    ['an author outside HVL', { ...staff, hvlMember: false }, false],
  ] as const)('[PROD-007] %s → %s', (_name, facts, eligible) => {
    expect(isEligibleStaffAuthor(facts)).toBe(eligible);
    const now = new Date('2026-10-29T10:00:00.000Z');
    expect(coAuthorSearchableAtFor(facts, now)).toEqual(eligible ? now : null);
  });

  it('[PROD-007] the bank is for portal staff authors only, never an LTI principal or a student author', () => {
    // Arrange
    const portal = {
      ...staff,
      userId: 'u',
      learnerKey: 'k',
      mode: 'portal',
      locale: 'nn',
      feideAuthenticated: true,
    };
    // Act and assert
    expect(isBankReader(portal as Principal)).toBe(true);
    expect(isBankReader({ ...portal, mode: 'lti' } as Principal)).toBe(false);
    expect(isBankReader({ ...portal, studentAuthor: true } as Principal)).toBe(false);
    expect(isBankReaderActor(testActor('author'))).toBe(true);
    expect(isBankReaderActor(testActor('author', { studentAuthor: true }))).toBe(false);
    expect(isBankReaderActor(testActor('author', { feideAuthenticated: false, hvlMember: false }))).toBe(
      false,
    );
    expect(isBankReaderActor(testActor('learner'))).toBe(false);
  });
});

describe('[PROD-007] findable for 13 months after a Feide login', () => {
  it.each([
    ['2026-10-29T10:00:00.000Z', '2025-09-29T10:00:00.000Z'],
    ['2027-03-31T00:00:00.000Z', '2026-02-28T00:00:00.000Z'],
    ['2028-01-31T12:00:00.000Z', '2026-12-31T12:00:00.000Z'],
  ])('[PROD-007] at %s the cut-off is %s', (now, cutoff) => {
    expect(searchableCutoff(new Date(now)).toISOString()).toBe(cutoff);
  });

  it('[PROD-007] a date after the cut-off counts, the cut-off itself and null do not', () => {
    // Arrange
    const now = new Date('2026-10-29T10:00:00.000Z');
    const cutoff = searchableCutoff(now);
    // Act and assert
    expect(isSearchable(new Date(cutoff.getTime() + 1), now)).toBe(true);
    expect(isSearchable(cutoff, now)).toBe(false);
    expect(isSearchable(null, now)).toBe(false);
    expect(findableStaffWhere(now)).toEqual({ kind: 'staff', coAuthorSearchableAt: { gt: cutoff } });
  });

  it('[PROD-007] a stored account is findable staff as the bank list’s filter says: kind staff and a recent date', () => {
    // Arrange
    const now = new Date('2026-10-29T10:00:00.000Z');
    const recent = new Date(searchableCutoff(now).getTime() + 1);
    // Act
    const findable = [
      isFindableStaff({ kind: 'staff', coAuthorSearchableAt: recent }, now),
      isFindableStaff({ kind: 'learner', coAuthorSearchableAt: recent }, now),
      isFindableStaff({ kind: 'staff', coAuthorSearchableAt: searchableCutoff(now) }, now),
      isFindableStaff({ kind: 'staff', coAuthorSearchableAt: null }, now),
    ];
    // Assert
    expect(findable).toEqual([true, false, false, false]);
  });
});
