/**
 * collaboration — the shapes of people search, co-authors, the HVL content bank and duplicating an activity.
 *
 * Why: PROD-007 finds co-authors among HVL staff, lists activities in a content bank for colleagues, and copies an
 *      activity with attribution. D-090 limits search to findable staff and to `{ userId, displayName }`; D-091 makes
 *      the bank opt-in with a consent text; D-092 makes the copy a private draft that keeps a link to its source.
 * Spec: PROD-007, DATA-002
 * Invariants:
 *   - PRIVACY: a person is `{ userId, displayName }` only: never an e-mail address, a Feide ID or an affiliation.
 *     `displayName` is null when Feide gave no name.
 *   - A search query is trimmed and 3 to 100 characters; at most 10 people come back (D-090).
 *   - An activity has at most 20 co-authors (D-090).
 *   - A bank entry never carries the rationale or the course code, which belong to the source's author (D-092).
 * Collaborators: ./learningDesign.ts, ./learnerInfo.ts, ./studio.ts, ./sourceAttribution.ts,
 *   apps/server/src/learningDesign/http/collaborationRoutes.ts, apps/web.
 * Tests: packages/api-contract/test/collaborationSchemas.test.ts
 */
import { z } from 'zod';
import { estimatedStudentMinutesSchema, learnerPurposeSchema } from './learnerInfo.js';
import { learningOutcomeSchema } from './learningDesign.js';
import { phaseKeySchema } from './studio.js';

/** The shortest people-search query (D-090). */
export const PEOPLE_QUERY_MIN_LENGTH = 3;
/** The longest people-search query. */
export const PEOPLE_QUERY_MAX_LENGTH = 100;
/** The most people one search returns (D-090). */
export const PEOPLE_SEARCH_MAX_RESULTS = 10;
/** The most co-authors one activity may have (D-090). */
export const MAX_COAUTHORS = 20;
/** The version of the bank's consent text; a listing request must name it (D-091). */
export const BANK_CONSENT_VERSION = 1;

/** A colleague, as search, the co-author list and the bank show them (D-090). */
export const personSchema = z.strictObject({
  userId: z.uuid(),
  displayName: z.string().min(1).nullable(),
});
/** A colleague. */
export type Person = z.infer<typeof personSchema>;

/** `GET /api/people?q=`: a name (or a Feide ID, looked up exactly); the server never logs it (D-090). */
export const peopleQuerySchema = z.strictObject({
  q: z
    .string()
    .trim()
    .min(PEOPLE_QUERY_MIN_LENGTH)
    .max(PEOPLE_QUERY_MAX_LENGTH)
    .describe('A name, at least 3 characters, or a Feide ID; never logged.'),
});
/** The query of a people search. */
export type PeopleQuery = z.infer<typeof peopleQuerySchema>;

/** `GET /api/people` → 200: findable HVL staff only, at most 10. */
export const peopleSearchResponseSchema = z.strictObject({
  people: z.array(personSchema).max(PEOPLE_SEARCH_MAX_RESULTS),
});
/** The answer of a people search. */
export type PeopleSearchResponse = z.infer<typeof peopleSearchResponseSchema>;

/** A co-author; `isSelf` lets a co-author find the entry they may remove (the web app knows no user ID). */
export const coAuthorSchema = personSchema.extend({ isSelf: z.boolean() });
/** A co-author. */
export type CoAuthor = z.infer<typeof coAuthorSchema>;

/**
 * An activity's owner and co-authors. `mayManage` is true for the owner, who adds and removes co-authors; a
 * co-author may only remove themselves (D-090).
 * @spec PROD-007
 */
export const coAuthorListSchema = z.strictObject({
  owner: personSchema,
  coAuthors: z.array(coAuthorSchema).max(MAX_COAUTHORS),
  mayManage: z.boolean(),
});
/** An activity's authors. */
export type CoAuthorList = z.infer<typeof coAuthorListSchema>;

/** The body of adding a co-author: a person from people search. */
export const coAuthorAddRequestSchema = z.strictObject({ userId: z.uuid() });
/** The body of adding a co-author. */
export type CoAuthorAddRequest = z.infer<typeof coAuthorAddRequestSchema>;

/** Listing an activity in the bank: the consent text version the owner accepted (D-091). */
export const bankListingRequestSchema = z.strictObject({ consentVersion: z.int().min(1) });
/** The body of a bank listing request. */
export type BankListingRequest = z.infer<typeof bankListingRequestSchema>;

/**
 * Whether an activity is in the bank, and whether it may be listed now: published, shared with HVL or wider, and
 * owned by someone who is not a student author (D-091).
 */
export const bankListingSchema = z.strictObject({
  listedAt: z.iso.datetime().nullable(),
  eligible: z.boolean(),
});
/** An activity's bank listing. */
export type BankListing = z.infer<typeof bankListingSchema>;

/**
 * One activity in the content bank, as HVL authors see it (D-091).
 * @spec PROD-007
 */
export const bankEntrySchema = z.strictObject({
  contentId: z.uuid(),
  title: z.string(),
  /** The content type's machine name, e.g. `H5P.MultiChoice`. */
  mainLibrary: z.string(),
  /** The activity's own language tag (UD-010). */
  language: z.string().optional(),
  phase: phaseKeySchema.optional(),
  learnerPurpose: learnerPurposeSchema.optional(),
  estimatedStudentMinutes: estimatedStudentMinutesSchema.optional(),
  outcomes: z.array(learningOutcomeSchema),
  /** The owner's display name, read when shown; null when unknown. */
  ownerName: z.string().nullable(),
  updatedAt: z.iso.datetime(),
  listedAt: z.iso.datetime(),
});
/** One bank entry. */
export type BankEntry = z.infer<typeof bankEntrySchema>;

/** The content bank, newest listing first. */
export const bankListSchema = z.strictObject({ items: z.array(bankEntrySchema) });
/** The content bank. */
export type BankList = z.infer<typeof bankListSchema>;

/** `POST /api/content/:contentId/duplicate` → 201: the new private draft (D-092). */
export const duplicateResponseSchema = z.strictObject({ contentId: z.uuid() });
/** The answer of a duplicate request. */
export type DuplicateResponse = z.infer<typeof duplicateResponseSchema>;
