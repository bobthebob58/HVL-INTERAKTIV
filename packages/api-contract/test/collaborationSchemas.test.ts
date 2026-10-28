/**
 * Tests the collaboration shapes: people search returns staff as `{ userId, displayName }` only, the co-author and
 * bank limits, the bank entry without the author's private fields, and a copy's attribution.
 *
 * Spec: PROD-007, DATA-002
 */
import { describe, expect, it } from 'vitest';
import {
  bankEntrySchema,
  bankListingRequestSchema,
  coAuthorListSchema,
  contentDetailSchema,
  MAX_COAUTHORS,
  peopleQuerySchema,
  peopleSearchResponseSchema,
  PEOPLE_SEARCH_MAX_RESULTS,
  personSchema,
} from '../src/index.js';

const at = '2026-10-28T12:00:00.000Z';
const userId = '0192f0c4-0000-7000-8000-00000000000a';
const contentId = '0192f0c4-0000-7000-8000-000000000001';
const kari = { userId, displayName: 'Kari Nordmann' };

describe('[PROD-007] people search and co-authors', () => {
  it('[DATA-002] a person is a user ID and a display name only, never an e-mail address or a Feide ID', () => {
    // Act and assert
    expect(Object.keys(personSchema.shape).sort()).toEqual(['displayName', 'userId']);
    expect(personSchema.safeParse({ ...kari, displayName: null }).success).toBe(true);
    for (const extra of [{ email: 'kari@hvl.no' }, { feideId: 'kari@hvl.no' }, { affiliation: 'employee' }]) {
      expect(personSchema.safeParse({ ...kari, ...extra }).success, JSON.stringify(extra)).toBe(false);
    }
  });

  it('[PROD-007] a search query is trimmed and 3 to 100 characters, and at most 10 people come back', () => {
    // Act and assert
    expect(peopleQuerySchema.parse({ q: '  Kar  ' }).q).toBe('Kar');
    for (const q of ['Ka', '  Ka  ', 'x'.repeat(101)])
      expect(peopleQuerySchema.safeParse({ q }).success, q).toBe(false);
    const people = (n: number) => ({ people: Array.from({ length: n }, () => kari) });
    expect(peopleSearchResponseSchema.safeParse(people(PEOPLE_SEARCH_MAX_RESULTS)).success).toBe(true);
    expect(peopleSearchResponseSchema.safeParse(people(PEOPLE_SEARCH_MAX_RESULTS + 1)).success).toBe(false);
  });

  it('[PROD-007] the co-author list has the owner, at most 20 co-authors with isSelf, and who may manage', () => {
    // Arrange
    const list = (n: number) => ({
      owner: kari,
      coAuthors: Array.from({ length: n }, () => ({ ...kari, isSelf: false })),
      mayManage: true,
    });
    // Act and assert
    expect(coAuthorListSchema.safeParse(list(MAX_COAUTHORS)).success).toBe(true);
    expect(coAuthorListSchema.safeParse(list(MAX_COAUTHORS + 1)).success).toBe(false);
    expect(coAuthorListSchema.safeParse({ ...list(1), coAuthors: [kari] }).success).toBe(false);
  });
});

describe('[PROD-007] the content bank and copies', () => {
  it('[PROD-007] listing names the consent version, and an entry never carries the rationale or course code', () => {
    // Arrange
    const entry = {
      contentId,
      title: 'Quiz',
      mainLibrary: 'H5P.MultiChoice',
      phase: 'etterarbeid',
      outcomes: [{ text: 'Forklare', category: 'ferdigheiter' }],
      ownerName: 'Kari Nordmann',
      updatedAt: at,
      listedAt: at,
    };
    // Act and assert
    expect(bankListingRequestSchema.safeParse({ consentVersion: 1 }).success).toBe(true);
    expect(bankListingRequestSchema.safeParse({}).success).toBe(false);
    expect(bankEntrySchema.safeParse(entry).success).toBe(true);
    expect(bankEntrySchema.safeParse({ ...entry, rationale: 'Fordi.' }).success).toBe(false);
    expect(bankEntrySchema.safeParse({ ...entry, courseCode: 'SYK110' }).success).toBe(false);
    expect(bankEntrySchema.safeParse({ ...entry, ownerEmail: 'kari@hvl.no' }).success).toBe(false);
  });

  it('[PROD-007] an activity detail may say where a copy came from, by ID, title and the source author’s name', () => {
    // Arrange
    const detail = {
      id: contentId,
      title: 'Quiz (kopi)',
      mainLibrary: 'H5P.MultiChoice',
      status: 'draft',
      visibility: 'private',
      updatedAt: at,
      publishedAt: null,
      role: 'owner',
      mayEdit: true,
      mayPublish: true,
    };
    const source = { sourceContentId: userId, sourceTitle: 'Quiz', sourceAuthorName: 'Kari Nordmann' };
    // Act and assert
    expect(contentDetailSchema.safeParse(detail).success).toBe(true);
    expect(contentDetailSchema.safeParse({ ...detail, ...source }).success).toBe(true);
    expect(contentDetailSchema.safeParse({ ...detail, sourceAuthorUserId: userId }).success).toBe(false);
  });
});
