/**
 * PeopleDirectory — finds HVL staff who may be co-authors: by part of their name, or exactly by Feide ID, rate-limited
 * per person; and tells whether one account may be added.
 *
 * Why: PROD-007 finds co-authors "by name or Feide ID". D-090 (as amended) lets only eligible, recently signed-in HVL
 *      staff authors be found, answers `{ userId, displayName }` only and never logs the query. The Feide ID is never
 *      stored, so the exact lookup hashes the query the way the login does (`Identity.subjectHash`, D-055).
 * Spec: PROD-007, DATA-002, DATA-009
 * Invariants:
 *   - Who may be found or added is `findableStaffWhere` (./staffEligibility.ts): kind `staff` and a
 *     `coAuthorSearchableAt` less than 13 months old, which only an eligible staff author's Feide login sets.
 *   - The asker is never in an answer; at most 10 people, ordered by name and then ID.
 *   - A name query matches `displayName` case-insensitively anywhere in it, with `%`, `_` and `\` matched as
 *     themselves (escaped), so a query cannot widen itself into "everyone".
 *   - A query in the form of a Feide ID is looked up exactly, through the login's identity hash under every key of
 *     the ring (../../auth/identity/identityLookup.ts); it never falls back to a name search.
 *   - PRIVACY: the query is never logged, audited, stored or put into an error: a database failure is replaced by
 *     an error that names no value (a database error can echo its parameters).
 * Collaborators: ./PeopleSearchRateLimit.ts, ./staffEligibility.ts, ../../auth/identity/identityLookup.ts,
 *   ../../auth/identity/subjectSources.ts, ../../security/keys/IdentityHasher.ts, ../http/collaborationRoutes.ts,
 *   ./coAuthorChanges.ts.
 * Tests: apps/server/test/learningDesign/collaboration/peopleSearch.int.test.ts,
 *   apps/server/test/learningDesign/collaboration/peopleSearchPrivacy.int.test.ts
 */
import { PEOPLE_SEARCH_MAX_RESULTS, type Person } from '@hvl-interaktiv/api-contract';
import { findIdentity } from '../../auth/identity/identityLookup.js';
import { identitySource } from '../../auth/identity/subjectSources.js';
import { FEIDE_ID_PATTERN } from '../../config/envParsers.js';
import type { Database } from '../../infra/prismaClient.js';
import type { Redis } from '../../infra/redisClient.js';
import type { IdentityHasher } from '../../security/keys/IdentityHasher.js';
import { PeopleSearchRateLimit } from './PeopleSearchRateLimit.js';
import { findableStaffWhere } from './staffEligibility.js';

/** What the directory is built from. */
export interface PeopleDirectoryDeps {
  readonly db: Database;
  /** The login's identity hasher (the same key ring as `Identity.subjectHash`). */
  readonly hasher: IdentityHasher;
  /** The server's Redis client, for the per-person search limit. */
  readonly redis: Redis;
}

/** The outcome of a search: the people found, or refused by the rate limit. */
export type PeopleSearchOutcome =
  | { readonly kind: 'found'; readonly people: readonly Person[] }
  | { readonly kind: 'limited'; readonly retryAfterSeconds: number };

/**
 * A query with LIKE's own characters escaped, for Prisma's `contains` (which wraps it in `%…%` but escapes nothing).
 * @param query - The trimmed query.
 * @returns The query with `\`, `%` and `_` escaped by `\`, PostgreSQL's default LIKE escape character.
 */
export const escapeLike = (query: string): string => query.replace(/[\\%_]/g, (c) => `\\${c}`);

/** A stored display name as the contract shows it: an empty one is unknown. */
export const personOf = (row: { id: string; displayName: string | null }): Person => ({
  userId: row.id,
  displayName: row.displayName === null || row.displayName === '' ? null : row.displayName,
});

/** Finds HVL staff who may be co-authors. */
export class PeopleDirectory {
  private readonly rateLimit: PeopleSearchRateLimit;

  /**
   * @param deps - Database, identity hasher and Redis; building contacts none of them.
   */
  constructor(private readonly deps: PeopleDirectoryDeps) {
    this.rateLimit = new PeopleSearchRateLimit(deps.redis);
  }

  /**
   * Searches for people, after counting the search against the asker's rate limit.
   * @param askerUserId - Who searches; never in the answer.
   * @param query - The trimmed query, 3 to 100 characters (the contract's `peopleQuerySchema`).
   * @param now - The current moment, for the 13-month rule.
   * @returns At most 10 people, or `limited` with the seconds until the asker may search again.
   * @throws Error "people search failed" (naming no value) when the database fails; Redis's error.
   * @spec PROD-007
   */
  async search(askerUserId: string, query: string, now: Date): Promise<PeopleSearchOutcome> {
    const decision = await this.rateLimit.take(askerUserId);
    if (!decision.allowed) return { kind: 'limited', retryAfterSeconds: decision.retryAfterSeconds };
    try {
      const feideId = query.toLowerCase();
      const people = FEIDE_ID_PATTERN.test(feideId)
        ? await this.byFeideId(askerUserId, feideId, now)
        : await this.byName(askerUserId, query, now);
      return { kind: 'found', people };
    } catch {
      // PRIVACY: a database error may quote the query; the error that is logged names nothing (DATA-009).
      throw new Error('people search failed');
    }
  }

  /**
   * Tells whether an account may be found and added as a co-author now.
   * @param userId - The account (untrusted: from a request body).
   * @param now - The current moment.
   * @returns True for an eligible, recently signed-in HVL staff author.
   * @spec PROD-007
   */
  async isFindable(userId: string, now: Date): Promise<boolean> {
    return (await this.deps.db.user.count({ where: { id: userId, ...findableStaffWhere(now) } })) > 0;
  }

  private async byName(askerUserId: string, query: string, now: Date): Promise<Person[]> {
    const rows = await this.deps.db.user.findMany({
      where: {
        ...findableStaffWhere(now),
        id: { not: askerUserId },
        // SECURITY: Prisma passes `contains` to ILIKE unescaped, so `%` or `_` would match every name.
        displayName: { contains: escapeLike(query), mode: 'insensitive' },
      },
      select: { id: true, displayName: true },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      take: PEOPLE_SEARCH_MAX_RESULTS,
    });
    return rows.map(personOf);
  }

  private async byFeideId(askerUserId: string, feideId: string, now: Date): Promise<Person[]> {
    const { db, hasher } = this.deps;
    // PRIVACY: the Feide ID is only ever hashed, never stored or compared in plain text (DATA-002, D-055).
    const { identity } = await findIdentity(db, hasher, 'feide', identitySource({ kind: 'feide', feideId }));
    if (!identity || identity.userId === askerUserId) return [];
    const row = await db.user.findFirst({
      where: { id: identity.userId, ...findableStaffWhere(now) },
      select: { id: true, displayName: true },
    });
    return row ? [personOf(row)] : [];
  }
}
